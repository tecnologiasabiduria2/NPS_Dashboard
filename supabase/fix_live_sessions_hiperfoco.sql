-- FIX SEGURIDAD 2026-07-02 (#4): "live_sessions_select_client" no filtraba por
-- hiperfoco_nombre (columna agregada en migracion_sesion_hiperfoco_nombre.sql, #8v2),
-- asi que un cliente podia leer zoom_url de sesiones de OTRO hiperfoco del mismo
-- producto via la API REST directa, sin pasar por /api/sessions/[id]/join (que si
-- valida esto correctamente) ni por la pagina de sesiones (que tambien filtra, pero
-- solo en la UI).
--
-- De paso corrige un bug funcional relacionado: la policy exigia
-- "ua.product_id = live_sessions.product_id", lo que rompia sesiones "generales"
-- (product_id IS NULL = todos los productos, ver #8v2) porque NULL = x nunca es true
-- en SQL. Las paginas ya esperaban product_id NULL como "todos" (sessions/page.tsx:29),
-- pero la RLS nunca lo permitia.
--
-- Replica exactamente la misma logica que ya usan /api/sessions/[id]/join y
-- app/(client)/sessions/page.tsx.

DROP POLICY IF EXISTS "live_sessions_select_client" ON live_sessions;
CREATE POLICY "live_sessions_select_client" ON live_sessions
  FOR SELECT TO authenticated
  USING (
    is_published = true
    AND (client_user_id IS NULL OR client_user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_access ua
      WHERE ua.user_id = auth.uid()
        AND ua.status = 'active'
        AND (live_sessions.product_id IS NULL OR ua.product_id = live_sessions.product_id)
    )
    AND (
      live_sessions.hiperfoco_nombre IS NULL
      OR EXISTS (
        SELECT 1
        FROM user_hiperfoco_mes uhm
        JOIN hiperfocos hf ON hf.id = uhm.hiperfoco_id
        WHERE uhm.user_id = auth.uid()
          AND hf.title = live_sessions.hiperfoco_nombre
      )
    )
  );
