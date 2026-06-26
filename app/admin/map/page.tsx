import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function periodoActual() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

export default async function MapPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const periodo = periodoActual()

  const [{ data: clients }, { data: hiperfocosMes }] = await Promise.all([
    supabase
      .from('user_access')
      .select('user_id, status, access_until, products(title, slug), profiles(full_name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('user_hiperfoco_mes')
      .select('user_id, hiperfocos(title)')
      .eq('periodo', periodo),
  ])

  const hiperfocoByUser = new Map<string, string>(
    ((hiperfocosMes ?? []) as any[]).map(h => [h.user_id, (h.hiperfocos as any)?.title ?? ''])
  )

  const byProduct = {
    workshop:  (clients ?? []).filter((c: any) => c.products?.slug === 'workshop'),
    desafio:   (clients ?? []).filter((c: any) => c.products?.slug === 'desafio'),
    sabiduria: (clients ?? []).filter((c: any) => c.products?.slug === 'sabiduria'),
  }

  function ClientCard({ client }: { client: any }) {
    const expired = client.access_until && client.access_until < today
    const noDate = !client.access_until
    const hiperfoco = hiperfocoByUser.get(client.user_id)
    return (
      <Link href={`/admin/clients/${client.user_id}`}>
        <div className="bg-surface-800 hover:bg-surface-700 border border-surface-700 rounded-lg p-3 transition-colors">
          <p className="text-sm font-medium text-cream truncate">{client.profiles?.full_name ?? '—'}</p>
          <p className="text-xs text-cream-muted mt-0.5 truncate">
            {hiperfoco || 'Sin hiperfoco'}
          </p>
          <div className="mt-2">
            {client.status === 'inactive' && <span className="badge-inactive">Inactivo</span>}
            {client.status === 'active' && noDate && <span className="badge-warning">Sin fecha</span>}
            {client.status === 'active' && expired && <span className="badge-inactive">Vencido</span>}
            {client.status === 'active' && !noDate && !expired && <span className="badge-active">Activo</span>}
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-cream mb-8">Mapa de clientes</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {([['Workshop', byProduct.workshop], ['Desafío', byProduct.desafio], ['Sabiduría', byProduct.sabiduria]] as const).map(([label, items]) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-cream-dim">{label}</h2>
              <span className="text-xs text-cream-muted bg-surface-800 px-2 py-0.5 rounded-full">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.length === 0
                ? <p className="text-xs text-cream-muted text-center py-4">Sin clientes</p>
                : (items as any[]).map((c: any) => <ClientCard key={c.user_id} client={c} />)
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
