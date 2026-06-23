# PENDIENTES Y PREGUNTAS ABIERTAS — Plataforma Ventra / Sabiduría Empresarial

> Registro único de todo lo que está **bloqueado, sin definir o por confirmar**
> hasta este punto de la implementación. Consolida lo disperso en
> `ARCHITECTURE.md §14`, `DECISIONES.md`, `PROGRESO.md §5` y lo descubierto en QA.
> Última actualización: **2026-06-22**.
>
> Leyenda de responsable: 🟥 Sebastián · 🟦 Diana · 🟩 León (accionable solo).

---

## A. Decisiones / insumos bloqueados por terceros

| # | Tema | Responsable | Qué se necesita | Qué bloquea | Impacto si no llega |
|---|------|-------------|------------------|-------------|---------------------|
| A1 | **SMTP custom en Supabase** | 🟥 | Credenciales SMTP (host/usuario/clave del dominio) | Plantillas branded de email (`email-templates/`) + emails reales de invitación/reset | Los correos usan el SMTP default de Supabase (muy limitado, casi no envía a terceros). Bloquea probar auth por email en prod. |
| A2 | ✅ **NPS — disparadores** | 🟥🟦 | **REDEFINIDO (2026-06-22).** Ya no es pregunta abierta de frecuencia: decisión tomada — el NPS se dispara por DOS triggers que alimentan el mismo sistema: (1) post-sesión, al terminar una sesión en vivo (`ends_at`); (2) semanal, como pregunta macro de seguimiento. Modelado en `nps_responses` con columna `"trigger"` (`post_sesion`/`semanal`), separada del `type` existente (`mejora_sesion`/`interes_ascension`, que sigue siendo el contenido de la pregunta, no el disparador). Ver migración Bloque 2 (`live_sessions` + `nps_responses.trigger`). **⚠️ Relectura de arquitectura (2026-06-23):** esto NO es solo el dato faltante "cada cuántos días" — es un **cambio de modelo**: el NPS pasó de "pregunta por TIEMPO (cada N días)" a "disparo por EVENTO (asistir a una sesión que terminó)" + un macro semanal. Vale que Sebastián (estuvo en la reunión) confirme esta relectura. | Modal implementado (Bloque 3). **Pregunta abierta NUEVA para Sebastián/Diana:** ¿el NPS post-sesión sale tras CADA sesión, o solo **después de N sesiones asistidas**? Hoy sale tras cada sesión asistida no calificada; el umbral "N sesiones" no está construido. |
| A3 | **Stripe Secret Key** | 🟥 | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | `/api/webhooks/stripe` | **Estructura preparada, integración PAUSADA por instrucción explícita (2026-06-23) — esperar señal para conectar.** El route `app/api/webhooks/stripe/route.ts` ya existe con el esqueleto de eventos (`checkout.session.completed`, `customer.subscription.updated/deleted`) pero **sin keys, sin SDK de Stripe instalado y sin lógica de negocio**: devuelve 501 mientras no haya `STRIPE_WEBHOOK_SECRET`. Sin UI de checkout. Al activar: `npm i stripe` + configurar keys + verificar firma con cuerpo crudo. |
| A4 | **GHL API key + webhook secret** | 🟥 | `GHL_API_KEY`, `GHL_WEBHOOK_SECRET` + workflow configurado en GHL | Probar webhooks GHL (Fase 4) y sync inverso (Fase 7) contra GHL real | Webhooks y sync quedan construidos pero **sin probar de verdad**. **Pista de Garzón (2026-06-22):** la API key vive en GHL → **Settings → Integrations → Private** (Private Integration Tokens, el método nuevo de GHL). Hoy hay **4 integraciones privadas**: `n8n`, `dashboard`, `claude-code-sebastian`, `claude tecnologia 2` (esta última la creó Garzón, **no está seguro de si es la correcta**). **Por confirmar con Sebastián:** (1) **cuál** de esos tokens usar para `GHL_API_KEY` (o si hay que crear uno dedicado para Ventra) y que tenga los **scopes** correctos (mínimo `contacts.readonly` + `contacts.write` para el sync inverso); (2) `GHL_WEBHOOK_SECRET` es **distinto** — es un secreto que definimos nosotros y se valida en el workflow/webhook de GHL (no es un token de integración). |
| A5 | **Contenido real (Fathom IDs + PDFs)** | 🟦 | Fathom share IDs reales y los PDFs/documentos de los módulos | Que video y descarga funcionen "de verdad" | Hoy hay placeholders: el video no reproduce y la descarga da 404. La demo igual es navegable. |
| A6 | ✅ **Carga de contenido a Supabase — RESUELTO (2026-06-23)** | 🟥 | **Decisión de Sebastián: un admin NUNCA toca Supabase directo para cargar contenido.** Se construyó un **panel en `admin/content`** (extensión, no rediseño): formulario que crea/edita lecciones (título, tipo, módulo, y el `fathom_share_id` para videos) → API route `app/api/admin/lessons` (verifica admin, inserta/actualiza con service role). Para videos, el backend **valida el `fathom_share_id` contra el Worker** (`/share/{id}/video.m3u8` → 200 ok / 404 inexistente) y **solo guarda si es válido**. El admin solo usa la UI; nada de SQL/Table Editor manual. (El contenido en sí sigue viviendo en GHL/Worker; esto solo gestiona el registro/metadatos en `lessons`.) |
| A7 | **¿MVP = solo Sabiduría, o también Workshop/Desafío?** | 🟥 | Confirmar productos a cargar para el lanzamiento | Cantidad de contenido a sembrar + lógica de ascensión | ARQUITECTURA dice MVP = solo Sabiduría; Workshop/Desafío en Fase 2. Asumido así por ahora. |

---

## B. Decisiones técnicas internas a confirmar

| # | Tema | Responsable | Detalle |
|---|------|-------------|---------|
| B1 | ✅ **Duplicidad del webhook GHL — RESUELTO (2026-06-22)** | 🟥 + 🟩 | **Sebastián confirmó que la Edge Function (`supabase/functions/ghl-webhook/`) es la implementación OFICIAL** del webhook GHL (corre independiente de la app, ya tiene `verify_jwt=false`, y maneja bien el alta de acceso a un producto para un usuario existente). El **API route** (`app/api/webhooks/ghl/route.ts`) queda **descartado** (tenía el bug de `update` sobre 0 filas que no creaba el acceso). Acción de limpieza desbloqueada → ver **D2**. Decisión registrada en `DECISIONES.md §1`. |
| B2 | **Creación manual de usuarios vs solo GHL** | 🟥 | Ya existe `admin/clients/create` (alta manual). ¿Queda como vía oficial junto al webhook de GHL, o GHL debe ser siempre el origen? (En `ARCHITECTURE §14` era pregunta abierta; el código ya la implementó.) |
| B3 | **¿El cliente debe VER sus notas de coaching?** | 🟥🟦 | La RLS permite al cliente leer sus notas (`notes_select`), y `ARCHITECTURE` dice "admin escribe, cliente lee", pero **no existe pantalla del lado cliente** para verlas. Definir si se necesita. |
| B4 | **`current_module_id` — ¿cómo se asigna?** | 🟩 + 🟥 | Hoy queda `NULL` (dashboard muestra "Sin módulo asignado"). Verificar si `/api/progress/complete` debería avanzarlo automáticamente, o si se deriva del progreso en vez de guardarse. (Pendiente de revisar el código de esa ruta.) |
| B5 | **Redirect URLs de Supabase Auth (prod ya en vivo)** | 🟩 | **Actualizado 2026-06-22 — deploy hecho.** Ahora que producción está en `https://vip.sabiduriaempresarial.com`, confirmar en Supabase → Auth → URL Configuration que el **Site URL** y las **Redirect URLs** incluyan `https://vip.sabiduriaempresarial.com/**` (para que los links de invitación/reset apunten bien). Si además se quiere probar en local, agregar también `http://localhost:3000/**`. Accionable ya; depende de A1 (SMTP) para que el email salga de verdad. |
| B6 | **¿Qué cuenta como "progreso"?** | 🟥 | Decisión tomada para el MVP (2026-06-21): el progreso cuenta **solo los entregables** (`checklist_item`), no videos ni documentos — así el 100% es alcanzable y es consistente en todas las pantallas. **Falta confirmar con Sebastián** si en el futuro ver un video / abrir un PDF también debería "contar" como completado (requeriría construir el marcar-como-visto). |
| B7 | **Rotación de Desafío + track de mentoría** | 🟥🟦 | **Salido de reunión 2026-06-22** con compañera que maneja la asistencia (transcripción `Transcripcion_sabiduria_desafio_manejo.txt`). Desafío opera por grupos/cohortes (grupo 5 activo, grupo 6 abre próxima inmersión) que alternan mes a mes entre Finanzas y Marketing; Sabiduría reparte Ventas/Procesos y Equipos según avance de cada empresario (la lógica exacta **ni la propia compañera la tiene clara del todo**, lleva ~1.5 meses en el rol). Diana indicó que esta capa de rotación/cronograma probablemente **no se automatiza** en la plataforma (se sigue llevando en Excel externo); lo que sí quiere integrar es que el empresario vea las sesiones programadas y marque asistencia. **No modelado aún** — `live_sessions.tipo` (inmersión_1/inmersión_2/mentoría/sala_gerencia/entrenamiento_comercial) sí se agregó (confirmado por Diana), pero el "track" específico (a qué mentoría/grupo pertenece la sesión) y la rotación de ciclos quedan fuera hasta que Sebastián y Diana definan el alcance. También salió: doble trazabilidad deseada (asistencia en vivo + grabación vista, como métricas separadas, con alerta al 70% de asistencia) — relacionado con B6, fuera del MVP actual. |
| B8 | ✅ **NPS — relación `type` ↔ `trigger`** | 🟩 | **Decisión tomada (2026-06-22).** El Bloque 3 (`app/api/nps/route.ts`) acopla `trigger`→`type` 1-a-1: `post_sesion` siempre genera `type='mejora_sesion'`, `semanal` siempre genera `type='interes_ascension'` (el cliente nunca elige `type`, se deriva server-side). Se evaluó explícitamente la alternativa —que ambos `type` pudieran alternarse dentro de cada trigger, como sugiere la palabra "alternados" en `ARCHITECTURE.md` pantalla 8— y se descartó: preguntar sobre interés de ascensión justo después de una sesión en vivo no calza con el momento. Queda como decisión de producto, no como limitación técnica del schema (las 4 combinaciones siguen siendo posibles a nivel de datos si en el futuro se quisiera revertir esto). |

| B9 | **Calendario de sesiones en vivo para el cliente** | 🟦 + 🟥 | **Salido de reunión 2026-06-22 (Diana + Garzón).** Diana pidió que los empresarios puedan ver un **CALENDARIO** con los días y horas de sus sesiones en vivo — no solo la próxima, sino el panorama completo (inmersiones, mentorías, sala de gerencia, entrenamiento comercial). **Hoy la plataforma solo muestra una card de "Próximo evento"** con la sesión más cercana (Bloque 3 — dashboard, pantalla 5; query `live_sessions` con `LIMIT 1`). **A definir antes de construir:** (1) **alcance** del calendario (semana/mes, lista vs. vista calendario); (2) **dónde vive** — ¿pantalla nueva (ej. `/calendario`) o sección dentro del dashboard?; (3) si aplica también a **sala de gerencia / entrenamiento comercial**, que tienen **link de Zoom fijo recurrente**, vs. **inmersión / mentoría** con **link variable** creado el día antes (relacionado con la deuda de `live_sessions.zoom_url` como campo único — ver sección E). El schema `live_sessions` ya soporta listar todas las sesiones publicadas del producto; falta la decisión de producto + la UI. **No construir hasta definir.** |

---

## C. Cosas a validar / probar (no son decisiones, es verificación pendiente)

| # | Tema | Responsable | Detalle |
|---|------|-------------|---------|
| C1 | **Flujo `activate` con invitación real** | 🟩 | El código no llama `exchangeCodeForSession` explícitamente (confía en el manejo automático del token). Según el tipo de link del email podría requerir ajuste. Validar con una invitación real (depende de A1 + deploy). |
| C2 | ✅ **Pipeline de documentos (Storage → signed URL)** | 🟩 | **RESUELTO (2026-06-21).** PDF de prueba subido a `content/module-1/plantilla-flujo-caja.pdf`; la descarga vía `/api/download` (signed URL 60s) funciona. |
| C3 | **Checklist de pruebas e2e (PLAN-LEON paso 45)** | 🟩 | QA local del 2026-06-21 cubrió auth, cliente y admin (2 bugs corregidos). **Falta:** pase e2e formal completo + lo que necesita servicios reales (invitación por email, webhook GHL). |
| C4 | ✅ **Acceso SSH + DNS — VERIFICADO (2026-06-22)** | 🟩 | **SSH OK** (`root@142.93.7.13`, droplet DigitalOcean `ubuntu-s-2vcpu-4gb-nyc1`, NYC1). Ya tiene **nginx 1.24.0** y **node v20.20.2**; **falta PM2** (instalar `npm i -g pm2` en el deploy). **DNS OK:** en Cloudflare `vip.sabiduriaempresarial.com` = registro **A → 142.93.7.13, Proxied** (apunta ya a este mismo servidor; el SSL público lo termina Cloudflare). nginx aún no tiene vhost para `vip.*` (responde 404). ⚠️ **OJO — servidor COMPARTIDO en producción:** ya corren `diagnostico`, `diana-dashboard`, `finance-dashboard`, `n8n-workflow`, `ventracrm`, `wordpress-sabiduria` (WordPress vivo recibiendo tráfico). El deploy debe ser **aditivo y no disruptivo**: nuevo vhost + puerto libre para la app Next.js, sin tocar los configs existentes. |
| C5 | **Redirect a `/access-expired`** | 🟩 | Verificar visualmente que un cliente con `user_access.status='inactive'` es redirigido a `/access-expired`. La lógica está en el layout del cliente; quedó sin probar en el QA del 2026-06-21. |

---

## D. Limpieza / deuda técnica menor

| # | Tema | Responsable | Detalle |
|---|------|-------------|---------|
| D1 | **Usuario de prueba duplicado** | 🟩 | Al crear el admin se generó por typo `tecnologia.sabiduria@gmail.com` (sin "2") además del real `tecnologia2.sabiduria@gmail.com`. Borrar el sobrante desde Authentication → Users cuando se quiera limpiar. |
| D2 | **Borrar el webhook no-oficial** ⏳ accionable ya | 🟩 | **Desbloqueado (B1 resuelto 2026-06-22).** Eliminar el API route descartado `app/api/webhooks/ghl/route.ts` (y revisar si `app/api/webhooks/ghl/deactivate/route.ts` y `app/api/ghl/update-access/route.ts` siguen vivos o también sobran frente a la Edge Function oficial). Limpieza de ~5 min para evitar confusión futura; hacer antes/junto al deploy. |
| D3 | **Datos de prueba (placeholders)** | 🟩 | Los `fathom_share_id` (`DEMO_FATHOM_ID`/`DEMO_FATHOM_ID_2`) y el `storage_path` del documento son placeholders. **Desde 2026-06-23 se reemplazan por el panel `admin/content`** (ver A6), no por SQL: el admin edita la lección y pega el `fathom_share_id` real (se valida contra el Worker antes de guardar). Depende de A5 (que lleguen los IDs reales). |

---

## E. Fuera del MVP (Fase 2/3 del ARCHITECTURE — registrar, no hacer aún)

- NPS integrado completo (cliente + reportes) — pantalla 8 + 15.
- Workshop y Desafío con contenido bloqueado + lógica de ascensión.
- Notificaciones WhatsApp (Meta Cloud API) — requiere `META_WHATSAPP_TOKEN`, `META_PHONE_NUMBER_ID`.
- Marketplace interno de ascensión.
- Replicación para empresa de turismo / inmobiliaria (multi-tenant).
- Integración directa de Stripe (`/api/webhooks/stripe`).
- Rotación de ciclos / grupos de Desafío y track de mentoría (ver B7).
- Doble trazabilidad asistencia en vivo + grabación vista, con % y alerta (ver B7).
- Links de Zoom recurrentes/fijos (sala de gerencia, entrenamiento comercial) vs.
  variables (inmersión/mentoría, creados el día antes) — hoy `live_sessions.zoom_url`
  es un solo campo editable por admin; no distingue ambos casos.
