-- FIX SEGURIDAD 2026-07-02 (#3): "recordings_client_select" solo exigia is_published = true,
-- sin verificar que el cliente tuviera acceso activo al PRODUCTO ni al HIPERFOCO de esa
-- grabacion. Cualquier cliente autenticado podia leer storage_path/fathom_share_id de
-- CUALQUIER producto/hiperfoco via la API REST de Supabase directamente (bypass de
-- /recording/[id], que si valida esto correctamente pero solo a nivel de UI/pagina).
--
-- Replica exactamente la misma logica que ya existe en app/(client)/recording/[id]/page.tsx:
--   - hiperfoco.product_id debe coincidir con un user_access activo del cliente
--   - si el tipo es transversal (sala_gerencia / entrenamiento_comercial) no hace falta
--     tener el hiperfoco asignado
--   - si no es transversal, debe existir una fila en user_hiperfoco_mes con ese hiperfoco_id

DROP POLICY IF EXISTS "recordings_client_select" ON recordings;
CREATE POLICY "recordings_client_select" ON recordings
  FOR SELECT TO authenticated
  USING (
    is_published = TRUE
    AND EXISTS (
      SELECT 1
      FROM hiperfocos hf
      JOIN user_access ua
        ON ua.product_id = hf.product_id
       AND ua.user_id = auth.uid()
       AND ua.status = 'active'
      WHERE hf.id = recordings.hiperfoco_id
        AND (
          recordings.tipo IN ('sala_gerencia', 'entrenamiento_comercial')
          OR EXISTS (
            SELECT 1 FROM user_hiperfoco_mes uhm
            WHERE uhm.user_id = auth.uid()
              AND uhm.hiperfoco_id = recordings.hiperfoco_id
          )
        )
    )
  );
