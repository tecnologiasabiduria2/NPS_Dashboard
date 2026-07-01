-- ============================================================================
-- Bloque 5d — Resumen SOMAI en la sesión 1:1
-- El CS/Business Coach sube el Fathom + el resumen que da Fathom (SOMAI) como
-- parte de la nota 1:1 (decisión Diana 2026-06-30). Aparece en la hoja de vida
-- del cliente (/mi-ruta) y en el detalle admin.
-- Idempotente. Ejecutar en Supabase prod y dev.
-- ============================================================================

ALTER TABLE coaching_notes ADD COLUMN IF NOT EXISTS somai TEXT;
