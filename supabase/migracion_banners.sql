-- Banners de anuncios (eventos, campañas, alianzas) — 2026-07-09. El admin sube
-- una imagen ya diseñada (no se genera nada en CSS); se muestra apilada en el
-- riel derecho de /dashboard, debajo de la tarjeta de Comunidad/Membresía.
-- Mismo patrón que 'mentores'/'platform_settings': RLS activa SIN policies,
-- solo el service role (supabaseAdmin) lee/escribe.

CREATE TABLE IF NOT EXISTS banners (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      TEXT NOT NULL,        -- etiqueta interna/alt text, no se pinta sobre la imagen
  image_path  TEXT NOT NULL,        -- path (desktop) dentro del bucket 'banners'
  image_path_mobile TEXT,           -- path opcional para mobile (ver migracion_banner_mobile.sql)
  link_url    TEXT,                 -- opcional, clic abre en pestaña nueva
  is_active   BOOLEAN NOT NULL DEFAULT true,
  starts_at   DATE,
  ends_at     DATE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT banners_ends_after_starts CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- Bucket público (igual que 'avatars'): la subida la hace el server con
-- service role; lectura pública por bucket, sin storage policies.
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;
