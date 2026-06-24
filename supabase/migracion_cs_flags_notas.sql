-- ============================================================================
-- VENTRA PLATFORM — Migración: banderas/casos de éxito (CS) + notas internas CS
-- Fecha: 2026-06-23
-- Contexto: vista CS (HTML 2, sabiduria_dashboard_cs.html). Los 4 botones de
--           acción del CS. "Cambiar hiperfoco" y "Marcar pausa" NO necesitan
--           schema nuevo (ya viven en user_hiperfoco_mes). Esta migración cubre
--           SOLO los otros dos: "Levantar bandera" y "Marcar caso de éxito",
--           más las notas internas del CS.
--
-- Decisiones (confirmadas por Juan 2026-06-23):
--   1. client_flags UNIFICADA: un solo mecanismo para 'bandera' y 'caso_exito',
--      con ciclo de vida status 'abierta'/'resuelta' para ambos.
--   2. cs_internal_notes = tabla SEPARADA de coaching_notes, SIN ninguna policy
--      de lectura para el cliente (separación física: el cliente no puede leerla
--      bajo ninguna condición). NO se toca coaching_notes.
--
-- Requiere: supabase/schema.sql + migracion_hiperfoco_roles.sql ya aplicados
--           (depende de is_admin(), que ya incluye 'owner').
-- Idempotente: seguro re-ejecutar (IF NOT EXISTS / DROP ... IF EXISTS).
--
-- ⚠️ PARA REVISIÓN — NO EJECUTAR hasta aprobación. No toca código de UI.
-- ============================================================================


-- ============================================================================
-- 1. client_flags — banderas y casos de éxito (atributos del CLIENTE, no del mes)
--    Marcadores fechados, con motivo y ciclo de vida. Sirven al CS (HTML 2) y a
--    la vista 360 de Diana (que listará banderas abiertas / casos de éxito).
-- ============================================================================
CREATE TABLE IF NOT EXISTS client_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- el cliente
  product_id  UUID REFERENCES products(id),          -- opcional (NULL = bandera/caso general, no ligado a un programa)
  type        TEXT NOT NULL CHECK (type IN ('bandera', 'caso_exito')),
  status      TEXT NOT NULL DEFAULT 'abierta' CHECK (status IN ('abierta', 'resuelta')),
  reason      TEXT,                                  -- motivo / contexto (lo pide el boceto)
  created_by  UUID REFERENCES profiles(id),          -- la CS que lo marcó (auditoría)
  resolved_by UUID REFERENCES profiles(id),          -- quién lo cerró (NULL si abierta)
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Coherencia del ciclo de vida: resuelta ⇒ tiene fecha de cierre;
  -- abierta ⇒ no tiene datos de cierre.
  CONSTRAINT client_flags_resuelta_coherente CHECK (
    (status = 'resuelta' AND resolved_at IS NOT NULL)
    OR
    (status = 'abierta'  AND resolved_at IS NULL AND resolved_by IS NULL)
  )
);

-- Un cliente no puede tener DOS casos de éxito activos a la vez (el badge es un
-- estado encendido/apagado). El guard es por user_id solo (no por producto):
-- el badge es del cliente, y así es NULL-safe (un índice único sobre product_id
-- nullable NO bloquearía dos caso_exito con product_id NULL, porque en Postgres
-- los NULL se consideran distintos). Las banderas SÍ pueden ser varias abiertas.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_caso_exito_abierto
  ON client_flags(user_id)
  WHERE status = 'abierta' AND type = 'caso_exito';

CREATE INDEX IF NOT EXISTS idx_client_flags_user ON client_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_client_flags_open ON client_flags(user_id, type) WHERE status = 'abierta';

-- RLS: SOLO admin/CS/owner. El cliente NO ve banderas ni casos de éxito (interno).
ALTER TABLE client_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_flags_admin" ON client_flags;
CREATE POLICY "client_flags_admin" ON client_flags
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
-- (sin policy de SELECT para el cliente → invisible para él bajo cualquier rol client)


-- ============================================================================
-- 2. cs_internal_notes — notas internas del CS (separadas de coaching_notes)
--    Pueden contener info sensible (riesgo de churn, escalamientos a Diana).
--    Separación FÍSICA: ninguna policy de lectura para el cliente.
-- ============================================================================
CREATE TABLE IF NOT EXISTS cs_internal_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- el cliente
  product_id  UUID REFERENCES products(id),          -- opcional (NULL = nota general)
  author_id   UUID NOT NULL REFERENCES profiles(id), -- la CS que la escribió
  content     TEXT NOT NULL,
  note_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cs_internal_notes_user ON cs_internal_notes(user_id, note_date DESC);

-- RLS: SOLO admin/CS/owner. NUNCA el cliente (no hay policy que se lo permita).
ALTER TABLE cs_internal_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cs_internal_notes_admin" ON cs_internal_notes;
CREATE POLICY "cs_internal_notes_admin" ON cs_internal_notes
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());


-- ============================================================================
-- FIN. Resumen de lo que crea:
--   client_flags        → tabla nueva (bandera/caso_exito, status abierta/resuelta)
--                         + unique parcial (1 caso_exito activo) + RLS solo admin
--   cs_internal_notes   → tabla nueva (notas CS internas) + RLS solo admin
--
-- Lo que NO toca: coaching_notes (intacta), user_hiperfoco_mes (cambiar hiperfoco
--   y marcar pausa ya se resuelven ahí, sin schema nuevo).
-- ============================================================================
