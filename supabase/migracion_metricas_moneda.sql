-- ============================================================================
-- Punto 9 Fase 2 (2026-07-14) — Moneda de la facturación. No todos los clientes
-- son de Colombia, así que cada registro mensual guarda su divisa (código ISO).
-- Default 'COP' para lo ya existente. Idempotente. Ejecutar en Supabase prod y dev.
-- ============================================================================

ALTER TABLE user_metricas_mes ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'COP';
