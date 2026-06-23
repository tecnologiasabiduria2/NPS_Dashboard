-- ============================================
-- VENTRA PLATFORM — Seed BETA de sesiones en vivo
-- Pedido explícito de Diana: 2-3 sesiones de prueba con horarios ficticios
-- para los 3 productos, para demostrar el flujo completo sin esperar el
-- calendario real.
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Idempotente: no duplica (NOT EXISTS por product_id + title).
-- Nota: los zoom_url son placeholders; reemplazar por links reales desde
-- el panel admin (/admin/sessions) cuando existan.
-- ============================================

-- Sesiones FUTURAS para los 3 productos
INSERT INTO live_sessions (product_id, title, tipo, starts_at, ends_at, zoom_url, is_published)
SELECT
  p.id,
  v.title,
  v.tipo,
  NOW() + v.starts_in,
  NOW() + v.starts_in + INTERVAL '90 minutes',
  v.zoom,
  true
FROM products p
JOIN (VALUES
  ('sabiduria', 'Beta · Sabiduría — Inmersión 1',    'inmersion_1',             INTERVAL '2 days',  'https://zoom.us/j/BETA_SAB_1'),
  ('sabiduria', 'Beta · Sabiduría — Mentoría',        'mentoria',                INTERVAL '9 days',  'https://zoom.us/j/BETA_SAB_2'),
  ('desafio',   'Beta · Desafío — Inmersión 1',       'inmersion_1',             INTERVAL '3 days',  'https://zoom.us/j/BETA_DES_1'),
  ('desafio',   'Beta · Desafío — Sala de gerencia',  'sala_gerencia',           INTERVAL '5 days',  'https://zoom.us/j/BETA_DES_2'),
  ('workshop',  'Beta · Workshop — Inmersión 2',      'inmersion_2',             INTERVAL '4 days',  'https://zoom.us/j/BETA_WRK_1'),
  ('workshop',  'Beta · Workshop — Entrenamiento',    'entrenamiento_comercial', INTERVAL '11 days', 'https://zoom.us/j/BETA_WRK_2')
) AS v(slug, title, tipo, starts_in, zoom) ON v.slug = p.slug
WHERE NOT EXISTS (
  SELECT 1 FROM live_sessions ls WHERE ls.product_id = p.id AND ls.title = v.title
);

-- Una sesión YA TERMINADA de Sabiduría → permite probar el NPS post-sesión
-- (combinada con un registro en live_session_attendance del usuario de prueba).
INSERT INTO live_sessions (product_id, title, tipo, starts_at, ends_at, zoom_url, is_published)
SELECT
  p.id,
  'Beta · Sabiduría — sesión pasada (NPS)',
  'mentoria',
  NOW() - INTERVAL '3 hours',
  NOW() - INTERVAL '90 minutes',
  'https://zoom.us/j/BETA_SAB_PAST',
  true
FROM products p
WHERE p.slug = 'sabiduria'
  AND NOT EXISTS (
    SELECT 1 FROM live_sessions ls
    WHERE ls.product_id = p.id AND ls.title = 'Beta · Sabiduría — sesión pasada (NPS)'
  );
