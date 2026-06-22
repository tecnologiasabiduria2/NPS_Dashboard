-- ============================================
-- VENTRA PLATFORM — Sesiones en vivo + NPS triggers
-- Bloque 2: migración incremental
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Requiere: schema base ya aplicado (supabase/schema.sql)
-- Idempotente: seguro re-ejecutar (IF NOT EXISTS / DROP POLICY IF EXISTS)
-- ============================================

-- --------------------------------------------
-- 1. live_sessions — calendario por producto
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS live_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  title        TEXT NOT NULL DEFAULT 'Sesión en vivo',
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  zoom_url     TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT live_sessions_ends_after_starts CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_product_starts
  ON live_sessions (product_id, starts_at);

-- --------------------------------------------
-- 2. live_session_attendance — registro al clic
--    UNIQUE(user_id, session_id) = idempotencia
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS live_session_attendance (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_live_session_attendance_user
  ON live_session_attendance (user_id);

CREATE INDEX IF NOT EXISTS idx_live_session_attendance_session
  ON live_session_attendance (session_id);

-- --------------------------------------------
-- 3. nps_responses — eje trigger (cuándo) vs type (qué pregunta)
--    "trigger" va entre comillas: palabra reservada en PostgreSQL
-- --------------------------------------------
ALTER TABLE nps_responses
  ADD COLUMN IF NOT EXISTS "trigger" TEXT NOT NULL DEFAULT 'semanal';

ALTER TABLE nps_responses
  ADD COLUMN IF NOT EXISTS live_session_id UUID REFERENCES live_sessions(id) ON DELETE SET NULL;

ALTER TABLE nps_responses
  DROP CONSTRAINT IF EXISTS nps_responses_trigger_check;

ALTER TABLE nps_responses
  ADD CONSTRAINT nps_responses_trigger_check
  CHECK ("trigger" IN ('post_sesion', 'semanal'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_nps_one_post_session_per_user_session
  ON nps_responses (user_id, live_session_id)
  WHERE "trigger" = 'post_sesion' AND live_session_id IS NOT NULL;

-- --------------------------------------------
-- 4. RLS — live_sessions + live_session_attendance
-- --------------------------------------------
ALTER TABLE live_sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_session_attendance ENABLE ROW LEVEL SECURITY;

-- live_sessions: cliente ve sesiones publicadas de productos con acceso activo
DROP POLICY IF EXISTS "live_sessions_select_client" ON live_sessions;
CREATE POLICY "live_sessions_select_client" ON live_sessions
  FOR SELECT TO authenticated
  USING (
    is_published = true
    AND EXISTS (
      SELECT 1 FROM user_access ua
      WHERE ua.user_id = auth.uid()
        AND ua.product_id = live_sessions.product_id
        AND ua.status = 'active'
    )
  );

-- live_sessions: admin control total
DROP POLICY IF EXISTS "live_sessions_admin_all" ON live_sessions;
CREATE POLICY "live_sessions_admin_all" ON live_sessions
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- live_session_attendance: cliente registra solo su propia asistencia
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
    )
  );

-- live_session_attendance: cliente lee la suya; admin lee todas
DROP POLICY IF EXISTS "attendance_select" ON live_session_attendance;
CREATE POLICY "attendance_select" ON live_session_attendance
  FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

-- --------------------------------------------
-- 5. SEED — sesión demo Sabiduría (+3 días)
--    Re-ejecutable: no duplica si ya existe la fila demo
-- --------------------------------------------
INSERT INTO live_sessions (product_id, title, starts_at, ends_at, zoom_url)
SELECT
  p.id,
  'Sesión en vivo — Sabiduría (demo)',
  NOW() + INTERVAL '3 days',
  NOW() + INTERVAL '3 days' + INTERVAL '90 minutes',
  'https://zoom.us/j/DEMO_SABIDURIA_BETA'
FROM products p
WHERE p.slug = 'sabiduria'
  AND NOT EXISTS (
    SELECT 1
    FROM live_sessions ls
    WHERE ls.product_id = p.id
      AND ls.title = 'Sesión en vivo — Sabiduría (demo)'
  );
