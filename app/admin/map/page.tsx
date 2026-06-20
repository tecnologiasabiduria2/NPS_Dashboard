import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function MapPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: clients } = await supabase
    .from('user_access')
    .select('user_id, status, access_until, products(title, slug), modules(title, order), profiles(full_name)')
    .order('created_at', { ascending: false })

  const byProduct = {
    workshop:  (clients ?? []).filter((c: any) => c.products?.slug === 'workshop'),
    desafio:   (clients ?? []).filter((c: any) => c.products?.slug === 'desafio'),
    sabiduria: (clients ?? []).filter((c: any) => c.products?.slug === 'sabiduria'),
  }

  function ClientCard({ client }: { client: any }) {
    const expired = client.access_until && client.access_until < today
    const noDate = !client.access_until
    return (
      <Link href={`/admin/clients/${client.user_id}`}>
        <div className="bg-surface-800 hover:bg-surface-700 border border-surface-700 rounded-lg p-3 transition-colors">
          <p className="text-sm font-medium text-zinc-200 truncate">{client.profiles?.full_name ?? '—'}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{client.modules?.title ?? 'Sin módulo'}</p>
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
      <h1 className="text-2xl font-bold text-zinc-100 mb-8">Mapa de clientes</h1>
      <div className="grid grid-cols-3 gap-6">
        {([['Workshop', byProduct.workshop], ['Desafío', byProduct.desafio], ['Sabiduría', byProduct.sabiduria]] as const).map(([label, items]) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-300">{label}</h2>
              <span className="text-xs text-zinc-500 bg-surface-800 px-2 py-0.5 rounded-full">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.length === 0
                ? <p className="text-xs text-zinc-600 text-center py-4">Sin clientes</p>
                : (items as any[]).map((c: any) => <ClientCard key={c.user_id} client={c} />)
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
