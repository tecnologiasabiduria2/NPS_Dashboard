import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
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
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Usuarios autenticados fuera de rutas públicas — EXCEPTO /activate: el usuario
  // queda autenticado al procesar el token de invitación (hash fragment), pero aún
  // necesita poner su contraseña antes de ser redirigido al dashboard.
  const isActivate = request.nextUrl.pathname.startsWith('/activate')
  if (user && isPublic && !isActivate) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (request.nextUrl.pathname.startsWith('/admin') && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // admin y owner (Diana) acceden al panel admin. Cualquier otro → dashboard.
    if (profile?.role !== 'admin' && profile?.role !== 'owner') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)',
  ],
}
