-- ============================================================
-- Fix: Sala de Gerencia y Entrenamiento Comercial ya NO son
-- hiperfocos de área — son tipos de contenido (campo 'tipo' en
-- recordings). Desactivarlos para que no aparezcan en el
-- formulario de subida ni en roadmap como hiperfocos.
--
-- Los registros de recordings con tipo='sala_gerencia' o
-- tipo='entrenamiento_comercial' se suben bajo los hiperfocos
-- reales (Ventas Sabias, Procesos, Finanzas, Marketing) y el
-- roadmap los muestra en secciones transversales filtrando por tipo.
-- ============================================================

UPDATE hiperfocos
SET is_active = false
WHERE title IN ('Sala de Gerencia', 'Entrenamiento Comercial');

-- Verificación: deben quedar 4 activos (2 por producto)
SELECT h.title, h.is_active, p.title AS producto
FROM hiperfocos h
JOIN products p ON p.id = h.product_id
ORDER BY p.slug, h.order;
