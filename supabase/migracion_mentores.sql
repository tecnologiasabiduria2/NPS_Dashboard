-- Mentores como registros livianos, SIN cuenta de acceso a la plataforma
-- (calibración 2026-07-07 noche: "el mentor solo enseña en las clases, no
-- tiene acceso"). Antes, hiperfoco_mentor_mes.mentor_id apuntaba a profiles
-- (los 4 mentores se habían creado como cuentas admin por error). Esta
-- migración crea la tabla mentores y reapunta el FK, REUTILIZANDO los mismos
-- id que ya tenían esos profiles, así las filas existentes de
-- hiperfoco_mentor_mes siguen siendo válidas sin necesidad de UPDATE.

CREATE TABLE IF NOT EXISTS mentores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT NOT NULL,
  activo     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE mentores ENABLE ROW LEVEL SECURITY;
-- Sin policies a propósito (mismo patrón que platform_settings/hiperfoco_mentor_mes):
-- solo el service role (vía supabaseAdmin en el servidor) puede leer/escribir.

-- Mentores ya creados hoy como profiles — se recrean aquí con el MISMO id.
INSERT INTO mentores (id, nombre) VALUES
  ('7aeaf7bb-f6fe-403f-9ad4-cfd589debd03', 'Alejo'),
  ('32a6a111-55a3-4a8a-9f12-9ab521d1e99d', 'Cristian'),
  ('199945c0-1c10-428a-992b-73262af60413', 'Andrea Sierra'),
  ('158950bc-1f80-4948-aadf-456a08ef532f', 'Natalia Guerrero')
ON CONFLICT (id) DO NOTHING;

-- Limpieza: durante las pruebas del 07-jul quedó una fila de
-- hiperfoco_mentor_mes apuntando a un Business Coach real (Lorena, probado y
-- luego restaurado como "mentor" de Finanzas·Desafío antes de esta corrección
-- de modelo). Un Business Coach no es un mentor — se borra esa fila puntual
-- (y cualquier otra que no corresponda a los 4 mentores reales) para que el
-- ALTER de abajo no falle por FK.
DELETE FROM hiperfoco_mentor_mes
WHERE mentor_id NOT IN (
  '7aeaf7bb-f6fe-403f-9ad4-cfd589debd03',
  '32a6a111-55a3-4a8a-9f12-9ab521d1e99d',
  '199945c0-1c10-428a-992b-73262af60413',
  '158950bc-1f80-4948-aadf-456a08ef532f'
);

-- Reapuntar el FK de hiperfoco_mentor_mes de profiles(id) a mentores(id).
ALTER TABLE hiperfoco_mentor_mes DROP CONSTRAINT IF EXISTS hiperfoco_mentor_mes_mentor_id_fkey;
ALTER TABLE hiperfoco_mentor_mes
  ADD CONSTRAINT hiperfoco_mentor_mes_mentor_id_fkey
  FOREIGN KEY (mentor_id) REFERENCES mentores(id) ON DELETE CASCADE;
