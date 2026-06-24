import { createClient } from '@/lib/supabase/server'
import ClientsTable from './ClientsTable'

export default async function ClientsPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const soonDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: clients } = await supabase
    .from('user_access')
    .select('user_id, status, access_until, last_activity, profiles(full_name, phone), products(title, slug)')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Clientes</h1>
        <span className="text-sm text-zinc-500">{clients?.length ?? 0} registros</span>
      </div>
      <ClientsTable clients={clients ?? []} today={today} soonDate={soonDate} />
    </div>
  )
}
