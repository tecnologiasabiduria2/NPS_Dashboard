# Decisiones de integración y desviaciones del plan

> Registro de decisiones tomadas al integrar el trabajo de León sobre la
> base de Sebastián (commit `13416e5`). Fecha: 2026-06-20.

---

## Desviaciones de PLAN-LEON.md / ARCHITECTURE.md

### 1. Webhook de GHL: Edge Function en vez de API route de Next.js
- **Plan original (PLAN-LEON.md paso 21):** implementar el webhook como
  un API route de Next.js en `app/api/webhooks/ghl/route.ts`.
- **Implementación actual (Sebastián):** se usa una **Supabase Edge
  Function** en `supabase/functions/ghl-webhook/index.ts`
  (`config.toml` con `verify_jwt = false` para que GHL pueda llamarla
  sin token de Supabase).
- **Estado:** existe además el API route `app/api/webhooks/ghl/route.ts`
  como alternativa. La fuente de verdad operativa es la Edge Function.
- **✅ RESUELTO (2026-06-22):** Sebastián confirmó que la **Edge Function
  es la implementación OFICIAL**. El API route `app/api/webhooks/ghl/route.ts`
  queda descartado (tenía el bug de `update` sobre 0 filas que no creaba el
  acceso a un producto para un usuario existente) y debe **eliminarse** como
  limpieza (ver `PENDIENTES.md` D2). Queda por revisar si los otros routes GHL
  de Next.js (`webhooks/ghl/deactivate`, `ghl/update-access`) siguen vigentes
  o también sobran frente a la Edge Function.

### 2. Trigger `handle_new_user`: fallback de `full_name` al email
- **Schema original (ARCHITECTURE.md §6):** el trigger inserta
  `full_name = NEW.raw_user_meta_data->>'full_name'`, y `profiles.full_name`
  es `NOT NULL`.
- **Problema:** crear un usuario desde **Authentication → Add user** del
  dashboard (que no permite pasar metadata) deja `full_name = NULL` →
  viola el `NOT NULL` → el trigger explota con *"Database error creating
  new user"*. También afectaría a cualquier signup sin nombre.
- **Cambio aplicado (2026-06-21):** se hizo el trigger resiliente con
  `coalesce(new.raw_user_meta_data->>'full_name', new.email)`. Si no viene
  nombre, usa el email como respaldo. No afecta al webhook GHL (que sí
  manda `full_name`). Se ejecutó directo en Supabase (SQL Editor).
- **Nota:** conviene reflejar este cambio en `supabase/schema.sql` /
  `sql/schema.sql` para mantenerlos como fuente de verdad idempotente.

### 3. RLS de tablas de contenido (`products`/`modules`/`lessons`)
- **Hallazgo (2026-06-21):** se había activado RLS en **todas** las tablas
  (2026-06-20), pero `sql/rls-policies.sql` solo creó policies para las 5
  tablas de datos de usuario. `products`, `modules` y `lessons` quedaron con
  **RLS activa SIN policies** → PostgreSQL negaba toda lectura a usuarios
  autenticados. Síntoma: el SQL Editor (rol `postgres`, salta RLS) veía el
  contenido, pero el cliente y `/admin/content` recibían 0 filas
  (dashboard "0 de 0", roadmap vacío).
- **Fix aplicado (2026-06-21):** policies de SELECT para `authenticated`:
  - `products`: `using (true)`.
  - `modules` / `lessons`: `using (is_published or is_admin())` — el cliente
    ve solo publicado; el admin ve también borradores.
- **Pendiente:** portar estas policies a `sql/rls-policies.sql` y al schema
  idempotente para que no se pierdan en un re-setup.

---

## Integración del 2026-06-20 (base Sebastián + trabajo de León)

Decisión general (confirmada por Garzón): tomar la base de Sebastián y
traer de León solo lo que aplique, quedándose con lo más robusto.

| Área | Qué se quedó | De quién |
|------|--------------|----------|
| Stack base (Next 15, React 18, Tailwind v3, diseño propio dark) | Completo | Sebastián |
| Schema SQL (`supabase/schema.sql`) | Idempotente, RLS completo, `is_admin()` robusto | Sebastián |
| Páginas cliente/admin, API routes, componentes | Completo | Sebastián |
| Webhook GHL (Edge Function) | Se mantiene | Sebastián |
| **Colores de marca (brandbook)** | #7E301F / #DA7D41 / #EAAD74 portados a `tailwind.config.ts`, `Logo.tsx` y tokens | **León** |
| Tema | Oscuro (se conserva la dirección de Sebastián) | Sebastián |
| Matcher de middleware | Ampliado para excluir png/jpg/svg/etc. (evita bug de redirect 307 en assets) | León (lógica de Sebastián) |
| Ruta admin | `app/admin/` literal; se borró el huérfano `app/(admin)/layout.tsx` | Limpieza |

### Branding — detalle
- Los colores del brandbook se aplicaron como **tokens de Tailwind v3**
  (no se copió el `globals.css` v4 de León, que era incompatible):
  - `brand-600 = #7E301F` (Deep Terracotta) — color primario de botones.
  - `accent = #DA7D41` (Warm Amber) — token nuevo disponible.
  - `sand = #EAAD74` (Sand Beige) — token nuevo disponible.
- Gradiente del logo (`components/Logo.tsx`): `#EAAD74 → #7E301F`.
- Se conservó el tema oscuro y todo el sistema de diseño de Sebastián.

### Respaldo
- El trabajo original de León quedó en la rama local
  `leon-backup-20260620` (incluye sus pantallas auth en Tailwind v4,
  shadcn/ui y los logos PNG en `public/`, por si se necesitan luego).
