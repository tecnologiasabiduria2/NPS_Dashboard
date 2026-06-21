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
- **Pendiente de confirmar con Sebastián:** cuál de las dos queda como
  oficial y si se elimina la otra para evitar duplicación.

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
