-- ============================================================================
-- VENTRA PLATFORM — Bloque 2: NPS por hiperfoco + preguntas configurables
-- Fecha: 2026-06-27
-- Decisión de fondo: PLAN-CAMBIO-GRANDE.md Bloque 2 (Diana lo enfatizó fuerte).
--   El NPS se asocia al HIPERFOCO del mes (derivado de la sesión asistida para
--   post_sesion, o del mes en curso para semanal). Así Diana ve el NPS por
--   hiperfoco/mentor, no solo el global.
--
-- Requiere: supabase/schema.sql + update_sessions_nps.sql + migracion_hiperfoco_roles.sql
--           ya aplicados.
-- Idempotente: seguro re-ejecutar (IF NOT EXISTS / DROP ... IF EXISTS / ON CONFLICT).
-- ============================================================================


-- ============================================================================
-- 1. nps_responses.hiperfoco_id  (a qué hiperfoco corresponde la respuesta)
--    NULL = el cliente no tenía hiperfoco asignado ese mes (se reporta como
--    "Sin hiperfoco"). La derivación la hace /api/nps al guardar.
-- ============================================================================
ALTER TABLE nps_responses
  ADD COLUMN IF NOT EXISTS hiperfoco_id UUID REFERENCES hiperfocos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nps_responses_hiperfoco ON nps_responses(hiperfoco_id);


-- ============================================================================
-- 2. nps_questions  (textos del modal NPS, editables por admin/Diana)
--    Una fila por disparador. El token {sesion} en `title` se reemplaza en el
--    cliente por el nombre de la sesión (solo aplica a post_sesion).
-- ============================================================================
CREATE TABLE IF NOT EXISTS nps_questions (
  "trigger"   TEXT PRIMARY KEY CHECK ("trigger" IN ('post_sesion', 'semanal')),
  eyebrow     TEXT NOT NULL,
  title       TEXT NOT NULL,
  question    TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  UUID REFERENCES profiles(id)
);

-- Seed con los textos actuales (los que hoy están hardcodeados en NpsModal.tsx).
-- ON CONFLICT DO NOTHING: no pisa lo que Diana ya haya editado.
INSERT INTO nps_questions ("trigger", eyebrow, title, question) VALUES
  ('post_sesion',
   'Después de tu sesión en vivo',
   '¿Cómo estuvo «{sesion}»?',
   '¿Qué tan probable es que recomiendes esta sesión a otro empresario?'),
  ('semanal',
   'Seguimiento semanal',
   '¿Cómo vas con tu proceso?',
   '¿Qué tan probable es que recomiendes Sabiduría Empresarial a un colega?')
ON CONFLICT ("trigger") DO NOTHING;


-- ============================================================================
-- 3. RLS — nps_questions: lectura para autenticados (el modal del cliente la
--    necesita); escritura solo admin/owner.
-- ============================================================================
ALTER TABLE nps_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nps_questions_select" ON nps_questions;
CREATE POLICY "nps_questions_select" ON nps_questions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "nps_questions_admin" ON nps_questions;
CREATE POLICY "nps_questions_admin" ON nps_questions
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());


-- ============================================================================
-- FIN. Resumen:
--   nps_responses.hiperfoco_id → columna nueva (FK, nullable) + índice
--   nps_questions              → tabla nueva + seed 2 disparadores + RLS
-- ============================================================================
