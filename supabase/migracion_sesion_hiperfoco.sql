-- ============================================================================
-- #8 — Hiperfoco opcional en sesiones en vivo.
-- Una sesión puede dirigirse a un hiperfoco específico (ej. "Inmersión 1 de
-- Ventas Sabias"). Si queda NULL es "general" (la ven todos los del producto).
-- El cliente solo ve las sesiones de sus hiperfocos asignados + las generales.
-- Idempotente. Ejecutar en prod y dev.
-- ============================================================================

ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS hiperfoco_id UUID REFERENCES hiperfocos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_live_sessions_hiperfoco ON live_sessions(hiperfoco_id);
