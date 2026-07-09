import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// CSP con nonce por request (2026-07-09) — antes vivía en next.config.js como un
// string fijo calculado una sola vez al arrancar, lo que forzaba script-src 'self'
// SIN nonce/unsafe-inline: bloqueaba (en modo bloqueante) o reportaba como violación
// (en Report-Only, que es el modo actual) los propios scripts inline que Next.js
// inyecta para hidratar cada página. Se mueve acá porque el nonce tiene que ser
// distinto en cada request. Sigue en Report-Only a propósito — pasar a bloqueante es
// un cambio aparte, solo después de confirmar en consola que ya no hay violaciones.
function buildCsp(nonce: string): string {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' data: ${SUPABASE_URL}`,
    `connect-src 'self' ${SUPABASE_URL}`,
    `frame-src ${WORKER_URL}`,
    `object-src 'none'`,
    `worker-src 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `frame-ancestors 'self'`,
  ].join('; ')
}

export async function middleware(request: NextRequest) {
  // Nonce nuevo por request, mismo criterio que ya usaba next.config.js: solo en
  // producción (en dev, el HMR de Next necesita permisos que esta CSP rompería).
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const isProd = process.env.NODE_ENV === 'production'

  const requestHeaders = new Headers(request.headers)
  if (isProd) requestHeaders.set('x-nonce', nonce)

  function withCsp(res: NextResponse): NextResponse {
    if (isProd) res.headers.set('Content-Security-Policy-Report-Only', buildCsp(nonce))
    return res
  }

  let supabaseResponse = withCsp(NextResponse.next({ request: { headers: requestHeaders } }))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = withCsp(NextResponse.next({ request: { headers: requestHeaders } }))
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as any)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const publicPaths = ['/login', '/activate', '/forgot-password', '/reset-password']
  const isPublic = publicPaths.some(p => request.nextUrl.pathname.startsWith(p))
  const isWebhook = request.nextUrl.pathname.startsWith('/api/webhooks')
  // El cron (sync inverso) se autentica con su propio CRON_SECRET, no con sesión.
  const isCron = request.nextUrl.pathname.startsWith('/api/cron')
  // NPS por link (Bloque 5b): página y API públicas, sin login (el que califica
  // puede no tener cuenta). No se incluye en publicPaths para no forzar el
  // redirect a /dashboard de los usuarios autenticados que abran su propio link.
  const isPublicNps =
    request.nextUrl.pathname.startsWith('/nps') ||
    request.nextUrl.pathname.startsWith('/api/nps/public')

  if (!user && !isPublic && !isWebhook && !isCron && !isPublicNps) {
    return withCsp(NextResponse.redirect(new URL('/login', request.url)))
  }

  // Usuarios autenticados fuera de rutas públicas — EXCEPTO /activate: el usuario
  // queda autenticado al procesar el token de invitación (hash fragment), pero aún
  // necesita poner su contraseña antes de ser redirigido al dashboard.
  const isActivate = request.nextUrl.pathname.startsWith('/activate')
  if (user && isPublic && !isActivate) {
    return withCsp(NextResponse.redirect(new URL('/dashboard', request.url)))
  }

  if (request.nextUrl.pathname.startsWith('/admin') && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // admin y owner (Diana) acceden al panel admin. Cualquier otro → dashboard.
    if (profile?.role !== 'admin' && profile?.role !== 'owner') {
      return withCsp(NextResponse.redirect(new URL('/dashboard', request.url)))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)',
  ],
}
