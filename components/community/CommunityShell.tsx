'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Home, Bell, Menu, X, User, LogOut, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import { productFullName, productInitial, isSabiduria } from '@/lib/productIdentity'

export interface ShellProduct {
  id: string
  title: string
  slug: string
}

interface CommunityShellProps {
  userName: string
  avatarUrl?: string | null
  products: ShellProduct[]
  children: React.ReactNode
  // Server Component (BannersRail) — no se puede importar/renderizar directo
  // acá porque este archivo es 'use client'; el layout (server component) lo
  // resuelve y lo pasa como prop, patrón estándar de Next App Router.
  banners?: React.ReactNode
}

// Pestañas = navegación primaria (estilo comunidad GHL/Skool). El foro real
// (Conversación) y Miembros llegan en sub-entregas posteriores: hoy "Inicio"
// apunta al dashboard y Miembros/Acerca de son placeholders.
const TABS: { href: string; label: string; match: (p: string) => boolean }[] = [
  { href: '/conversacion', label: 'Conversación', match: p => p.startsWith('/conversacion') },
  { href: '/dashboard', label: 'Inicio',      match: p => p === '/dashboard' },
  { href: '/roadmap',   label: 'Aprendizaje', match: p => p.startsWith('/roadmap') || p.startsWith('/recording') },
  { href: '/sessions',  label: 'Eventos',     match: p => p.startsWith('/sessions') },
  { href: '/mi-ruta',   label: 'Mi ruta',     match: p => p.startsWith('/mi-ruta') },
  { href: '/miembros',  label: 'Miembros',    match: p => p.startsWith('/miembros') },
  { href: '/acerca',    label: 'Acerca de',   match: p => p.startsWith('/acerca') },
]

export default function CommunityShell({ userName, avatarUrl, products, children, banners }: CommunityShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const initials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const primaryProduct = products[0]
  const showRightRail = pathname === '/dashboard' && !!primaryProduct

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function tabClass(active: boolean) {
    // Sin línea/subrayado (antes border-b-2 cortaba el texto) — la pestaña
    // activa se distingue solo por color pleno vs. atenuado (2026-07-09).
    return clsx(
      'px-3 h-12 inline-flex items-center text-sm font-medium transition-all',
      active
        ? 'text-sand'
        : 'text-cream/50 hover:text-cream/80'
    )
  }

  return (
    <div className="relative flex min-h-screen bg-surface-950 overflow-hidden">
      {/* Atmósfera de fondo — mismo recurso que admin y el login (degradado + glows
          borrosos en la paleta de marca), a pedido de Juan (2026-07-05) de que el
          área cliente tenga la misma textura de fondo que ya tiene admin. */}
      <div
        className="pointer-events-none fixed inset-0 opacity-60"
        style={{ background: 'radial-gradient(1400px 900px at 85% -10%, #2A0E07 0%, transparent 55%)' }}
      />
      <div
        className="pointer-events-none fixed -top-40 -right-32 w-[560px] h-[560px] rounded-full opacity-[0.14] blur-3xl"
        style={{ background: 'radial-gradient(circle, #7E301F 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none fixed bottom-0 left-64 w-[420px] h-[420px] rounded-full opacity-[0.08] blur-3xl"
        style={{ background: 'radial-gradient(circle, #DA7D41 0%, transparent 70%)' }}
      />

      {/* ---------- Riel de producto (desktop) ---------- */}
      <aside className="hidden lg:flex flex-col items-center gap-3 w-16 shrink-0 bg-surface-950 border-r border-surface-700 py-4 sticky top-0 h-screen">
        <Link
          href="/dashboard"
          aria-label="Inicio"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-cream-muted hover:text-cream hover:bg-surface-800 transition-colors"
        >
          <Home size={18} />
        </Link>
        <div className="w-8 border-t border-surface-700" />
        {products.map(p => (
          <Link
            key={p.id}
            href="/dashboard"
            title={p.title}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-surface-850 border border-brand-600/30 ring-2 ring-brand-600/20 hover:ring-brand-600/40 transition-all"
          >
            {isSabiduria(p.title)
              ? <Image src="/logo-icon.png" alt={p.title} width={22} height={22} className="object-contain" />
              : <span className="text-sm font-semibold text-brand-300">{productInitial(p.title)}</span>}
          </Link>
        ))}
      </aside>

      {/* ---------- Columna principal ---------- */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Barra superior única (fusionada 2026-07-08, pedido de Juan): antes
            eran 2 filas apiladas (una con el logo de Sabiduría Empresarial,
            otra con las pestañas) — mostrar el logo de Sabiduría no tenía
            sentido si el cliente está en la comunidad de Desafío/Impulso. La
            identidad de marca sigue presente en el riel de la izquierda y en
            el drawer mobile. */}
        <div className="sticky top-0 z-30 h-14 bg-surface-900 border-b border-surface-700 flex items-center justify-between gap-3 px-4">
          {/* overflow-y-hidden explícito: sin él, el navegador fuerza el eje Y
              también a "auto" (regla CSS al fijar solo overflow-x) y aparecía
              un scrollbar vertical no deseado junto a la última pestaña
              (2026-07-09, se veía junto a "Acerca de" por ser la última). */}
          <div className="flex items-center gap-1 min-w-0 overflow-x-auto overflow-y-hidden">
            <button
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-xl text-cream-muted hover:text-cream hover:bg-surface-800 transition-colors shrink-0"
              aria-label="Abrir menú"
            >
              <Menu size={20} />
            </button>
            <nav className="hidden lg:flex items-center gap-1">
              {TABS.map(t => (
                <Link key={t.href} href={t.href} className={tabClass(t.match(pathname))}>
                  {t.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Campana — hueco para notificaciones (pendiente) */}
            <button
              type="button"
              disabled
              aria-label="Notificaciones (próximamente)"
              className="p-2 rounded-xl text-cream-muted/50 cursor-default"
            >
              <Bell size={18} />
            </button>

            {/* Avatar + menú */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-surface-800 transition-colors"
                aria-label="Menú de usuario"
              >
                <span className="w-8 h-8 rounded-full overflow-hidden bg-brand-700/50 border border-brand-600/30 flex items-center justify-center shrink-0">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-brand-300">{initials}</span>
                  )}
                </span>
                <ChevronDown size={15} className="text-cream-muted hidden sm:block" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 z-40 bg-surface-850 border border-surface-700 rounded-xl shadow-xl py-1.5">
                    <div className="px-3 py-2 border-b border-surface-700 mb-1">
                      <p className="text-sm font-medium text-cream truncate">{userName}</p>
                      <p className="text-xs text-cream-muted">{primaryProduct?.title ?? 'Cliente'}</p>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-cream-dim hover:text-cream hover:bg-surface-800 transition-colors"
                    >
                      <User size={15} /> Mi perfil
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-cream-muted hover:text-red-400 hover:bg-red-500/10 transition-colors w-full"
                    >
                      <LogOut size={15} /> Cerrar sesión
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Contenido + sidebar derecho */}
        <div className="flex flex-1 min-w-0">
          <main className="flex-1 p-4 lg:p-8 min-w-0">{children}</main>

          {showRightRail && (
            <aside className="hidden xl:block w-72 shrink-0 p-6 border-l border-surface-700 space-y-4">
              {/* Mismas clases exactas que la tarjeta de Conversación
                  (Foro.tsx) — antes usaba w-80 + .card (p-6/p-5), un ancho y
                  padding distintos que hacían que el degradado se viera más
                  tenue aquí que allá (2026-07-09). */}
              <div className="rounded-2xl border border-surface-700 bg-surface-850 overflow-hidden">
                <div className="h-24 bg-gradient-to-br from-sand via-accent to-brand-600 flex items-center justify-center px-4">
                  {isSabiduria(primaryProduct!.title) ? (
                    <Image src="/logo-horizontal.png" alt={primaryProduct!.title} width={150} height={40} className="object-contain" />
                  ) : (
                    <p className="text-center text-lg font-semibold text-white leading-tight drop-shadow">
                      {productFullName(primaryProduct!.title)}
                    </p>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-sm font-semibold text-cream">{primaryProduct!.title}</p>
                  <p className="text-xs text-cream-muted mt-0.5">Comunidad privada</p>
                  <p className="text-xs text-cream-dim mt-3 leading-relaxed">
                    Tu espacio de la comunidad de {primaryProduct!.title}. Aquí verás tu
                    aprendizaje, eventos y tu ruta.
                  </p>
                </div>
              </div>
              {/* Banners de anuncios (2026-07-09) — apilados debajo, uno por
                  cada banner vigente. Sin espacio vacío si no hay ninguno. */}
              {banners}
            </aside>
          )}
        </div>
      </div>

      {/* ---------- Drawer móvil ---------- */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
      )}
      <aside
        className={clsx(
          'lg:hidden fixed inset-y-0 left-0 w-72 z-50 bg-surface-900 border-r border-surface-700 flex flex-col',
          'transition-transform duration-300 ease-in-out',
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-4 border-b border-surface-700 flex items-center justify-between">
          <Image src="/logo-horizontal.png" alt="Sabiduría Empresarial" width={138} height={36} className="object-contain" />
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-1.5 rounded-lg text-cream-muted hover:text-cream hover:bg-surface-800 transition-colors"
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        {products.length > 0 && (
          <div className="px-4 pt-4">
            <p className="section-label mb-2">Comunidad</p>
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-surface-850 border border-surface-700">
              <span className="w-6 h-6 rounded-lg bg-brand-700/40 border border-brand-600/30 flex items-center justify-center shrink-0 overflow-hidden">
                {isSabiduria(primaryProduct!.title)
                  ? <Image src="/logo-icon.png" alt={primaryProduct!.title} width={16} height={16} className="object-contain" />
                  : <span className="text-xs font-semibold text-brand-300">{productInitial(primaryProduct!.title)}</span>}
              </span>
              <span className="text-sm text-cream truncate">{primaryProduct!.title}</span>
            </div>
          </div>
        )}

        <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
          {TABS.map(t => {
            const active = t.match(pathname)
            return (
              <Link
                key={t.href}
                href={t.href}
                onClick={() => setDrawerOpen(false)}
                className={clsx(
                  'block px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  active
                    ? 'bg-brand-600/15 text-brand-400 border border-brand-600/25'
                    : 'text-cream-muted hover:text-cream hover:bg-surface-800'
                )}
              >
                {t.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-surface-700 space-y-0.5">
          <Link
            href="/profile"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-cream-muted hover:text-cream hover:bg-surface-800 transition-all"
          >
            <User size={15} /> Mi perfil
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-cream-muted hover:text-red-400 hover:bg-red-500/10 transition-all w-full"
          >
            <LogOut size={15} /> Cerrar sesión
          </button>
        </div>
      </aside>
    </div>
  )
}
