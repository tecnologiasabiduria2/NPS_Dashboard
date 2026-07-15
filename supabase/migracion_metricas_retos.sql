-- ============================================================================
-- Punto 9 Fase 2 (2026-07-14) — Tracking de negocio del cliente.
--   1) user_metricas_mes: facturación real + objetivo por mes (captura en
--      onboarding privado y pop-up mensual). Se muestra al cliente (Mi progreso)
--      y a admin/Diana (detalle del cliente).
--   2) user_reto_hiperfoco: respuestas a las preguntas cerradas de "retos" al
--      iniciar cada hiperfoco/mes. Las PREGUNTAS reales las define Diana; por
--      ahora van unas de ejemplo en lib/retosPreguntas.ts (editables).
-- RLS: el cliente ve/edita SOLO lo suyo; admin lee vía service role (supabaseAdmin,
-- que no pasa por RLS). Idempotente. Ejecutar en Supabase prod y dev.
-- ============================================================================

-- 1. Métricas mensuales (facturación / objetivo) --------------------------------
CREATE TABLE IF NOT EXISTS user_metricas_mes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id       UUID REFERENCES products(id),
  periodo          DATE NOT NULL,           -- primer día del mes
  facturacion_real NUMERIC,                 -- facturación de ese mes
  objetivo         NUMERIC,                 -- meta/objetivo para ese mes
  moneda           TEXT NOT NULL DEFAULT 'COP',  -- código ISO (ver migracion_metricas_moneda.sql)
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, periodo),
  CONSTRAINT umm_periodo_inicio_mes CHECK (periodo = date_trunc('month', periodo)::date)
);
CREATE INDEX IF NOT EXISTS idx_umm_user_periodo ON user_metricas_mes(user_id, periodo);
ALTER TABLE user_metricas_mes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "umm_own" ON user_metricas_mes;
CREATE POLICY "umm_own" ON user_metricas_mes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Retos por hiperfoco/mes ----------------------------------------------------
CREATE TABLE IF NOT EXISTS user_reto_hiperfoco (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hiperfoco_id UUID NOT NULL REFERENCES hiperfocos(id) ON DELETE CASCADE,
  periodo      DATE NOT NULL,               -- primer día del mes en que se inició
  respuestas   JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { [preguntaId]: valor }
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, hiperfoco_id, periodo),
  CONSTRAINT urh_periodo_inicio_mes CHECK (periodo = date_trunc('month', periodo)::date)
);
CREATE INDEX IF NOT EXISTS idx_urh_user ON user_reto_hiperfoco(user_id);
ALTER TABLE user_reto_hiperfoco ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "urh_own" ON user_reto_hiperfoco;
CREATE POLICY "urh_own" ON user_reto_hiperfoco
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
