import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Sidebar from '@/components/Sidebar'
import NpsModal from '@/components/NpsModal'
import { getNpsPrompt } from '@/lib/nps'

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  // admin y owner (Diana) no son clientes → al panel admin.
  if (profile?.role === 'admin' || profile?.role === 'owner') redirect('/admin/dashboard')

  // Verificar acceso activo
  const { data: access } = await supabase
    .from('user_access')
    .select('status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!access) redirect('/access-expired')

  // Actualizar last_activity (fire and forget)
  supabaseAdmin
    .from('user_access')
    .update({ last_activity: new Date().toISOString() })
    .eq('user_id', user.id)
    .then(() => {})

  // ¿Le corresponde al cliente el modal de NPS? (post-sesión o semanal)
  const npsPrompt = await getNpsPrompt(supabase, user.id)

  return (
    <div className="flex min-h-screen bg-surface-950">
      <Sidebar role="client" userName={profile?.full_name ?? user.email ?? ''} />
      <main className="flex-1 p-4 lg:p-8 overflow-auto pt-16 lg:pt-8 min-w-0">
        {children}
      </main>
      {npsPrompt && <NpsModal prompt={npsPrompt} />}
    </div>
  )
}
