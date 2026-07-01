-- ============================================================================
-- Bloque 5d — Descripción opcional en las sesiones en vivo.
-- Se muestra en el modal de detalle del calendario (cliente). El admin la llena
-- en el form de sesiones. Idempotente. Ejecutar en Supabase prod y dev.
-- ============================================================================

ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS descripcion TEXT;
