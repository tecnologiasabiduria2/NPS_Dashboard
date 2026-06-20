-- ============================================
-- VENTRA PLATFORM — Schema completo
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================

-- Extiende auth.users de Supabase
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL DEFAULT '',
  phone         TEXT,
  role          TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'admin')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: crea profile automáticamente al crear usuario
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Productos
CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL CHECK (slug IN ('workshop', 'desafio', 'sabiduria')),
  title       TEXT NOT NULL,
  description TEXT,
  "order"     INT NOT NULL
);

INSERT INTO products (slug, title, "order") VALUES
  ('workshop',  'Workshop',  1),
  ('desafio',   'Desafío',   2),
  ('sabiduria', 'Sabiduría', 3)
ON CONFLICT (slug) DO NOTHING;

-- Módulos
CREATE TABLE IF NOT EXISTS modules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES products(id),
  title        TEXT NOT NULL,
  description  TEXT,
  "order"      INT NOT NULL,
  is_published BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Lecciones (videos, documentos, checklist items)
CREATE TABLE IF NOT EXISTS lessons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id        UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('video', 'document', 'checklist_item')),
  fathom_share_id  TEXT,
  storage_path     TEXT,
  "order"          INT NOT NULL DEFAULT 0,
  is_published     BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Acceso de clientes a productos
CREATE TABLE IF NOT EXISTS user_access (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id           UUID NOT NULL REFERENCES products(id),
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'pending')),
  access_until         DATE,
  access_started       DATE,
  current_module_id    UUID REFERENCES modules(id),
  ghl_contact_id       TEXT,
  platform_invite_sent BOOLEAN DEFAULT FALSE,
  last_activity        TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- Progreso por lección
CREATE TABLE IF NOT EXISTS lesson_progress (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id    UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed    BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, lesson_id)
);

-- Notas de coaching
CREATE TABLE IF NOT EXISTS coaching_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id),
  admin_id     UUID NOT NULL REFERENCES profiles(id),
  content      TEXT NOT NULL,
  session_date DATE NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- NPS
CREATE TABLE IF NOT EXISTS nps_responses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id),
  score      INT NOT NULL CHECK (score BETWEEN 1 AND 10),
  feedback   TEXT,
  type       TEXT NOT NULL CHECK (type IN ('mejora_sesion', 'interes_ascension')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_access_user_id      ON user_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_access_status       ON user_access(status);
CREATE INDEX IF NOT EXISTS idx_user_access_access_until ON user_access(access_until);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_id  ON lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lessons_module_id        ON lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_modules_product_id       ON modules(product_id);

-- ============================================
-- RLS (Row Level Security)
-- ============================================

ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_access     ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_notes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_responses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons         ENABLE ROW LEVEL SECURITY;
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;

-- Helper para verificar admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT role = 'admin' FROM profiles WHERE id = auth.uid()), FALSE);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- profiles
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (id = auth.uid());

-- user_access
DROP POLICY IF EXISTS "access_select" ON user_access;
CREATE POLICY "access_select" ON user_access FOR SELECT USING (user_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS "access_admin_all" ON user_access;
CREATE POLICY "access_admin_all" ON user_access FOR ALL USING (is_admin());

-- lesson_progress
DROP POLICY IF EXISTS "progress_all" ON lesson_progress;
CREATE POLICY "progress_all" ON lesson_progress FOR ALL USING (user_id = auth.uid() OR is_admin());

-- coaching_notes
DROP POLICY IF EXISTS "notes_select" ON coaching_notes;
CREATE POLICY "notes_select" ON coaching_notes FOR SELECT USING (user_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS "notes_admin_insert" ON coaching_notes;
CREATE POLICY "notes_admin_insert" ON coaching_notes FOR INSERT WITH CHECK (is_admin());

-- nps_responses
DROP POLICY IF EXISTS "nps_insert" ON nps_responses;
CREATE POLICY "nps_insert" ON nps_responses FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "nps_select" ON nps_responses;
CREATE POLICY "nps_select" ON nps_responses FOR SELECT USING (user_id = auth.uid() OR is_admin());

-- products, modules, lessons: lectura para autenticados
DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select" ON products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "modules_select" ON modules;
CREATE POLICY "modules_select" ON modules FOR SELECT TO authenticated USING (is_published = true OR is_admin());
DROP POLICY IF EXISTS "lessons_select" ON lessons;
CREATE POLICY "lessons_select" ON lessons FOR SELECT TO authenticated USING (is_published = true OR is_admin());

-- Admin puede todo en módulos y lecciones
DROP POLICY IF EXISTS "modules_admin" ON modules;
CREATE POLICY "modules_admin" ON modules FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "lessons_admin" ON lessons;
CREATE POLICY "lessons_admin" ON lessons FOR ALL USING (is_admin());

-- ============================================
-- Supabase Storage: bucket 'content' (ejecutar por separado si falla)
-- ============================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('content', 'content', false)
-- ON CONFLICT (id) DO NOTHING;
