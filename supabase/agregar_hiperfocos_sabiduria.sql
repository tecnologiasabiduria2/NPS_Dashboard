-- ============================================================
-- Agregar Finanzas + Marketing al producto Sabiduría
-- ------------------------------------------------------------
-- Decisión (Diana, call 2026-06-26): Sabiduría maneja 4 hiperfocos.
-- Hoy tiene 'Ventas Sabias' y 'Procesos y Equipos'; se le suman los
-- 2 que actualmente vive Desafío: Finanzas y Marketing.
--
-- Se DUPLICAN como registros propios de Sabiduría (no se comparten con
-- Desafío) — cada hiperfoco sigue scoped a UN producto vía product_id,
-- y su contenido (recordings) es independiente del de Desafío.
--
-- Idempotente. Ejecutar en Supabase SQL Editor (prod y dev).
-- ============================================================

INSERT INTO hiperfocos (product_id, title, "order", is_active)
SELECT p.id, v.title, v.ord, true
FROM (VALUES
  ('sabiduria', 'Finanzas',  3),
  ('sabiduria', 'Marketing', 4)
) AS v(slug, title, ord)
JOIN products p ON p.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1 FROM hiperfocos h WHERE h.product_id = p.id AND h.title = v.title
);

-- Verificación: Sabiduría debe quedar con 4 hiperfocos; Desafío con 2.
SELECT p.title AS producto, h.title AS hiperfoco, h."order", h.is_active
FROM hiperfocos h
JOIN products p ON p.id = h.product_id
WHERE h.is_active = true
ORDER BY p.slug, h."order";
