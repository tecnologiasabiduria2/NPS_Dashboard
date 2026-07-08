import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  // admin y owner (Diana) acceden al panel admin.
  if (profile?.role !== 'admin' && profile?.role !== 'owner') redirect('/dashboard')

  return (
    <div className="relative flex min-h-screen bg-surface-950 overflow-hidden lg:gap-4">
      {/* Atmósfera de fondo (mismo recurso que el login, app/(auth)/layout.tsx: degradado
          + glows borrosos en la paleta de marca) — antes admin era un fondo plano sin
          textura, pedido explícito de Juan (2026-07-05) de que "se note" más el front.
          Valores unificados con el cliente (CommunityShell.tsx) — antes tenían la misma
          intención pero números distintos (2026-07-09). */}
      <div
        className="pointer-events-none fixed inset-0 opacity-50"
        style={{ background: 'radial-gradient(1400px 900px at 85% -10%, #2A0E07 0%, transparent 55%)' }}
      />
      <div
        className="pointer-events-none fixed -top-40 -right-32 w-[560px] h-[560px] rounded-full opacity-[0.12] blur-3xl"
        style={{ background: 'radial-gradient(circle, #7E301F 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none fixed bottom-0 left-64 w-[420px] h-[420px] rounded-full opacity-[0.07] blur-3xl"
        style={{ background: 'radial-gradient(circle, #DA7D41 0%, transparent 70%)' }}
      />
      {/* Radial mesh adicional (2026-07-09): círculo grande, desenfoque extremo,
          casi invisible — profundidad extra sin competir con los 2 glows de arriba. */}
      <div
        className="pointer-events-none fixed top-1/3 left-1/4 w-[800px] h-[800px] rounded-full opacity-[0.025] blur-[120px]"
        style={{ background: 'radial-gradient(circle, #7E301F 0%, transparent 70%)' }}
      />

      <Sidebar role="admin" userName={profile?.full_name ?? user.email ?? ''} isOwner={profile?.role === 'owner'} />
      <main className="relative flex-1 p-4 lg:p-8 overflow-auto pt-16 lg:pt-8 min-w-0">{children}</main>
    </div>
  )
}
