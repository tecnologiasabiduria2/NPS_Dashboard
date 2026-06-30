-- ============================================================================
-- Bloque 5b — NPS por LINK público (overlay fuera de la plataforma)
-- Decisión (reunión 2026-06-30, Diana): el NPS YA NO se auto-muestra dentro de
-- la plataforma. El mentor manda un LINK por sesión al terminar la clase →
-- /nps/{nps_token} → overlay → califica. Atribución por email opcional.
-- Idempotente. Ejecutar en Supabase prod y dev.
-- ============================================================================

-- 1. Token público por sesión. La URL del NPS = /nps/{nps_token}.
ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS nps_token UUID NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_sessions_nps_token
  ON live_sessions (nps_token);

-- 2. nps_responses: permitir respuestas ANÓNIMAS (sin user_id) y guardar el
--    email opcional de quien califica (para atribuir cuando calza con un cliente).
ALTER TABLE nps_responses ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE nps_responses ADD COLUMN IF NOT EXISTS respondent_email TEXT;
--    (El índice único parcial existente (user_id, live_session_id) para post_sesion
--     sigue valiendo: con user_id NULL las filas anónimas no chocan entre sí;
--     con user_id atribuido evita doble calificación de la misma sesión.)

-- 3. Atribución por email: función SECURITY DEFINER que mapea un email a su
--    user id (= profiles.id). La llama SOLO el service role desde /api/nps/public
--    (profiles no guarda el email; vive en auth.users).
CREATE OR REPLACE FUNCTION nps_match_user(p_email TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION nps_match_user(TEXT) FROM anon, authenticated;

-- ============================================================================
-- FIN. Resumen:
--   live_sessions.nps_token       → columna nueva (UUID, default, única)
--   nps_responses.user_id         → ahora NULLABLE (respuestas anónimas)
--   nps_responses.respondent_email→ columna nueva (email opcional)
--   nps_match_user(email)         → función de atribución (solo service role)
-- ============================================================================
