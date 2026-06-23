'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LayoutDashboard, Map, BookOpen, User, LogOut, Users, BarChart2, FileText, UserPlus, CalendarClock } from 'lucide-react'
import { clsx } from 'clsx'
import Logo from './Logo'

interface SidebarProps {
  role: 'client' | 'admin'
  userName: string
  productTitle?: string
}

const clientLinks = [
  { href: '/dashboard',  label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/roadmap',    label: 'Hoja de ruta',  icon: Map },
  { href: '/profile',    label: 'Mi perfil',     icon: User },
]

const adminLinks = [
  { href: '/admin/dashboard', label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/admin/map',       label: 'Mapa clientes',   icon: Map },
  { href: '/admin/clients',   label: 'Clientes',        icon: Users },
  { href: '/admin/content',   label: 'Contenido',       icon: FileText },
  { href: '/admin/sessions',  label: 'Sesiones',        icon: CalendarClock },
  { href: '/admin/nps',       label: 'NPS',             icon: BarChart2 },
]

export default function Sidebar({ role, userName, productTitle }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const links = role === 'admin' ? adminLinks : clientLinks
  const initials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href === '/dashboard' || href === '/admin/dashboard') return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-64 min-h-screen bg-surface-900 border-r border-surface-700 flex flex-col shrink-0">
      {/* Header */}
      <div className="p-5 border-b border-surface-700">
        <div className="flex items-center gap-3">
          <Logo size={30} />
          <div className="min-w-0">
            <p className="text-cream text-xs font-semibold tracking-widest uppercase leading-tight">Sabiduría</p>
            <p className="text-cream-muted text-xs tracking-widest uppercase leading-tight">Empresarial</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-0.5">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
              isActive(href)
                ? 'bg-brand-600/15 text-brand-400 border border-brand-600/25'
                : 'text-cream-muted hover:text-cream hover:bg-surface-800'
            )}
          >
            <Icon size={16} strokeWidth={isActive(href) ? 2 : 1.5} />
            {label}
          </Link>
        ))}

        {role === 'admin' && (
          <>
            <div className="divider" />
            <Link href="/admin/clients/create"
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive('/admin/clients/create')
                  ? 'bg-brand-600/15 text-brand-400 border border-brand-600/25'
                  : 'text-cream-muted hover:text-cream hover:bg-surface-800'
              )}
            >
              <UserPlus size={16} strokeWidth={1.5} />
              Crear cliente
            </Link>
          </>
        )}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-surface-700">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-brand-700/50 border border-brand-600/30 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-brand-300">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-cream truncate">{userName}</p>
            <p className="text-xs text-cream-muted">{role === 'admin' ? 'Administrador' : productTitle ?? 'Cliente'}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-cream-muted hover:text-red-400 hover:bg-red-500/10 transition-all w-full"
        >
          <LogOut size={14} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
