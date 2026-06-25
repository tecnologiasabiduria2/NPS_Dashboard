-- ============================================================================
-- Seed: Hiperfocos transversales (Sala de Gerencia + Entrenamiento Comercial)
-- Aplica a: Sabiduría y Desafío
-- Fecha: 2026-06-25
--
-- Estos hiperfocos son comunes a todos los empresarios (independiente del
-- producto). Se registran una vez por producto para que la FK modules.hiperfoco_id
-- pueda apuntar a ellos al cargar grabaciones desde admin/content.
--
-- Idempotente: inserta SOLO si no existe ya ese título en ese producto.
-- ============================================================================

INSERT INTO hiperfocos (product_id, title, "order", is_active)
SELECT p.id, v.title, v.ord, true
FROM (VALUES
  ('sabiduria', 'Sala de Gerencia',         10),
  ('sabiduria', 'Entrenamiento Comercial',   11),
  ('desafio',   'Sala de Gerencia',         10),
  ('desafio',   'Entrenamiento Comercial',   11)
) AS v(slug, title, ord)
JOIN products p ON p.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1 FROM hiperfocos h
  WHERE h.product_id = p.id AND h.title = v.title
);
