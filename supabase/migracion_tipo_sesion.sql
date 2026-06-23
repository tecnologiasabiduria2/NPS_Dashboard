-- ============================================
-- VENTRA PLATFORM — live_sessions.tipo
-- Agregado el 2026-06-22 para clasificar la sesión por tipo (en vez de
-- inferirlo del title en texto libre).
-- Reconstruido/versionado 2026-06-23 para mantener el repo como fuente de
-- verdad (la migración ya está aplicada en producción; verificado vía API:
-- NOT NULL, default 'mentoria', 5 valores en el CHECK).
-- Ejecutar en: Supabase Dashboard → SQL Editor. Idempotente.
-- ============================================

ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'mentoria';

ALTER TABLE live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_tipo_check;

ALTER TABLE live_sessions
  ADD CONSTRAINT live_sessions_tipo_check
  CHECK (tipo IN ('inmersion_1', 'inmersion_2', 'mentoria', 'sala_gerencia', 'entrenamiento_comercial'));
