-- ============================================================================
-- VENTRA PLATFORM — Preguntas de "retos" configurables (punto 9 Fase 2)
-- Fecha: 2026-07-14
-- Antes los textos de user_reto_hiperfoco vivían hardcodeados en
-- lib/retosPreguntas.ts (marcados como placeholder de ejemplo). Ahora Diana
-- puede editarlos desde /admin/retos/questions, mismo patrón que
-- nps_questions/migracion_nps_hiperfoco.sql.
--
-- El id y la escala (1-5) de cada pregunta siguen fijos en código; lo único
-- editable aquí es el texto.
--
-- Requiere: is_admin() ya definida (usada por nps_questions_admin).
-- Idempotente: seguro re-ejecutar.
-- ============================================================================

CREATE TABLE IF NOT EXISTS reto_preguntas (
  id          TEXT PRIMARY KEY CHECK (id IN ('claridad', 'confianza', 'reto')),
  texto       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  UUID REFERENCES profiles(id)
);

-- Seed con los textos actuales (los de lib/retosPreguntas.ts).
-- ON CONFLICT DO NOTHING: no pisa lo que Diana ya haya editado.
INSERT INTO reto_preguntas (id, texto) VALUES
  ('claridad',  '¿Qué tan claro tienes tus objetivos en esta área?'),
  ('confianza', '¿Qué tan preparado te sientes para aplicar lo de este módulo?'),
  ('reto',      '¿Qué tan grande es el reto que enfrentas hoy en esta área?')
ON CONFLICT (id) DO NOTHING;

-- RLS: lectura para autenticados (el pop-up del cliente la necesita); escritura
-- solo admin/owner.
ALTER TABLE reto_preguntas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reto_preguntas_select" ON reto_preguntas;
CREATE POLICY "reto_preguntas_select" ON reto_preguntas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "reto_preguntas_admin" ON reto_preguntas;
CREATE POLICY "reto_preguntas_admin" ON reto_preguntas
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================================
-- FIN. reto_preguntas → tabla nueva + seed 3 preguntas + RLS
-- ============================================================================
