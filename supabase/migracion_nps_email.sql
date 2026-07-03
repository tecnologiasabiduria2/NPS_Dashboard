-- ============================================================================
-- NPS automático por correo (2026-07-03)
-- El link de NPS post-sesión ya existia (nps_token), pero mandarlo dependía
-- 100% de que el mentor lo copiara y lo enviara a mano a cada asistente.
-- Esta columna marca cuándo se mandó el correo automático de una sesión, para
-- que el cron /api/cron/send-nps-emails no lo repita.
-- Idempotente. Ejecutar en Supabase prod y dev.
-- ============================================================================

ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS nps_email_sent_at TIMESTAMPTZ;
