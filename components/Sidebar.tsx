'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Map, User, LogOut, Users, BarChart2,
  FileText, UserPlus, CalendarClock, Gauge, Menu, X, Route, Briefcase,
} from 'lucide-react'
import { clsx } from 'clsx'
import Logo from './Logo'
import Image from 'next/image'

interface SidebarProps {
  role: 'client' | 'admin'
  userName: string
  productTitle?: string
  isOwner?: boolean
}

const clientLinks = [
  { href: '/dashboard',  label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/roadmap',    label: 'Mi contenido', icon: Map },
  { href: '/mi-ruta',    label: 'Mi ruta',      icon: Route },
  { href: '/sessions',   label: 'Sesiones',     icon: CalendarClock },
  { href: '/profile',    label: 'Mi perfil',    icon: User },
]

const adminLinks = [
  { href: '/admin/dashboard', label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/admin/map',       label: 'Mapa clientes', icon: Map },
  { href: '/admin/clients',   label: 'Clientes',      icon: Users },
  { href: '/admin/content',   label: 'Contenido',     icon: FileText },
  { href: '/admin/sessions',  label: 'Sesiones',      icon: CalendarClock },
  { href: '/admin/nps',       label: 'NPS',           icon: BarChart2 },
]

export default function Sidebar({ role, userName, productTitle, isOwner }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
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

  function linkClass(href: string) {
    return clsx(
      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
      isActive(href)
        ? 'bg-brand-600/15 text-brand-400 border border-brand-600/25'
        : 'text-cream-muted hover:text-cream hover:bg-surface-800'
    )
  }

  return (
    <>
      {/* Barra superior mobile */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-surface-900 border-b border-surface-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <Logo size={22} />
          <span className="text-cream text-xs font-bold tracking-widest uppercase">Sabiduría</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-xl text-cream-muted hover:text-cream hover:bg-surface-800 transition-colors"
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar (drawer en mobile, estático en desktop) */}
      <aside className={clsx(
        'fixed lg:static inset-y-0 left-0',
        'w-64 min-h-screen bg-surface-900 border-r border-surface-700',
        'flex flex-col shrink-0 z-50',
        'transition-transform duration-300 ease-in-out',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Header */}
        <div className="p-5 border-b border-surface-700 flex items-center justify-between">
          <div className="flex items-center">
            <Image
              src="/logo-horizontal.png"
              alt="Sabiduría Empresarial"
              width={148}
              height={40}
              className="object-contain"
              priority
            />
          </div>
          <button
            className="lg:hidden p-1.5 rounded-lg text-cream-muted hover:text-cream hover:bg-surface-800 transition-colors"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-0.5">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={linkClass(href)}>
              <Icon size={16} strokeWidth={isActive(href) ? 2 : 1.5} />
              {label}
            </Link>
          ))}

          {role === 'admin' && isOwner && (
            <>
              <Link href="/admin/360" onClick={() => setMobileOpen(false)} className={linkClass('/admin/360')}>
                <Gauge size={16} strokeWidth={isActive('/admin/360') ? 2 : 1.5} />
                Vista 360
              </Link>
              <Link href="/admin/comerciales" onClick={() => setMobileOpen(false)} className={linkClass('/admin/comerciales')}>
                <Briefcase size={16} strokeWidth={isActive('/admin/comerciales') ? 2 : 1.5} />
                Business Coach
              </Link>
            </>
          )}

          {role === 'admin' && (
            <>
              <div className="divider" />
              <Link href="/admin/clients/create" onClick={() => setMobileOpen(false)} className={linkClass('/admin/clients/create')}>
                <UserPlus size={16} strokeWidth={1.5} />
                Crear cliente
              </Link>
            </>
          )}
        </nav>

        {/* Usuario */}
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
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-cream-muted hover:text-red-400 hover:bg-red-500/10 transition-all w-full"
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}
