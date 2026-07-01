'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// El paywall vive fuera del layout cliente, así que un inactivo quedaría sin
// salida. Este botón le permite cerrar sesión (o cambiar de cuenta).
export default function LogoutButton() {
  const router = useRouter()
  async function logout() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }
  return (
    <button
      onClick={logout}
      className="inline-flex items-center gap-1.5 text-xs text-cream-muted hover:text-cream transition-colors"
    >
      <LogOut size={13} /> Cerrar sesión
    </button>
  )
}
