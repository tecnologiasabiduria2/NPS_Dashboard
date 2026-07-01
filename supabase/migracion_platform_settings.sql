-- ============================================================================
-- B13 — Ajustes de plataforma configurables por el owner (Diana) sin deploy.
-- Tabla key/value simple. RLS activada SIN policies: solo el service role
-- (API /api/admin/settings) escribe/lee; el cliente nunca la toca directo.
-- Idempotente. Ejecutar en prod y dev.
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Valor por defecto del objetivo de sesiones 1:1 por CS/mes (B13).
-- Si ya existe, no lo pisa.
INSERT INTO platform_settings (key, value)
VALUES ('cs_session_target_monthly', '20')
ON CONFLICT (key) DO NOTHING;
