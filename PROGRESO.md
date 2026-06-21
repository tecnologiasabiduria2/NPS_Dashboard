# PROGRESO — Plataforma Ventra / Sabiduría Empresarial

> **Para retomar:** dile a Claude Code *"lee PROGRESO.md y seguimos"*.
> Última actualización: **2026-06-20** (cierre de sesión).
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
| **0 — Supabase** | ✅ Completo | Proyecto creado, schema corrido, URLs configuradas, **RLS activa en todas las tablas** (confirmado por León en Supabase, 2026-06-20). |
| **1 — Setup Next.js** | ✅ Completo | Base de Sebastián (Next 15, Tailwind v3, Supabase clients, middleware). |
| **2 — Branding** | ✅ Completo | Colores del brandbook (#7E301F / #DA7D41 / #EAAD74) portados a `tailwind.config.ts`, `Logo.tsx` y 2 hexes hardcodeados. Tema oscuro conservado. |
| **3 — Auth** | ✅ Completo* | login, activate, forgot-password, reset-password — todos reales y conectados a Supabase. *Ver §3 caveat sobre `activate` y SMTP. |
| **4 — Webhooks GHL** | ✅ Completo | `webhooks/ghl` (alta/reactivación) + `webhooks/ghl/deactivate` + Edge Function `supabase/functions/ghl-webhook/`. Ver `DECISIONES.md` (Edge Function vs API route). |
| **5 — Área cliente** | ✅ Casi | dashboard, roadmap, module/[id] (video+docs+checklist), profile, access-expired — **todos reales**. **Falta:** NPS del cliente (pantalla 8). |
| **6 — Área admin** | ✅ Casi | dashboard (KPIs+alertas), clients (lista), clients/[id] (detalle+editar acceso), clients/create (alta manual), map, nps (resultados). **Falta:** gestión de contenido es solo-lectura (ver §3). |
| **7 — Sync inverso → GHL** | ❌ No hecho | No existe la función de sync diario progreso→GHL ni el cron. `lib/ghl/api.ts` tiene `updateContactFields()` pero nada la llama en schedule. |
| **8 — Deploy VPS** | ❌ No hecho | Existe `deploy.sh`, pero nginx/PM2/SSL en el VPS no están configurados. Nunca se ha desplegado. |
| **9 — Pruebas** | ❌ Pendiente | Falta el checklist de pruebas end-to-end. |

---

## 3. Lo que "parece completo" pero tiene gaps (revisado con cuidado)

1. **Gestión de contenido (admin/content) = SOLO LECTURA.** Lista productos/
   módulos/lecciones y su estado de publicación, pero **no** permite subir PDFs,
   pegar Fathom IDs, crear módulos/lecciones ni publicar desde la UI (dice
   "v1 — edición completa en v2"). Para cargar contenido hoy hay que insertarlo
   **manualmente en Supabase** (SQL/Table Editor), incluido marcar
   `is_published = true`.

2. **No hay contenido cargado.** El schema solo siembra los 3 `products`. **No
   existen módulos ni lecciones todavía**, así que dashboard/roadmap se verán
   vacíos (0%) hasta que se cargue contenido.

3. **No existe un usuario admin.** Para entrar al área admin, hay que poner
   manualmente `role = 'admin'` en la tabla `profiles` del usuario en Supabase.
   El primer login normal crea el profile como `client`.

4. **`activate` depende del manejo automático del token de Supabase** (no llama
   `exchangeCodeForSession` explícitamente). Según el tipo de link del email
   podría requerir ajuste — validar cuando se pruebe el flujo de invitación real.

5. **NPS del cliente (pantalla 8) no existe.** El admin puede VER resultados NPS,
   pero el cliente no tiene dónde responder. Era Fase 2 según ARCHITECTURE.md.

6. **Storage bucket `content`** está comentado en el schema → hay que crearlo
   (privado) para que la descarga de documentos funcione.

---

## 4. Siguiente paso exacto para retomar

> La RLS ya quedó activa en todas las tablas (lo hizo León el 2026-06-20), así
> que el DB está alineado. El siguiente paso es **crear datos mínimos para probar
> la plataforma end-to-end.**

**Prioridad 1 — Crear datos mínimos para probar:**
- Poner `role='admin'` a tu profile en Supabase (para entrar al área admin).
- Crear el bucket `content` (privado) en Supabase Storage.
- Insertar 1 producto con 1–2 módulos y lecciones (video/doc/checklist) para
  ver dashboard, roadmap y module/[id] con datos reales.
- Probar el flujo: crear un cliente desde `admin/clients/create` → revisar que
  llegue la invitación → activar cuenta → ver dashboard.

**Prioridad 2 —** decidir con Sebastián: gestión de contenido por UI (CRUD) vs
seguir cargando por SQL; y NPS del cliente.

**Prioridad 3 —** configurar SMTP custom en Supabase (necesario para emails de
invitación/reset en producción) y pegar las plantillas de `../email-templates/`.

---

## 5. Bloqueadores pendientes

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
- **Comandos:** `npm run dev` (localhost:3000), `npm run build`, `npm run start`.
- **Pantallas públicas para revisar sin login:** `/login`, `/forgot-password`,
  `/reset-password`, `/activate`.
- **Recursos de marca:** logos en `../LOGOS/`, brandbook en
  `../Brandbook Sabiduría Empresarial.pdf`, plantillas de email en
  `../email-templates/`.
