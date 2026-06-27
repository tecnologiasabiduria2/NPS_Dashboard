-- ============================================================================
-- VENTRA PLATFORM — Bloque 3: Hoja de vida + Sesiones 1:1
-- Fecha: 2026-06-27
-- Decisión de fondo: PLAN-CAMBIO-GRANDE.md Bloque 3.
--   El espacio "Sesión 1:1" reutiliza coaching_notes (notas por fecha) y le suma
--   el link de la grabación de Fathom individual de ese cliente. No se crea tabla
--   nueva: cada nota de coaching = un registro de sesión 1:1.
--
-- Requiere: supabase/schema.sql + migracion_hiperfoco_roles.sql ya aplicados.
-- Idempotente: seguro re-ejecutar (IF NOT EXISTS).
-- ============================================================================

-- Link de la grabación de Fathom de la sesión 1:1 (opcional). El cliente la ve
-- en su hoja de vida (coaching_notes ya tiene RLS de lectura para el cliente).
ALTER TABLE coaching_notes
  ADD COLUMN IF NOT EXISTS fathom_share_id TEXT;

-- ============================================================================
-- FIN. Resumen:
--   coaching_notes.fathom_share_id → columna nueva (TEXT, nullable)
-- ============================================================================
