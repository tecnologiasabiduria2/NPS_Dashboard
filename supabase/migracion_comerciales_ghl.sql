-- ============================================================================
-- VENTRA PLATFORM — Migración: puente CS (profile) ↔ usuario de GHL
-- Fecha: 2026-06-29 (Bloque 4 del cambio grande)
-- Decisión: PLAN-CAMBIO-GRANDE.md Bloque 4 + confirmación de Juan (2026-06-29):
--   "los comerciales de GHL son las mismas personas que los CS de la plataforma".
--   GHL es la fuente de verdad; los perfiles son mutables (cambia el nombre, no
--   el ID). Por eso guardamos el ID del usuario de GHL en el profile del CS.
--
-- Requiere: supabase/schema.sql + migracion_hiperfoco_roles.sql ya aplicados.
-- Idempotente: seguro re-ejecutar (IF NOT EXISTS / DROP ... IF EXISTS).
--
-- ⚠️ PARA REVISIÓN — NO EJECUTAR hasta aprobación. No toca código de UI.
-- ============================================================================

-- ID del usuario de GHL vinculado a este profile (solo aplica a CS/admin/owner).
-- NULL = sin vincular. El owner gestiona el mapeo desde /admin/comerciales.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ghl_user_id TEXT;

-- Un usuario de GHL se vincula a lo sumo a UN profile (relación 1:1).
-- Índice único parcial: ignora los NULL (varios profiles sin vincular son válidos).
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_ghl_user_id
  ON profiles (ghl_user_id)
  WHERE ghl_user_id IS NOT NULL;

-- RLS: la columna viaja en profiles, que ya tiene policies. El mapeo se escribe
-- vía API route con service role (requireOwner), no por el cliente directamente,
-- así que no hace falta policy nueva.

-- ============================================================================
-- FIN. Resumen:
--   profiles.ghl_user_id  → columna nueva (TEXT, nullable)
--   idx_profiles_ghl_user_id → único parcial (1 usuario GHL ↔ 1 profile)
-- ============================================================================
