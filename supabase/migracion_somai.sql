-- ============================================================================
-- Bloque 5d — Resumen (summary) en la sesión 1:1
-- El CS/Business Coach sube el Fathom + el resumen que da Fathom como parte de
-- la nota 1:1 (decisión Diana 2026-06-30). Aparece en la hoja de vida del
-- cliente (/mi-ruta) y en el detalle admin.
-- Idempotente. Ejecutar en Supabase prod y dev.
--
-- 2026-07-09: la columna se creó originalmente como "somai" (transcripción
-- errónea de "summary" en la reunión original) — se renombra acá. Si esta
-- migración ya corrió con el nombre viejo en algún entorno, el RENAME sigue
-- funcionando (columna ya existe con el nombre viejo, solo se le cambia el
-- nombre); si es un entorno nuevo, crea la columna directo con el nombre
-- correcto.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'coaching_notes' AND column_name = 'somai'
  ) THEN
    ALTER TABLE coaching_notes RENAME COLUMN somai TO summary;
  END IF;
END $$;

ALTER TABLE coaching_notes ADD COLUMN IF NOT EXISTS summary TEXT;
