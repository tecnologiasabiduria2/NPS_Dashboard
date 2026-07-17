-- ============================================================================
-- Notificaciones acumulativas de "me gusta" en Conversación (2026-07-17)
-- Cuando alguien le da like a un post de otra persona, se notifica al autor.
-- Mientras la notificación siga SIN LEER, likes nuevos del mismo post se
-- acumulan en la misma fila (estilo TikTok) en vez de crear una por cada uno.
-- Idempotente. Ejecutar en Supabase (dev y prod comparten el mismo proyecto).
-- ============================================================================

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('nueva_grabacion', 'sesion_proxima', 'foro_like'));

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES foro_posts(id) ON DELETE CASCADE;

-- Likers acumulados en esta notificación mientras sigue sin leer: [{id, name}]
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actors JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS notifications_post_unread_idx
  ON notifications (post_id, user_id) WHERE read_at IS NULL;

-- ============================================================================
-- FIN. Resumen:
--   notifications.type CHECK  -> agrega 'foro_like' a los valores permitidos
--   notifications.post_id     -> columna nueva (FK a foro_posts, nullable)
--   notifications.actors      -> columna nueva (JSONB, lista de likers)
-- ============================================================================
