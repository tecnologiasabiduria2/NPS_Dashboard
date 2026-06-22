# PROGRESO — Plataforma Ventra / Sabiduría Empresarial

> **Para retomar:** dile a Claude Code *"lee PROGRESO.md y seguimos"*.
> Última actualización: **2026-06-21** (cierre de sesión: QA local + fixes + commit `0076840`).
> Repo: `github.com/tecnologiasabiduria2/NPS_Dashboard` (rama `main`).

---

## 1. Resumen ejecutivo — dónde estamos

El proyecto vive en `ventra-platform/`. La base es el trabajo de **Sebastián**
(commit `13416e5`), sobre el que se integró el **branding del brandbook**
hecho por León. Stack real:

- **Next.js 15.0.3** (App Router), **React 18**, **Tailwind v3** (config en
  `tailwind.config.ts`), sistema de diseño propio (no shadcn), **tema oscuro**.
- Tipografía **Outfit**. Logo = SVG inline (`components/Logo.tsx`).
- Supabase (auth + DB + storage), webhook GHL como **Edge Function**.

El proyecto **compila** (`npm run build` ✓) y **corre** (`npm run dev` ✓ en
`localhost:3000`).

---

## 2. Estado por fase (PLAN-LEON.md) — verificado archivo por archivo

| Fase | Estado | Notas |
|------|--------|-------|
| **0 — Supabase** | ✅ Completo | Proyecto, schema, bucket `content` (privado), seed de prueba. RLS activa + **policies de contenido corregidas 2026-06-21** (ver `DECISIONES.md` §3). Pendiente: SMTP custom. |
| **1 — Setup Next.js** | ✅ Completo | Base de Sebastián (Next 15, Tailwind v3, Supabase clients, middleware). |
| **2 — Branding** | ✅ Completo | Colores del brandbook (#7E301F / #DA7D41 / #EAAD74) portados a `tailwind.config.ts`, `Logo.tsx` y 2 hexes hardcodeados. Tema oscuro conservado. |
| **3 — Auth** | ✅ Completo* | login, activate, forgot-password, reset-password — todos reales y conectados a Supabase. *Ver §3 caveat sobre `activate` y SMTP. |
| **4 — Webhooks GHL** | ✅ Completo | `webhooks/ghl` (alta/reactivación) + `webhooks/ghl/deactivate` + Edge Function `supabase/functions/ghl-webhook/`. Ver `DECISIONES.md` (Edge Function vs API route). |
| **5 — Área cliente** | ✅ Casi | dashboard, roadmap, module/[id] (video+docs+checklist), profile, access-expired — **todos reales**. **Falta:** NPS del cliente (pantalla 8). |
| **6 — Área admin** | ✅ Casi | dashboard (KPIs+alertas), clients (lista), clients/[id] (detalle + editar acceso + **agregar notas de coaching**, 2026-06-21), clients/create (alta manual), map, nps (resultados). **Falta:** gestión de contenido es solo-lectura (ver §3). |
| **7 — Sync inverso → GHL** | ❌ No hecho | No existe la función de sync diario progreso→GHL ni el cron. `lib/ghl/api.ts` tiene `updateContactFields()` pero nada la llama en schedule. |
| **8 — Deploy VPS** | ❌ No hecho | Existe `deploy.sh`, pero nginx/PM2/SSL en el VPS no están configurados. Nunca se ha desplegado. |
| **9 — Pruebas** | 🟡 Parcial | QA local hecho (2026-06-21): cliente + admin OK, 2 bugs corregidos (fechas DATE, progreso por entregables). **Falta:** e2e formal, integración real (webhook/email) y verificar redirect `access-expired` (C5). |

---

## 3. Lo que "parece completo" pero tiene gaps (revisado con cuidado)

1. **Gestión de contenido (admin/content) = SOLO LECTURA.** Lista productos/
   módulos/lecciones y su estado de publicación, pero **no** permite subir PDFs,
   pegar Fathom IDs, crear módulos/lecciones ni publicar desde la UI (dice
   "v1 — edición completa en v2"). Para cargar contenido hoy hay que insertarlo
   **manualmente en Supabase** (SQL/Table Editor), incluido marcar
   `is_published = true`.

2. ✅ **Contenido de prueba sembrado (2026-06-21).** Se insertaron en el producto
   **Sabiduría** 2 módulos publicados con 8 lecciones (Módulo 1: 5 lecciones —
   video/document/3 checklist; Módulo 2: 3 — video/2 checklist). Notas:
   - El `video` usa `fathom_share_id` placeholder (`DEMO_FATHOM_ID`, `DEMO_FATHOM_ID_2`)
     → el player carga pero no reproduce hasta poner Fathom share IDs reales.
   - El `document` apunta a `module-1/plantilla-flujo-caja.pdf` → la descarga da
     404 hasta subir un PDF a esa ruta exacta en el bucket `content`.

3. ✅ **Usuario admin creado (2026-06-21).** `tecnologia2.sabiduria@gmail.com`
   (id `4f5aa43c-06a9-4103-9847-31f6b781433d`) → `role = 'admin'`. Creado vía
   Authentication → Add user (Auto Confirm ON) y marcado admin por SQL.
   **Importante:** un admin NO puede ver `/dashboard` (el client layout redirige
   admins a `/admin/dashboard`). Para probar la vista cliente end-to-end hace
   falta un **usuario cliente** con `user_access` activo (pendiente).

4. **`activate` depende del manejo automático del token de Supabase** (no llama
   `exchangeCodeForSession` explícitamente). Según el tipo de link del email
   podría requerir ajuste — validar cuando se pruebe el flujo de invitación real.

5. **NPS del cliente (pantalla 8) no existe.** El admin puede VER resultados NPS,
   pero el cliente no tiene dónde responder. Era Fase 2 según ARCHITECTURE.md.
   **Bloqueado:** falta que Sebastián confirme cada cuántos días aparece el NPS
   (no construir cliente ni admin de NPS hasta tener esa definición).

6. ✅ **Storage bucket `content` creado (2026-06-21), privado** (`public = false`).
   Verificado por SQL. Las descargas pasan por `/api/download` (server-side con
   service role), así que no requiere Storage policies para el cliente.

---

## 4. Siguiente paso exacto para retomar

> **Sesión del 2026-06-21 cerrada.** Prioridad 1 (datos de prueba + QA local)
> COMPLETA: el MVP es navegable end-to-end en local, cliente y admin.
> 📋 Todo lo abierto (bloqueadores, preguntas, decisiones) está en `PENDIENTES.md`.

### ▶ Próximo paso para mañana
1. **Deploy a VPS (Fase 8)** — mayor impacto y accionable sin terceros. Antes:
   confirmar SSH a `root@142.93.7.13` y DNS de `vip.sabiduriaempresarial.com` (`PENDIENTES.md` C4).
2. **Si no se hace deploy:** construir el sync inverso → GHL (Fase 7); se prueba
   luego con la GHL key.
3. **Verificación de QA pendiente:** confirmar el redirect a `/access-expired`
   cuando `user_access.status='inactive'` (quedó sin probar visualmente — `PENDIENTES.md` C5).

### Hecho en la sesión 2026-06-21:
- ✅ Poner `role='admin'` a tu profile en Supabase (hecho).
- ✅ Crear el bucket `content` (privado) en Supabase Storage (hecho).
- ✅ Insertar módulos y lecciones (video/doc/checklist) en Sabiduría (hecho).
- ✅ **Flujo cliente probado en local (2026-06-21):** cliente de prueba
  `cliente.prueba@test.com` creado (Add user + acceso activo a Sabiduría vía
  `admin/clients/create`). Dashboard, roadmap y module/[id] cargan con datos
  reales; marcar checklist persiste el progreso. **El flujo de invitación por
  email NO se probó** (link apunta a producción no desplegada + falta SMTP).
- ⚠️ **Hallazgo + fix de RLS (2026-06-21):** `products`/`modules`/`lessons`
  tenían RLS activa sin policies → bloqueaban toda lectura a usuarios
  autenticados (cliente veía 0, `/admin/content` también). Se agregaron policies
  de SELECT. Detalle en `DECISIONES.md` §3.
- ✅ **QA del lado admin (2026-06-21):** dashboard (KPIs/alertas), lista de
  clientes, detalle (editar `access_until` persiste) y mapa — todos correctos con
  el cliente de prueba. **Bug encontrado y corregido:** las fechas `DATE`
  (`access_until`, `session_date`) se mostraban un día antes por desfase de zona
  horaria (`new Date('YYYY-MM-DD')` = UTC). Se creó `lib/format.ts` →
  `formatDateOnly()` y se aplicó en clients, dashboard, profile y clients/[id].
- ✅ **Progreso = solo entregables (2026-06-21).** QA detectó que dashboard y
  hoja de ruta contaban TODAS las lecciones (video+doc+checklist) como
  denominador, pero el cliente solo puede completar los checklist → el progreso
  nunca llegaba a 100% y no cuadraba con la pantalla del módulo. Se unificó:
  dashboard, roadmap y detalle de cliente (admin) ahora cuentan solo
  `type='checklist_item'`. Pendiente de criterio: si videos/PDFs deberían contar
  al verse (decisión de Sebastián — ver `PENDIENTES.md` B6).
- ✅ **Formulario de notas de coaching construido (2026-06-21).** Pantalla 13
  completa: `app/api/admin/notes/route.ts` (insert con verificación admin) +
  `AddNoteForm.tsx` (fecha local + textarea, `router.refresh()` al guardar).
  **Fix extra:** la query de notas hacía `profiles(full_name)` ambiguo
  (`coaching_notes` tiene 2 FKs a `profiles`: `user_id` y `admin_id`) → fallaba
  al haber notas. Desambiguado con `profiles!admin_id(full_name)`.
- ✅ **Fixes consolidados en los scripts SQL (2026-06-21).** La causa raíz fue
  que la base en vivo se creó con los archivos viejos de `sql/`. Se alinearon:
  `supabase/schema.sql` (canónico: trigger con fallback a email + bucket `content`
  activado), `sql/schema.sql` (trigger/`full_name` corregidos), `sql/rls-policies.sql`
  (reescrito completo e idempotente, **ya incluye las policies de contenido**) y
  `sql/rls-policies-fix.sql` (marcado OBSOLETO). Re-crear el entorno desde
  `supabase/schema.sql` ahora deja la DB correcta sin pasos manuales.
- ⬜ (opcional) Subir un PDF real a `content/module-1/plantilla-flujo-caja.pdf`
  y poner Fathom share IDs reales para que video y descarga funcionen de verdad.

**Pendientes de terceros** (Sebastián/Diana): SMTP custom, NPS (frecuencia),
GHL API key, contenido real (Fathom IDs + PDFs), decisión de CRUD de contenido.
Detalle, responsables e impacto en `PENDIENTES.md`.

---

## 5. Bloqueadores pendientes

> 📋 **Registro completo y consolidado de TODO lo abierto** (bloqueadores,
> preguntas, decisiones técnicas, verificaciones y deuda menor) en
> **`PENDIENTES.md`**. La tabla de abajo es solo el resumen.

| Bloqueador | Estado | Impacto |
|------------|--------|---------|
| **SMTP custom en Supabase** | ❌ Sin configurar | Sin SMTP no se pueden editar plantillas de email y los correos de invitación/reset usan el servicio default (limitado). Necesario para producción. Plantillas de branding ya hechas en `../email-templates/` (listas para pegar cuando haya SMTP). |
| **Stripe key** | ⏳ Pendiente de Sebastián | No bloquea lo actual (no hay integración Stripe en código todavía). |
| **NPS — cada cuántos días aparece** | ❓ Pregunta abierta | Definir con Diana/Sebastián. Bloquea construir NPS cliente. |
| **Creación manual de usuarios** | ✅ RESUELTO | Sebastián implementó `admin/clients/create` + `api/admin/create-client`. El admin puede crear usuarios manualmente (además del webhook de GHL). |
| **Contenido de qué productos para MVP** | ❓ Abierta | ARCHITECTURE dice MVP = solo Sabiduría. Confirmar. |

---

## 6. Contexto técnico para Claude

- **Ramas:** `main` (= base Sebastián + integración de hoy). `leon-backup-20260620`
  guarda el trabajo original de León (auth en Tailwind v4 + shadcn + logos PNG),
  por si se necesita rescatar algo.
- **`.env.local`** tiene las llaves reales de Supabase (ignorado por git). El
  `.env.example` versionado es la plantilla.
- **Desviaciones del plan** documentadas en `DECISIONES.md` (webhook = Edge
  Function, no API route).
- **Reproducir el entorno desde cero** (ej. Sebastián en su propia base): correr
  en el SQL Editor `supabase/schema.sql` (estructura + RLS + trigger + products +
  bucket) y luego `supabase/seed.sql` (módulos/lecciones de prueba + plantillas
  comentadas para crear admin y cliente). Los datos NO viajan en git — el push
  solo mueve código; cada quien corre los scripts en su Supabase.
- **Comandos:** `npm run dev` (localhost:3000), `npm run build`, `npm run start`.
- **Pantallas públicas para revisar sin login:** `/login`, `/forgot-password`,
  `/reset-password`, `/activate`.
- **Recursos de marca:** logos en `../LOGOS/`, brandbook en
  `../Brandbook Sabiduría Empresarial.pdf`, plantillas de email en
  `../email-templates/`.
