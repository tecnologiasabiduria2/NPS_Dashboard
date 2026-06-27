-- ============================================================================
-- SEED DE PRUEBA — clientes completos para QA local (Bloques 2 y 3)
-- Fecha: 2026-06-27
-- Objetivo: poblar 4 clientes con historial de hiperfocos, sesiones, asistencia,
--   NPS por hiperfoco, sesiones 1:1 (con Fathom), banderas y notas internas, para
--   poder probar: lista de clientes + filtros, vista 360, NPS por hiperfoco, hoja
--   de vida (timeline) y sesiones 1:1 — sin depender de email/SMTP.
--
-- Requiere aplicadas: schema.sql + migracion_hiperfoco_roles.sql +
--   migracion_cs_flags_notas.sql + update_sessions_nps.sql + migracion_tipo_sesion.sql
--   + agregar_hiperfocos_sabiduria.sql + migracion_nps_hiperfoco.sql + migracion_hoja_vida.sql
-- Requiere TAMBIÉN: que exista al menos un usuario admin/owner (para admin_id de las
--   notas 1:1 / autor de notas internas). Si no existe, esas 3 secciones no insertan.
--
-- Idempotente: re-ejecutable. Borra y reinserta los datos de los 4 clientes de prueba.
-- Login de los 4 clientes (si la sección de auth.users funciona en tu versión de
--   Supabase): contraseña  Prueba2026!
-- ============================================================================


-- ============================================================================
-- 0. Crear usuarios de auth (idempotente; salta los que ya existan)
--    Si tu versión de Supabase rechaza este INSERT directo en auth.users/identities,
--    crea los 4 usuarios desde Authentication → Add user (Auto Confirm ON) con esos
--    emails y vuelve a correr el script: las secciones de datos funcionan igual
--    (buscan por email).
-- ============================================================================

-- 0.a Auto-heal: GoTrue falla ("Database error loading user") si las columnas de
--     token quedan en NULL. Las normalizamos a '' (arregla login y borrado en el
--     dashboard para usuarios de prueba ya creados por una corrida anterior).
UPDATE auth.users SET
  confirmation_token         = COALESCE(confirmation_token, ''),
  recovery_token             = COALESCE(recovery_token, ''),
  email_change               = COALESCE(email_change, ''),
  email_change_token_new     = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change               = COALESCE(phone_change, ''),
  phone_change_token         = COALESCE(phone_change_token, ''),
  reauthentication_token     = COALESCE(reauthentication_token, '')
WHERE email IN ('ana.prueba@test.com','bruno.prueba@test.com','carla.prueba@test.com','diego.prueba@test.com');

-- 0.b Crear los usuarios que falten (tokens en '' desde el inicio).
DO $$
DECLARE
  emails text[] := ARRAY['ana.prueba@test.com','bruno.prueba@test.com','carla.prueba@test.com','diego.prueba@test.com'];
  names  text[] := ARRAY['Ana Prueba','Bruno Prueba','Carla Prueba','Diego Prueba'];
  v_email text; v_name text; v_id uuid; i int;
BEGIN
  FOR i IN 1 .. array_length(emails, 1) LOOP
    v_email := emails[i];
    v_name  := names[i];
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
      v_id := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change,
        email_change_token_new, reauthentication_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
        v_email, crypt('Prueba2026!', gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', v_name),
        '', '', '', '', ''
      );
      INSERT INTO auth.identities (
        provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at
      ) VALUES (
        v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', v_email),
        'email', now(), now(), now()
      );
    END IF;
  END LOOP;
END $$;


-- ============================================================================
-- 1. Limpieza de datos previos de los 4 clientes (idempotencia)
-- ============================================================================
DELETE FROM nps_responses        WHERE user_id IN (SELECT id FROM auth.users WHERE email IN ('ana.prueba@test.com','bruno.prueba@test.com','carla.prueba@test.com','diego.prueba@test.com'));
DELETE FROM coaching_notes       WHERE user_id IN (SELECT id FROM auth.users WHERE email IN ('ana.prueba@test.com','bruno.prueba@test.com','carla.prueba@test.com','diego.prueba@test.com'));
DELETE FROM client_flags         WHERE user_id IN (SELECT id FROM auth.users WHERE email IN ('ana.prueba@test.com','bruno.prueba@test.com','carla.prueba@test.com','diego.prueba@test.com'));
DELETE FROM cs_internal_notes    WHERE user_id IN (SELECT id FROM auth.users WHERE email IN ('ana.prueba@test.com','bruno.prueba@test.com','carla.prueba@test.com','diego.prueba@test.com'));
DELETE FROM live_session_attendance WHERE user_id IN (SELECT id FROM auth.users WHERE email IN ('ana.prueba@test.com','bruno.prueba@test.com','carla.prueba@test.com','diego.prueba@test.com'));
DELETE FROM user_hiperfoco_mes   WHERE user_id IN (SELECT id FROM auth.users WHERE email IN ('ana.prueba@test.com','bruno.prueba@test.com','carla.prueba@test.com','diego.prueba@test.com'));
DELETE FROM live_sessions        WHERE title LIKE '[PRUEBA]%';


-- ============================================================================
-- 2. Acceso a producto (upsert — activos, con distintas fechas de vencimiento)
-- ============================================================================
INSERT INTO user_access (user_id, product_id, status, access_started, access_until, ghl_contact_id, platform_invite_sent)
SELECT u.id, p.id, 'active',
       (date_trunc('month', now()) - interval '3 months')::date,
       (now() + make_interval(days => v.dias))::date,
       v.ghl, true
FROM (VALUES
  ('ana.prueba@test.com',   'sabiduria', 60, 'TEST-GHL-ANA'),
  ('bruno.prueba@test.com', 'sabiduria', 10, 'TEST-GHL-BRUNO'),
  ('carla.prueba@test.com', 'desafio',   30, 'TEST-GHL-CARLA'),
  ('diego.prueba@test.com', 'sabiduria',  5, 'TEST-GHL-DIEGO')
) AS v(email, slug, dias, ghl)
JOIN auth.users u ON u.email = v.email
JOIN products  p ON p.slug  = v.slug
ON CONFLICT (user_id, product_id) DO UPDATE
  SET status = 'active', access_started = EXCLUDED.access_started,
      access_until = EXCLUDED.access_until, ghl_contact_id = EXCLUDED.ghl_contact_id,
      updated_at = now();


-- ============================================================================
-- 3. Historial mensual de hiperfocos (cs_id = primer admin/owner)
-- ============================================================================
INSERT INTO user_hiperfoco_mes (user_id, product_id, periodo, hiperfoco_id, estado, cs_id, assigned_by)
SELECT u.id, p.id,
       (date_trunc('month', now()) - make_interval(months => v.mes_atras))::date,
       h.id, v.estado,
       (SELECT id FROM profiles WHERE role IN ('admin','owner') ORDER BY created_at LIMIT 1),
       (SELECT id FROM profiles WHERE role IN ('admin','owner') ORDER BY created_at LIMIT 1)
FROM (VALUES
  ('ana.prueba@test.com',   'sabiduria', 'Procesos y Equipos', 2, 'cerrado'),
  ('ana.prueba@test.com',   'sabiduria', 'Ventas Sabias',      1, 'cerrado'),
  ('ana.prueba@test.com',   'sabiduria', 'Ventas Sabias',      0, 'en_curso'),
  ('bruno.prueba@test.com', 'sabiduria', 'Finanzas',           1, 'cerrado'),
  ('bruno.prueba@test.com', 'sabiduria', 'Marketing',          0, 'en_curso'),
  ('carla.prueba@test.com', 'desafio',   'Finanzas',           1, 'cerrado'),
  ('carla.prueba@test.com', 'desafio',   'Marketing',          0, 'en_curso')
) AS v(email, slug, hiperfoco, mes_atras, estado)
JOIN auth.users u ON u.email = v.email
JOIN products  p ON p.slug  = v.slug
JOIN hiperfocos h ON h.product_id = p.id AND h.title = v.hiperfoco
ON CONFLICT (user_id, product_id, periodo) DO UPDATE
  SET hiperfoco_id = EXCLUDED.hiperfoco_id, estado = EXCLUDED.estado,
      cs_id = EXCLUDED.cs_id, updated_at = now();

-- Diego: pausa este mes (sin hiperfoco) → para ver el estado "Pausa"/"Sin asignar".
INSERT INTO user_hiperfoco_mes (user_id, product_id, periodo, hiperfoco_id, estado, cs_id, assigned_by)
SELECT u.id, p.id, date_trunc('month', now())::date, NULL, 'pausa',
       (SELECT id FROM profiles WHERE role IN ('admin','owner') ORDER BY created_at LIMIT 1),
       (SELECT id FROM profiles WHERE role IN ('admin','owner') ORDER BY created_at LIMIT 1)
FROM auth.users u
JOIN products p ON p.slug = 'sabiduria'
WHERE u.email = 'diego.prueba@test.com'
ON CONFLICT (user_id, product_id, periodo) DO UPDATE
  SET hiperfoco_id = NULL, estado = 'pausa', updated_at = now();


-- ============================================================================
-- 4. Sesiones en vivo grupales (en el pasado, para asistencia)
-- ============================================================================
INSERT INTO live_sessions (product_id, title, tipo, starts_at, ends_at, zoom_url, is_published, audience)
SELECT p.id, v.title, v.tipo,
       (now() - make_interval(days => v.dias_atras)),
       (now() - make_interval(days => v.dias_atras) + interval '90 minutes'),
       'https://zoom.us/j/PRUEBA', true, 'grupal'
FROM (VALUES
  ('sabiduria', '[PRUEBA] Inmersión Sabiduría', 'inmersion_1', 25),
  ('sabiduria', '[PRUEBA] Mentoría Sabiduría',  'mentoria',     5),
  ('desafio',   '[PRUEBA] Inmersión Desafío',   'inmersion_1', 20)
) AS v(slug, title, tipo, dias_atras)
JOIN products p ON p.slug = v.slug;

-- Asistencia
INSERT INTO live_session_attendance (user_id, session_id, joined_at)
SELECT u.id, s.id, s.starts_at
FROM (VALUES
  ('ana.prueba@test.com',   '[PRUEBA] Inmersión Sabiduría'),
  ('ana.prueba@test.com',   '[PRUEBA] Mentoría Sabiduría'),
  ('bruno.prueba@test.com', '[PRUEBA] Mentoría Sabiduría'),
  ('carla.prueba@test.com', '[PRUEBA] Inmersión Desafío')
) AS v(email, stitle)
JOIN auth.users u ON u.email = v.email
JOIN live_sessions s ON s.title = v.stitle
ON CONFLICT (user_id, session_id) DO NOTHING;


-- ============================================================================
-- 5. NPS por hiperfoco (alimenta el widget "NPS por hiperfoco")
-- ============================================================================
INSERT INTO nps_responses (user_id, score, feedback, type, "trigger", hiperfoco_id, created_at)
SELECT u.id, v.score, v.feedback, 'mejora_sesion', 'post_sesion', h.id,
       (date_trunc('month', now()) - make_interval(months => v.mes_atras) + interval '14 days')
FROM (VALUES
  ('ana.prueba@test.com',   'sabiduria', 'Ventas Sabias',  1,  9, 'Muy buena sesión, claridad total'),
  ('ana.prueba@test.com',   'sabiduria', 'Ventas Sabias',  0, 10, 'Excelente acompañamiento'),
  ('bruno.prueba@test.com', 'sabiduria', 'Finanzas',       1,  7, 'Bien, aunque me perdí en un punto'),
  ('bruno.prueba@test.com', 'sabiduria', 'Marketing',      0,  5, 'No me quedó claro el enfoque'),
  ('carla.prueba@test.com', 'desafio',   'Finanzas',       1,  6, 'Regular'),
  ('carla.prueba@test.com', 'desafio',   'Marketing',      0,  8, 'Me gustó la dinámica')
) AS v(email, slug, hiperfoco, mes_atras, score, feedback)
JOIN auth.users u ON u.email = v.email
JOIN products  p ON p.slug  = v.slug
JOIN hiperfocos h ON h.product_id = p.id AND h.title = v.hiperfoco;


-- ============================================================================
-- 6. Sesiones 1:1 (coaching_notes, con Fathom) — requiere un admin/owner
-- ============================================================================
INSERT INTO coaching_notes (user_id, admin_id, content, session_date, fathom_share_id)
SELECT u.id,
       (SELECT id FROM profiles WHERE role IN ('admin','owner') ORDER BY created_at LIMIT 1),
       v.content,
       (date_trunc('month', now()) - make_interval(months => v.mes_atras) + interval '15 days')::date,
       v.fathom
FROM (VALUES
  ('ana.prueba@test.com',   'Revisamos el pipeline de ventas. Acuerdo: cerrar 3 cuentas este mes.', 1, 'DEMO_FATHOM_1A1'),
  ('bruno.prueba@test.com', 'Plan de reactivación. Se compromete a entrar a la próxima inmersión.', 0, NULL)
) AS v(email, content, mes_atras, fathom)
JOIN auth.users u ON u.email = v.email
WHERE EXISTS (SELECT 1 FROM profiles WHERE role IN ('admin','owner'));


-- ============================================================================
-- 7. Banderas / casos de éxito (CS) — requiere un admin/owner
-- ============================================================================
INSERT INTO client_flags (user_id, product_id, type, status, reason, created_by)
SELECT u.id, p.id, v.type, 'abierta', v.reason,
       (SELECT id FROM profiles WHERE role IN ('admin','owner') ORDER BY created_at LIMIT 1)
FROM (VALUES
  ('bruno.prueba@test.com', 'sabiduria', 'bandera',    'NPS bajo y baja asistencia este mes'),
  ('ana.prueba@test.com',   'sabiduria', 'caso_exito', 'Resultados sobresalientes en ventas')
) AS v(email, slug, type, reason)
JOIN auth.users u ON u.email = v.email
JOIN products  p ON p.slug  = v.slug
WHERE EXISTS (SELECT 1 FROM profiles WHERE role IN ('admin','owner'));


-- ============================================================================
-- 8. Notas internas del CS — requiere un admin/owner
-- ============================================================================
INSERT INTO cs_internal_notes (user_id, product_id, author_id, content, note_date)
SELECT u.id, p.id,
       (SELECT id FROM profiles WHERE role IN ('admin','owner') ORDER BY created_at LIMIT 1),
       v.content, (now() - interval '5 days')::date
FROM (VALUES
  ('bruno.prueba@test.com', 'sabiduria', 'Riesgo de churn: NPS 5 en Marketing y casi sin asistencia. Escalar a Diana.')
) AS v(email, slug, content)
JOIN auth.users u ON u.email = v.email
JOIN products  p ON p.slug  = v.slug
WHERE EXISTS (SELECT 1 FROM profiles WHERE role IN ('admin','owner'));


-- ============================================================================
-- 9. Verificación
-- ============================================================================
SELECT u.email,
       pr.title AS producto,
       (SELECT count(*) FROM user_hiperfoco_mes m WHERE m.user_id = u.id) AS meses_hiperfoco,
       (SELECT count(*) FROM nps_responses n      WHERE n.user_id = u.id) AS nps,
       (SELECT count(*) FROM coaching_notes c     WHERE c.user_id = u.id) AS sesiones_1a1,
       (SELECT count(*) FROM live_session_attendance a WHERE a.user_id = u.id) AS asistencias,
       (SELECT count(*) FROM client_flags f       WHERE f.user_id = u.id) AS banderas
FROM auth.users u
LEFT JOIN user_access ua ON ua.user_id = u.id
LEFT JOIN products pr ON pr.id = ua.product_id
WHERE u.email IN ('ana.prueba@test.com','bruno.prueba@test.com','carla.prueba@test.com','diego.prueba@test.com')
ORDER BY u.email;
