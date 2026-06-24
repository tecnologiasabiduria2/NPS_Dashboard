-- ============================================================================
-- SEED DE PRUEBA — modelo de hiperfoco (dashboard cliente)
-- Fecha: 2026-06-23
-- Objetivo: poblar user_hiperfoco_mes para el cliente de prueba y ver en el
--           dashboard la card "Este mes" (en_curso) + el historial (cerrado).
--
-- Cliente: cliente.prueba@test.com   |   Producto: Sabiduría
-- Idempotente: re-ejecutable (ON CONFLICT por la UNIQUE user_id+product_id+periodo).
-- Casos NO sembrados a propósito (se ven solos): "sin asignar" = no insertar fila
-- para el mes; "pausa" = mes sin fila o fila estado='pausa' con hiperfoco NULL.
-- ============================================================================

WITH cli AS (
  SELECT id AS user_id FROM auth.users WHERE email = 'cliente.prueba@test.com'
),
prod AS (
  SELECT id AS product_id FROM products WHERE slug = 'sabiduria'
)
INSERT INTO user_hiperfoco_mes (user_id, product_id, periodo, hiperfoco_id, estado)
SELECT cli.user_id, prod.product_id, v.periodo::date, h.id, v.estado
FROM (VALUES
  -- (mes,          hiperfoco,             estado)
  ('2026-06-01', 'Ventas Sabias',      'en_curso'),  -- mes actual → card "Este mes"
  ('2026-05-01', 'Procesos y Equipos', 'cerrado')    -- mes anterior → historial
) AS v(periodo, hiperfoco_title, estado)
CROSS JOIN cli
CROSS JOIN prod
JOIN hiperfocos h
  ON h.product_id = prod.product_id
 AND h.title       = v.hiperfoco_title
ON CONFLICT (user_id, product_id, periodo) DO UPDATE
  SET hiperfoco_id = EXCLUDED.hiperfoco_id,
      estado       = EXCLUDED.estado,
      updated_at   = NOW();

-- Verificación (debe devolver 2 filas: jun=en_curso, may=cerrado).
SELECT uhm.periodo, uhm.estado, h.title AS hiperfoco
FROM user_hiperfoco_mes uhm
JOIN auth.users u  ON u.id = uhm.user_id
LEFT JOIN hiperfocos h ON h.id = uhm.hiperfoco_id
WHERE u.email = 'cliente.prueba@test.com'
ORDER BY uhm.periodo DESC;
