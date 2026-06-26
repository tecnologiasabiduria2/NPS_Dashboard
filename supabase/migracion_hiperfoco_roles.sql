-- ============================================================================
-- VENTRA PLATFORM — Migración: modelo de HIPERFOCO + rol owner + CS + sesiones 1:1
-- Fecha: 2026-06-23
-- Decisión de fondo: ver PENDIENTES.md B10 (deroga B6) y B11.
--
-- Requiere: supabase/schema.sql + update_sessions_nps.sql + migracion_tipo_sesion.sql
--           ya aplicados.
-- Idempotente: seguro re-ejecutar (IF NOT EXISTS / DROP ... IF EXISTS).
--
-- ⚠️ PARA REVISIÓN — NO EJECUTAR hasta aprobación. No toca código de UI.
-- ============================================================================


-- ============================================================================
-- 1. ROLES — agrega 'owner' (Diana). CS = un profile 'admin' con clientes.
-- ============================================================================
-- El CHECK inline original se llama profiles_role_check (nombre por defecto).
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('client', 'admin', 'owner'));

-- is_admin(): ahora 'owner' hereda TODO lo que ve/hace un admin (incl. RLS).
-- Así Diana entra a las vistas admin sin policies extra; is_owner() solo
-- restringe lo exclusivo de Diana (vista 360).
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT role IN ('admin', 'owner') FROM profiles WHERE id = auth.uid()), FALSE);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT role = 'owner' FROM profiles WHERE id = auth.uid()), FALSE);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- NOTA (UI, fuera de esta migración): app/admin/layout.tsx y middleware.ts
-- comparan role === 'admin' literal → hay que ampliarlos a ('admin','owner')
-- cuando se toque la UI, o el owner quedará redirigido fuera de /admin.


-- ============================================================================
-- 2. CATÁLOGO DE HIPERFOCOS  (scoped por producto)
-- ============================================================================
CREATE TABLE IF NOT EXISTS hiperfocos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  "order"     INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (product_id, title)
);

CREATE INDEX IF NOT EXISTS idx_hiperfocos_product ON hiperfocos(product_id);

-- Seed inicial. Reparto por producto confirmado con la transcripción de la
-- reunión de asistencia (ver PENDIENTES.md B7):
--   Sabiduría → Ventas + Procesos y Equipos
--   Desafío   → Finanzas + Marketing (alternan mes a mes)
-- Es CONTENIDO editable luego por admin/Diana; los nombres son ajustables.
-- Idempotente.
INSERT INTO hiperfocos (product_id, title, "order")
SELECT p.id, v.title, v.ord
FROM (VALUES
  ('sabiduria', 'Ventas Sabias',      1),
  ('sabiduria', 'Procesos y Equipos', 2),
  ('desafio',   'Finanzas',           1),
  ('desafio',   'Marketing',          2)
) AS v(slug, title, ord)
JOIN products p ON p.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1 FROM hiperfocos h WHERE h.product_id = p.id AND h.title = v.title
);


-- ============================================================================
-- 3. modules.hiperfoco_id  (cada módulo referencia UN hiperfoco)
-- ============================================================================
ALTER TABLE modules
  ADD COLUMN IF NOT EXISTS hiperfoco_id UUID REFERENCES hiperfocos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_modules_hiperfoco ON modules(hiperfoco_id);


-- ============================================================================
-- 4. user_hiperfoco_mes  (historial mensual — núcleo del nuevo modelo)
--    Grano: UNA fila por (cliente, producto, mes) = UN hiperfoco por mes.
--    - cs_id      = CS responsable de ese hiperfoco/mes (NEGOCIO → métricas Diana)
--    - assigned_by= quién fijó/cambió la asignación (AUDITORÍA)
--    Derivados (NO se guardan): "asistió" (de live_session_attendance),
--    "repitió" (comparar con el mes anterior), NPS (de nps_responses).
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_hiperfoco_mes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id),
  periodo      DATE NOT NULL,                 -- primer día del mes
  hiperfoco_id UUID REFERENCES hiperfocos(id),-- NULL = no_elegido / pausa
  estado       TEXT NOT NULL DEFAULT 'no_elegido'
               CHECK (estado IN ('no_elegido', 'en_curso', 'cerrado', 'pausa')),
  cs_id        UUID REFERENCES profiles(id),  -- CS responsable (negocio)
  assigned_by  UUID REFERENCES profiles(id),  -- quién lo asignó (auditoría)
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),

  -- Una sola fila por mes (un hiperfoco por mes — coincide con el boceto).
  UNIQUE (user_id, product_id, periodo),

  -- periodo debe ser el primer día del mes (integridad).
  CONSTRAINT uhm_periodo_es_inicio_de_mes
    CHECK (periodo = date_trunc('month', periodo)::date),

  -- Coherencia estado ↔ hiperfoco: si hay hiperfoco activo/cerrado debe existir;
  -- en no_elegido/pausa NO hay hiperfoco.
  CONSTRAINT uhm_estado_hiperfoco_coherente CHECK (
    (estado IN ('en_curso', 'cerrado') AND hiperfoco_id IS NOT NULL)
    OR
    (estado IN ('no_elegido', 'pausa')  AND hiperfoco_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_uhm_user            ON user_hiperfoco_mes(user_id);
CREATE INDEX IF NOT EXISTS idx_uhm_product_periodo ON user_hiperfoco_mes(product_id, periodo);
CREATE INDEX IF NOT EXISTS idx_uhm_cs              ON user_hiperfoco_mes(cs_id);


-- ============================================================================
-- 5. live_sessions — distinguir GRUPAL vs 1:1 (individual) + CS responsable
-- ============================================================================
ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'grupal';

ALTER TABLE live_sessions DROP CONSTRAINT IF EXISTS live_sessions_audience_check;
ALTER TABLE live_sessions
  ADD CONSTRAINT live_sessions_audience_check CHECK (audience IN ('grupal', 'individual'));

-- Cliente objetivo: SOLO en 1:1. cs_id: responsable (obligatorio en 1:1).
ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS client_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS cs_id UUID REFERENCES profiles(id);

-- Coherencia: individual ⇒ tiene cliente; grupal ⇒ no tiene cliente.
ALTER TABLE live_sessions DROP CONSTRAINT IF EXISTS live_sessions_audience_client_check;
ALTER TABLE live_sessions
  ADD CONSTRAINT live_sessions_audience_client_check CHECK (
    (audience = 'individual' AND client_user_id IS NOT NULL)
    OR
    (audience = 'grupal' AND client_user_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_live_sessions_client ON live_sessions(client_user_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_cs     ON live_sessions(cs_id);


-- ============================================================================
-- 6. RLS — fixes en live_sessions / attendance + policies de tablas nuevas
-- ============================================================================

-- 6.1 live_sessions SELECT (cliente): no debe ver las 1:1 de OTROS clientes.
DROP POLICY IF EXISTS "live_sessions_select_client" ON live_sessions;
CREATE POLICY "live_sessions_select_client" ON live_sessions
  FOR SELECT TO authenticated
  USING (
    is_published = true
    AND (client_user_id IS NULL OR client_user_id = auth.uid())   -- ← fix 1:1
    AND EXISTS (
      SELECT 1 FROM user_access ua
      WHERE ua.user_id = auth.uid()
        AND ua.product_id = live_sessions.product_id
        AND ua.status = 'active'
    )
  );
-- (la policy live_sessions_admin_all sigue igual; is_admin() ahora incluye owner)

-- 6.2 attendance INSERT: no marcar asistencia a la 1:1 de otro.
DROP POLICY IF EXISTS "attendance_insert_own" ON live_session_attendance;
CREATE POLICY "attendance_insert_own" ON live_session_attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM live_sessions ls
      JOIN user_access ua ON ua.product_id = ls.product_id
      WHERE ls.id = session_id
        AND ua.user_id = auth.uid()
        AND ua.status = 'active'
        AND ls.is_published = true
        AND (ls.client_user_id IS NULL OR ls.client_user_id = auth.uid())  -- ← fix 1:1
    )
  );
-- attendance SELECT ya era seguro (user_id = auth.uid() OR is_admin()) — sin cambios.

-- 6.3 hiperfocos (catálogo): lectura para autenticados; admin/owner control total.
ALTER TABLE hiperfocos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hiperfocos_select" ON hiperfocos;
CREATE POLICY "hiperfocos_select" ON hiperfocos
  FOR SELECT TO authenticated USING (is_active = true OR is_admin());
DROP POLICY IF EXISTS "hiperfocos_admin" ON hiperfocos;
CREATE POLICY "hiperfocos_admin" ON hiperfocos
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 6.4 user_hiperfoco_mes: cliente lee lo suyo; admin/CS/owner gestiona.
ALTER TABLE user_hiperfoco_mes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "uhm_select" ON user_hiperfoco_mes;
CREATE POLICY "uhm_select" ON user_hiperfoco_mes
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS "uhm_admin" ON user_hiperfoco_mes;
CREATE POLICY "uhm_admin" ON user_hiperfoco_mes
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
-- NOTA: por ahora cualquier admin/CS escribe cualquier cliente (igual patrón que
-- coaching_notes). La restricción "una CS solo sus clientes asignados" queda
-- como mejora futura (no requerida por los 4 bocetos).


-- ============================================================================
-- FIN. Resumen de lo que crea/altera:
--   profiles.role            → + 'owner'  | is_admin() incluye owner | + is_owner()
--   hiperfocos               → tabla nueva + seed 4 (Sabiduría)
--   modules.hiperfoco_id     → columna nueva (FK)
--   user_hiperfoco_mes       → tabla nueva (historial mensual + cs_id + assigned_by)
--   live_sessions            → + audience, client_user_id, cs_id  (+ CHECKs)
--   RLS                      → fix 1:1 en live_sessions/attendance + policies nuevas
-- ============================================================================
