-- ============================================================================
-- Feedback 14-JUL (Diana) — El banner pasa a ser un carrusel (slide bar) arriba
-- de Inicio, y necesita una imagen distinta para mobile vs desktop (una imagen
-- ancha se ve amontonada en celular). image_path_mobile es OPCIONAL: si falta,
-- el carrusel usa image_path (desktop) en ambos tamaños.
-- Idempotente. Ejecutar en Supabase prod y dev.
-- ============================================================================

ALTER TABLE banners ADD COLUMN IF NOT EXISTS image_path_mobile TEXT;
