-- ============================================================================
-- Bloque 5f — Foro / Conversación (feed de la comunidad)
-- posts + comentarios + likes, scoped por producto. RLS activada SIN policies:
-- solo el service role (API/servidor) accede; el cliente nunca toca estas tablas
-- directo con la anon/publishable key. Idempotente. Ejecutar en prod y dev.
-- ============================================================================

CREATE TABLE IF NOT EXISTS foro_posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category   TEXT NOT NULL DEFAULT 'general',
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_foro_posts_product ON foro_posts(product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS foro_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES foro_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_foro_comments_post ON foro_comments(post_id, created_at);

CREATE TABLE IF NOT EXISTS foro_likes (
  post_id    UUID NOT NULL REFERENCES foro_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE foro_posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE foro_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE foro_likes    ENABLE ROW LEVEL SECURITY;
