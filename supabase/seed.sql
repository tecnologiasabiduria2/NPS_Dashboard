-- ============================================
-- SEED de datos de PRUEBA — Plataforma Ventra / Sabiduría Empresarial
-- Ejecutar DESPUÉS de supabase/schema.sql, en el SQL Editor de Supabase.
-- Idempotente: no duplica si ya hay módulos en Sabiduría.
-- ============================================

-- 1) CONTENIDO DE PRUEBA: 2 módulos + 8 lecciones en el producto 'sabiduria'
--    (videos con Fathom IDs placeholder; 1 documento; 5 entregables/checklist)
do $$
declare
  v_prod uuid;
  v_m1 uuid;
  v_m2 uuid;
begin
  select id into v_prod from products where slug = 'sabiduria';
  if v_prod is null then
    raise exception 'No existe el producto sabiduria. Corre supabase/schema.sql primero.';
  end if;

  if exists (select 1 from modules where product_id = v_prod) then
    raise notice 'Ya existen módulos en Sabiduría — no se insertó nada.';
    return;
  end if;

  insert into modules (product_id, title, description, "order", is_published)
  values (v_prod, 'Módulo 1 — Fundamentos del Flujo de Caja',
          'Aprende a leer y proyectar el flujo de caja de tu negocio.', 1, true)
  returning id into v_m1;

  insert into modules (product_id, title, description, "order", is_published)
  values (v_prod, 'Módulo 2 — Precios y Rentabilidad',
          'Define precios que aseguren margen y rentabilidad sostenible.', 2, true)
  returning id into v_m2;

  insert into lessons (module_id, title, type, fathom_share_id, storage_path, "order", is_published)
  values
    (v_m1, 'Video: Introducción al flujo de caja', 'video', 'DEMO_FATHOM_ID', null, 1, true),
    (v_m1, 'Guía PDF: Plantilla de flujo de caja', 'document', null, 'module-1/plantilla-flujo-caja.pdf', 2, true),
    (v_m1, 'Define tus ingresos fijos mensuales', 'checklist_item', null, null, 3, true),
    (v_m1, 'Lista tus gastos operativos', 'checklist_item', null, null, 4, true),
    (v_m1, 'Proyecta tu caja a 90 días', 'checklist_item', null, null, 5, true),
    (v_m2, 'Video: Cómo fijar precios con margen', 'video', 'DEMO_FATHOM_ID_2', null, 1, true),
    (v_m2, 'Calcula tu punto de equilibrio', 'checklist_item', null, null, 2, true),
    (v_m2, 'Revisa el margen de tus 3 productos top', 'checklist_item', null, null, 3, true);
end $$;


-- ============================================
-- 2) USUARIO ADMIN  (parte manual + parte SQL — los auth.users NO se pueden
--    sembrar por SQL portable porque la contraseña va hasheada)
-- ============================================
-- a) Crea tu usuario en: Authentication → Users → Add user → Create new user
--    (marca "Auto Confirm User").
-- b) Márcalo admin (reemplaza el email):
--
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'TU_EMAIL@aqui.com');


-- ============================================
-- 3) CLIENTE DE PRUEBA  (opcional, para ver la vista del cliente)
-- ============================================
-- a) Crea otro usuario en Authentication → Add user con contraseña (Auto Confirm ON).
-- b) Dale acceso activo a Sabiduría (reemplaza el email):
--
-- insert into user_access (user_id, product_id, status, access_until, access_started, platform_invite_sent)
-- select u.id, (select id from products where slug = 'sabiduria'),
--        'active', date '2026-12-31', current_date, true
-- from auth.users u where u.email = 'CLIENTE_PRUEBA@aqui.com'
-- on conflict (user_id, product_id)
-- do update set status = 'active', access_until = excluded.access_until, updated_at = now();


-- ============================================
-- 4) (Opcional) Para probar la descarga de documentos: sube cualquier PDF a
--    Storage → bucket 'content' → carpeta 'module-1' con nombre exacto
--    'plantilla-flujo-caja.pdf' (path final: module-1/plantilla-flujo-caja.pdf).
-- ============================================
