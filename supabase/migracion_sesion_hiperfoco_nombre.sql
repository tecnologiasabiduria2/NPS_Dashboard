-- ============================================================================
-- #8 (v2) — Segmentación de sesiones por HIPERFOCO (nombre), no por producto.
-- Una sesión se dirige a un hiperfoco por NOMBRE (ej. "Finanzas") → la ven TODOS
-- los clientes con ese hiperfoco asignado, sin importar el producto (Sabiduría o
-- Desafío). El producto pasa a ser OPCIONAL (NULL = todos los productos), por si se
-- quiere restringir (ej. "Finanzas solo Sabiduría"). Sala de Gerencia /
-- Entrenamiento Comercial = General (sin hiperfoco) + sin producto → todos.
-- Reemplaza el enfoque de live_sessions.hiperfoco_id (que queda sin uso).
-- Idempotente. Ejecutar en prod y dev.
-- ============================================================================

ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS hiperfoco_nombre TEXT;
ALTER TABLE live_sessions ALTER COLUMN product_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_live_sessions_hiperfoco_nombre ON live_sessions(hiperfoco_nombre);
