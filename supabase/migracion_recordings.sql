-- ============================================================
-- Migración: Drop modules/lessons/lesson_progress → recordings/recording_progress
-- Ejecutar en Supabase SQL Editor (prod y dev)
-- ============================================================

-- 1. Eliminar tablas antiguas (CASCADE elimina FKs dependientes)
DROP TABLE IF EXISTS lesson_progress CASCADE;
DROP TABLE IF EXISTS lessons CASCADE;
DROP TABLE IF EXISTS modules CASCADE;

-- 2. Tabla recordings — contenido grabado, flat (sin contenedor intermedio)
CREATE TABLE IF NOT EXISTS recordings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hiperfoco_id    UUID        NOT NULL REFERENCES hiperfocos(id) ON DELETE CASCADE,
  tipo            TEXT        NOT NULL CHECK (tipo IN ('inmersion', 'mentoria', 'sala_gerencia', 'entrenamiento_comercial')),
  title           TEXT        NOT NULL,
  type            TEXT        NOT NULL DEFAULT 'video' CHECK (type IN ('video', 'document')),
  fathom_share_id TEXT,
  storage_path    TEXT,
  "order"         INTEGER     NOT NULL DEFAULT 0,
  is_published    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recordings_hiperfoco_tipo
  ON recordings (hiperfoco_id, tipo, "order");

-- 3. Tabla recording_progress — marca "visto" del cliente
CREATE TABLE IF NOT EXISTS recording_progress (
  user_id      UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recording_id UUID    NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, recording_id)
);

-- 4. RLS
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_progress ENABLE ROW LEVEL SECURITY;

-- recordings: admins gestionan todo; clientes solo ven las publicadas
CREATE POLICY "recordings_admin_all" ON recordings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );

CREATE POLICY "recordings_client_select" ON recordings
  FOR SELECT TO authenticated
  USING (is_published = TRUE);

-- recording_progress: cada usuario solo ve y edita sus propios registros
CREATE POLICY "recording_progress_own" ON recording_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
