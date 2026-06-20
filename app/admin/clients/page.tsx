import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ClientsPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const soonDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: clients } = await supabase
    .from('user_access')
    .select('user_id, status, access_until, last_activity, profiles(full_name, phone), products(title, slug), modules(title)')
    .order('created_at', { ascending: false })

  function getBadge(client: any) {
    if (client.status === 'inactive') return <span className="badge-inactive">Inactivo</span>
    if (!client.access_until) return <span className="badge-warning">Sin fecha</span>
    if (client.access_until < today) return <span className="badge-inactive">Vencido</span>
    if (client.access_until <= soonDate) return <span className="badge-warning">Vence pronto</span>
    return <span className="badge-active">Activo</span>
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Clientes</h1>
        <span className="text-sm text-zinc-500">{clients?.length ?? 0} registros</span>
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-700">
              <th className="text-left text-xs text-zinc-500 uppercase tracking-wider px-6 py-4">Cliente</th>
              <th className="text-left text-xs text-zinc-500 uppercase tracking-wider px-6 py-4">Programa</th>
              <th className="text-left text-xs text-zinc-500 uppercase tracking-wider px-6 py-4">Módulo actual</th>
              <th className="text-left text-xs text-zinc-500 uppercase tracking-wider px-6 py-4">Vence</th>
              <th className="text-left text-xs text-zinc-500 uppercase tracking-wider px-6 py-4">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-800">
            {(clients ?? []).map((client: any) => (
              <tr key={client.user_id} className="hover:bg-surface-800/50 transition-colors">
                <td className="px-6 py-4">
                  <Link href={`/admin/clients/${client.user_id}`} className="hover:text-brand-400 transition-colors">
                    <p className="text-sm text-zinc-200 font-medium">{client.profiles?.full_name ?? '—'}</p>
                    <p className="text-xs text-zinc-500">{client.profiles?.phone ?? ''}</p>
                  </Link>
                </td>
                <td className="px-6 py-4"><p className="text-sm text-zinc-300">{client.products?.title ?? '—'}</p></td>
                <td className="px-6 py-4"><p className="text-sm text-zinc-400">{client.modules?.title ?? '—'}</p></td>
                <td className="px-6 py-4">
                  <p className="text-sm text-zinc-400">
                    {client.access_until ? new Date(client.access_until).toLocaleDateString('es-CO') : <span className="text-amber-400">—</span>}
                  </p>
                </td>
                <td className="px-6 py-4">{getBadge(client)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
