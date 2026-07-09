-- FIX 2026-07-09: Sala de Gerencia/Entrenamiento Comercial deben verse en los
-- 3 productos (Sabiduria/Desafio/Impulso Empresarial), no solo en el producto
-- donde quedo colgada la grabacion.
--
-- La RLS de "recordings_client_select" (fix_recordings_entitlement.sql,
-- 2026-07-02) ya dejaba pasar los tipos transversales sin exigir asignacion
-- de hiperfoco (user_hiperfoco_mes), PERO seguia exigiendo que el PRODUCTO del
-- hiperfoco donde quedo colgada la grabacion coincidiera con un user_access
-- activo del cliente (`ua.product_id = hf.product_id`, sin excepcion) — eso
-- bloqueaba a un cliente de Desafio ver una Sala de Gerencia subida bajo un
-- hiperfoco de Sabiduria. Encontrado verificando el fix de aplicacion
-- (roadmap/page.tsx, recording/[id]/page.tsx, api/download/route.ts) contra
-- la base real: la RLS bloqueaba antes de que el codigo de la app llegara a
-- correr.
--
-- Para transversales ahora basta con tener CUALQUIER producto activo (no el
-- especifico del hiperfoco); para el resto, sigue igual que antes.

DROP POLICY IF EXISTS "recordings_client_select" ON recordings;
CREATE POLICY "recordings_client_select" ON recordings
  FOR SELECT TO authenticated
  USING (
    is_published = TRUE
    AND (
      (
        recordings.tipo IN ('sala_gerencia', 'entrenamiento_comercial')
        AND EXISTS (
          SELECT 1 FROM user_access ua
          WHERE ua.user_id = auth.uid() AND ua.status = 'active'
        )
      )
      OR EXISTS (
        SELECT 1
        FROM hiperfocos hf
        JOIN user_access ua
          ON ua.product_id = hf.product_id
         AND ua.user_id = auth.uid()
         AND ua.status = 'active'
        WHERE hf.id = recordings.hiperfoco_id
          AND EXISTS (
            SELECT 1 FROM user_hiperfoco_mes uhm
            WHERE uhm.user_id = auth.uid()
              AND uhm.hiperfoco_id = recordings.hiperfoco_id
          )
      )
    )
  );
