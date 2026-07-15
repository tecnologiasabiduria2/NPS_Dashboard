-- Notificaciones in-app (2026-07-15, sugerencias post-portal — Fase 6)
-- Alcance: solo campana in-app (sin email/push). Disparadores: nueva grabación
-- publicada (app/api/admin/lessons/route.ts) y sesión próxima (cron
-- app/api/cron/session-reminders/route.ts). Solo insertan admin/cron (service
-- role, bypassa RLS); el cliente solo puede leer y marcar como leídas las suyas.

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN ('nueva_grabacion', 'sesion_proxima')),
  title       TEXT        NOT NULL,
  body        TEXT,
  link        TEXT,
  -- Dedupe entre corridas del cron de "sesión próxima" (ej. 'sesion_proxima:<session_id>').
  -- NULL para 'nueva_grabacion' (no necesita dedupe, cada publicación es un evento único) —
  -- Postgres trata cada NULL como distinto, así que no bloquea inserts repetidos ahí.
  dedupe_key  TEXT,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (user_id, read_at);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo ve y marca-leídas SUS notificaciones. Sin policy de INSERT
-- para 'authenticated': solo el service role (admin/cron) puede crearlas.
CREATE POLICY "notifications_own_select" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_own_update" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
