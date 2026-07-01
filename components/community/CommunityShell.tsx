'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Home, Bell, Menu, X, User, LogOut, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'

export interface ShellProduct {
  id: string
  title: string
  slug: string
}

interface CommunityShellProps {
  userName: string
  products: ShellProduct[]
  children: React.ReactNode
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

export default function CommunityShell({ userName, products, children }: CommunityShellProps) {
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
    return clsx(
      'px-3 h-12 inline-flex items-center text-sm font-medium border-b-2 -mb-px transition-colors',
      active
        ? 'text-cream border-accent'
        : 'text-cream-muted border-transparent hover:text-cream'
    )
  }

  return (
    <div className="flex min-h-screen bg-surface-950">
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
            <Image src="/logo-icon.png" alt={p.title} width={22} height={22} className="object-contain" />
          </Link>
        ))}
      </aside>

      {/* ---------- Columna principal ---------- */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 bg-surface-900 border-b border-surface-700 flex items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-xl text-cream-muted hover:text-cream hover:bg-surface-800 transition-colors"
              aria-label="Abrir menú"
            >
              <Menu size={20} />
            </button>
            <Image
              src="/logo-horizontal.png"
              alt="Sabiduría Empresarial"
              width={138}
              height={36}
              className="object-contain hidden sm:block"
              priority
            />
            <Image
              src="/logo-icon.png"
              alt="Sabiduría Empresarial"
              width={26}
              height={26}
              className="object-contain sm:hidden"
              priority
            />
          </div>

          <div className="flex items-center gap-1.5">
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
                <span className="w-8 h-8 rounded-full bg-brand-700/50 border border-brand-600/30 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-brand-300">{initials}</span>
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
        </header>

        {/* Pestañas (desktop) */}
        <nav className="hidden lg:flex items-center gap-1 px-4 h-12 bg-surface-900 border-b border-surface-700 sticky top-14 z-20 overflow-x-auto">
          {TABS.map(t => (
            <Link key={t.href} href={t.href} className={tabClass(t.match(pathname))}>
              {t.label}
            </Link>
          ))}
        </nav>

        {/* Contenido + sidebar derecho */}
        <div className="flex flex-1 min-w-0">
          <main className="flex-1 p-4 lg:p-8 min-w-0">{children}</main>

          {showRightRail && (
            <aside className="hidden xl:block w-80 shrink-0 p-6 border-l border-surface-700">
              <div className="card overflow-hidden p-0">
                <div className="h-24 bg-gradient-to-br from-sand via-accent to-brand-600 flex items-center justify-center">
                  <Image src="/logo-horizontal.png" alt={primaryProduct!.title} width={150} height={40} className="object-contain" />
                </div>
                <div className="p-5">
                  <p className="text-sm font-semibold text-cream">{primaryProduct!.title}</p>
                  <p className="text-xs text-cream-muted mt-0.5">Comunidad privada</p>
                  <p className="text-xs text-cream-dim mt-3 leading-relaxed">
                    Tu espacio de la comunidad de {primaryProduct!.title}. Aquí verás tu
                    aprendizaje, eventos y tu ruta.
                  </p>
                </div>
              </div>
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
              <Image src="/logo-icon.png" alt={primaryProduct!.title} width={20} height={20} className="object-contain" />
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
