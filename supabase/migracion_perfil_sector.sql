-- ============================================================================
-- Feedback 14-JUL (Diana + Lorena) — Sector/nicho y Producto/servicio del
-- miembro. Texto libre (NO lista desplegable), se recolectan en el mismo
-- onboarding/perfil, se muestran en la tarjeta del directorio de Miembros y
-- sirven para el buscador por palabra clave (ej. "abogado", "restaurantes").
-- Idempotente. Ejecutar en Supabase prod y dev.
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS producto_servicio TEXT;
