-- ============================================================================
-- Bloque 5e+ — Instagram y sitio web del miembro (pedido de Diana, 2026-07-03).
-- Se recolectan en el mismo onboarding que la foto/bio, opcionales, y se
-- muestran como links (no botones) en el panel de perfil de Miembros.
-- Idempotente. Ejecutar en Supabase prod y dev.
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website TEXT;
