-- ============================================================
-- Fix: crear recordings y recording_progress si no existen.
-- Idempotente: seguro re-ejecutar aunque ya existan.
-- Ejecutar en Supabase SQL Editor.
-- ============================================================

-- Tabla principal de grabaciones
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

-- Tabla de progreso del cliente
CREATE TABLE IF NOT EXISTS recording_progress (
  user_id      UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recording_id UUID    NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, recording_id)
);

-- RLS
ALTER TABLE recordings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_progress ENABLE ROW LEVEL SECURITY;

-- Policies (DROP IF EXISTS antes de recrear para evitar duplicados)
DROP POLICY IF EXISTS "recordings_admin_all"    ON recordings;
DROP POLICY IF EXISTS "recordings_client_select" ON recordings;
DROP POLICY IF EXISTS "recording_progress_own"  ON recording_progress;

CREATE POLICY "recordings_admin_all" ON recordings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );

CREATE POLICY "recordings_client_select" ON recordings
  FOR SELECT TO authenticated
  USING (is_published = TRUE);

CREATE POLICY "recording_progress_own" ON recording_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Verificación final
SELECT
  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'recordings') AS recordings_existe,
  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'recording_progress') AS progress_existe;
