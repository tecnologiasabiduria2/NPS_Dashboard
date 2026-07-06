import { createClient } from '@/lib/supabase/server'
import ClientsTable from './ClientsTable'

export default async function ClientsPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const soonDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const periodo = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`

  const [{ data: clients }, { data: hiperfocosMes }] = await Promise.all([
    supabase
      .from('user_access')
      .select('user_id, status, access_until, last_activity, profiles(full_name, phone), products(title, slug)')
      .order('created_at', { ascending: false }),
    supabase
      .from('user_hiperfoco_mes')
      .select('user_id, hiperfoco_id, hiperfocos(title)')
      .eq('periodo', periodo),
  ])

  const hiperfocoByUser = new Map<string, string>(
    ((hiperfocosMes ?? []) as any[]).map(h => [h.user_id, (h.hiperfocos as any)?.title ?? ''])
  )

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="page-title">Clientes</h1>
        <span className="text-sm text-cream-muted">{clients?.length ?? 0} registros</span>
      </div>
      <ClientsTable clients={clients ?? []} today={today} soonDate={soonDate} hiperfocoByUser={hiperfocoByUser} />
    </div>
  )
}
