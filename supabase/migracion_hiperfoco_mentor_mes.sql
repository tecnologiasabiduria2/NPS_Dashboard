-- ============================================================================
-- Calibración 2026-07-06 — Mentor que dictó cada hiperfoco en cada mes.
-- Distinto de user_hiperfoco_mes.cs_id (que es el CS asignado a UN cliente
-- para su seguimiento 1:1); esto es "quién dio las sesiones grupales de este
-- hiperfoco este mes", del cual se derivan qué clientes se relacionan con
-- ese mentor (los que tuvieron ese hiperfoco ese mes).
-- RLS activada SIN policies: solo el service role (API /api/admin/hiperfoco-mentor
-- y OwnerOpsSection vía supabaseAdmin) la toca. Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS hiperfoco_mentor_mes (
  hiperfoco_id UUID NOT NULL REFERENCES hiperfocos(id) ON DELETE CASCADE,
  periodo      DATE NOT NULL,
  mentor_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  updated_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (hiperfoco_id, periodo)
);

ALTER TABLE hiperfoco_mentor_mes ENABLE ROW LEVEL SECURITY;
