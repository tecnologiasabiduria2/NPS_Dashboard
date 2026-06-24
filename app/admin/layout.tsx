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
    <div className="flex min-h-screen bg-surface-950">
      <Sidebar role="admin" userName={profile?.full_name ?? user.email ?? ''} />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
