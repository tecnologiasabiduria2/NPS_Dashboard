-- Agrega el tipo '1_a_1' (Sesión 1:1 agendada) al CHECK de live_sessions.tipo.
-- Calibración 2026-07-07: las 1:1 ahora se pueden agendar con link como una
-- sesión normal (audience='individual', ya soportado desde
-- migracion_hiperfoco_roles.sql), heredando el NPS automático post-sesión.

ALTER TABLE live_sessions DROP CONSTRAINT IF EXISTS live_sessions_tipo_check;
ALTER TABLE live_sessions
  ADD CONSTRAINT live_sessions_tipo_check
  CHECK (tipo IN ('inmersion_1', 'inmersion_2', 'mentoria', 'sala_gerencia', 'entrenamiento_comercial', '1_a_1'));
