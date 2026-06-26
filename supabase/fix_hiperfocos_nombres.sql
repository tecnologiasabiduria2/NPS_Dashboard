-- ============================================================
-- Fix: corregir nombres de hiperfocos de Desafío
-- El seed inicial les puso sufijos "Sabias/Sabio" incorrectos.
-- Ejecutar en Supabase SQL Editor (prod y dev).
-- ============================================================

UPDATE hiperfocos SET title = 'Finanzas'  WHERE title = 'Finanzas Sabias';
UPDATE hiperfocos SET title = 'Marketing' WHERE title = 'Marketing Sabio';

-- Verificación: debe mostrar los 6 hiperfocos correctos
SELECT h.title, p.title AS producto
FROM hiperfocos h
JOIN products p ON p.id = h.product_id
ORDER BY p.slug, h.order;
