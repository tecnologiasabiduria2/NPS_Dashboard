# PENDIENTES Y PREGUNTAS ABIERTAS — Plataforma Ventra / Sabiduría Empresarial

> Registro único de todo lo que está **bloqueado, sin definir o por confirmar**
> hasta este punto de la implementación. Consolida lo disperso en
> `ARCHITECTURE.md §14`, `DECISIONES.md`, `PROGRESO.md §5` y lo descubierto en QA.
> Última actualización: **2026-06-21**.
>
> Leyenda de responsable: 🟥 Sebastián · 🟦 Diana · 🟩 León (accionable solo).

---

## A. Decisiones / insumos bloqueados por terceros

| # | Tema | Responsable | Qué se necesita | Qué bloquea | Impacto si no llega |
|---|------|-------------|------------------|-------------|---------------------|
| A1 | **SMTP custom en Supabase** | 🟥 | Credenciales SMTP (host/usuario/clave del dominio) | Plantillas branded de email (`email-templates/`) + emails reales de invitación/reset | Los correos usan el SMTP default de Supabase (muy limitado, casi no envía a terceros). Bloquea probar auth por email en prod. |
| A2 | **NPS — frecuencia** | 🟥🟦 | Cada cuántos días aparece el NPS al cliente, y la alternancia de los 2 tipos | Construir pantalla NPS del cliente (pantalla 8) | No se puede construir el flujo NPS del cliente. |
| A3 | **Stripe Secret Key** | 🟥 | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | `/api/webhooks/stripe` (marcado "futuro") | Ninguno para el MVP — no hay código Stripe aún. |
| A4 | **GHL API key + webhook secret** | 🟥 | `GHL_API_KEY`, `GHL_WEBHOOK_SECRET` + workflow configurado en GHL | Probar webhooks GHL (Fase 4) y sync inverso (Fase 7) contra GHL real | Webhooks y sync quedan construidos pero **sin probar de verdad**. |
| A5 | **Contenido real (Fathom IDs + PDFs)** | 🟦 | Fathom share IDs reales y los PDFs/documentos de los módulos | Que video y descarga funcionen "de verdad" | Hoy hay placeholders: el video no reproduce y la descarga da 404. La demo igual es navegable. |
| A6 | **¿CRUD de contenido por UI o seguir por SQL?** | 🟥 | Decisión: construir la gestión de contenido editable (pantalla 14) o cargar contenido por SQL/Table Editor | Alcance de Fase 6 / pantalla 14 | Hoy `admin/content` es **solo lectura**. Construir el CRUD son ~1–1.5 días; por SQL es 0. |
| A7 | **¿MVP = solo Sabiduría, o también Workshop/Desafío?** | 🟥 | Confirmar productos a cargar para el lanzamiento | Cantidad de contenido a sembrar + lógica de ascensión | ARQUITECTURA dice MVP = solo Sabiduría; Workshop/Desafío en Fase 2. Asumido así por ahora. |

---

## B. Decisiones técnicas internas a confirmar

| # | Tema | Responsable | Detalle |
|---|------|-------------|---------|
| B1 | **Duplicidad del webhook GHL** | 🟥 + 🟩 | Existen DOS implementaciones que hacen lo mismo: el **API route** (`app/api/webhooks/ghl/route.ts`) y la **Edge Function** (`supabase/functions/ghl-webhook/`). **Diferencias clave:** (1) el secret va en el **header** `x-ghl-secret` (API route) vs en el **body** (`secret`, Edge Function); (2) el API route tiene un **bug**: para un usuario existente sin acceso a ese producto hace `update` y matchea 0 filas → **no le crea el acceso**; la Edge Function lo maneja bien. **Recomendación de León:** quedarse con la **Edge Function** (más correcta, corre independiente de la app, ya tiene `verify_jwt=false`) y borrar el API route. **Falta que Sebastián confirme** cuál es oficial; luego se limpia en ~5 min. Ver `DECISIONES.md §1`. |
| B2 | **Creación manual de usuarios vs solo GHL** | 🟥 | Ya existe `admin/clients/create` (alta manual). ¿Queda como vía oficial junto al webhook de GHL, o GHL debe ser siempre el origen? (En `ARCHITECTURE §14` era pregunta abierta; el código ya la implementó.) |
| B3 | **¿El cliente debe VER sus notas de coaching?** | 🟥🟦 | La RLS permite al cliente leer sus notas (`notes_select`), y `ARCHITECTURE` dice "admin escribe, cliente lee", pero **no existe pantalla del lado cliente** para verlas. Definir si se necesita. |
| B4 | **`current_module_id` — ¿cómo se asigna?** | 🟩 + 🟥 | Hoy queda `NULL` (dashboard muestra "Sin módulo asignado"). Verificar si `/api/progress/complete` debería avanzarlo automáticamente, o si se deriva del progreso en vez de guardarse. (Pendiente de revisar el código de esa ruta.) |
| B5 | **Redirect URLs de Supabase Auth para local** | 🟩 | Los links de invitación/reset apuntan a `https://vip.sabiduriaempresarial.com/...`. Para probar esos flujos **en local** habría que agregar `http://localhost:3000/**` a las Redirect URLs de Supabase. Confirmar antes de probar invitaciones en local. |
| B6 | **¿Qué cuenta como "progreso"?** | 🟥 | Decisión tomada para el MVP (2026-06-21): el progreso cuenta **solo los entregables** (`checklist_item`), no videos ni documentos — así el 100% es alcanzable y es consistente en todas las pantallas. **Falta confirmar con Sebastián** si en el futuro ver un video / abrir un PDF también debería "contar" como completado (requeriría construir el marcar-como-visto). |

---

## C. Cosas a validar / probar (no son decisiones, es verificación pendiente)

| # | Tema | Responsable | Detalle |
|---|------|-------------|---------|
| C1 | **Flujo `activate` con invitación real** | 🟩 | El código no llama `exchangeCodeForSession` explícitamente (confía en el manejo automático del token). Según el tipo de link del email podría requerir ajuste. Validar con una invitación real (depende de A1 + deploy). |
| C2 | ✅ **Pipeline de documentos (Storage → signed URL)** | 🟩 | **RESUELTO (2026-06-21).** PDF de prueba subido a `content/module-1/plantilla-flujo-caja.pdf`; la descarga vía `/api/download` (signed URL 60s) funciona. |
| C3 | **Checklist de pruebas e2e (PLAN-LEON paso 45)** | 🟩 | Falta el pase formal: auth, cliente, admin, webhook. Parte ya cubierta en el QA del 2026-06-21. |
| C4 | **Acceso SSH + DNS antes del deploy** | 🟩 | Confirmar que `ssh root@142.93.7.13` funciona y que `vip.sabiduriaempresarial.com` resuelve, antes de empezar la Fase 8. |

---

## D. Limpieza / deuda técnica menor

| # | Tema | Responsable | Detalle |
|---|------|-------------|---------|
| D1 | **Usuario de prueba duplicado** | 🟩 | Al crear el admin se generó por typo `tecnologia.sabiduria@gmail.com` (sin "2") además del real `tecnologia2.sabiduria@gmail.com`. Borrar el sobrante desde Authentication → Users cuando se quiera limpiar. |
| D2 | **Borrar el webhook no-oficial** | 🟩 | Una vez resuelto B1, eliminar la implementación descartada para evitar confusión futura. |
| D3 | **Datos de prueba (placeholders)** | 🟩 | Los `fathom_share_id` (`DEMO_FATHOM_ID`/`DEMO_FATHOM_ID_2`) y el `storage_path` del documento son placeholders; reemplazar por reales cuando lleguen (depende de A5). |

---

## E. Fuera del MVP (Fase 2/3 del ARCHITECTURE — registrar, no hacer aún)

- NPS integrado completo (cliente + reportes) — pantalla 8 + 15.
- Workshop y Desafío con contenido bloqueado + lógica de ascensión.
- Notificaciones WhatsApp (Meta Cloud API) — requiere `META_WHATSAPP_TOKEN`, `META_PHONE_NUMBER_ID`.
- Marketplace interno de ascensión.
- Replicación para empresa de turismo / inmobiliaria (multi-tenant).
- Integración directa de Stripe (`/api/webhooks/stripe`).
