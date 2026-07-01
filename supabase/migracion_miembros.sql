-- ============================================================================
-- Bloque 5e — Miembros + onboarding
-- profiles.bio + avatar_url para la presentación del onboarding y el directorio.
-- Bucket público 'avatars' para las fotos de perfil (la subida la hace el server
-- con service role; lectura pública por bucket public=true).
-- Idempotente. Ejecutar en Supabase prod y dev.
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;
