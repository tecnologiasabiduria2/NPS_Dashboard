'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { formatDateOnly } from '@/lib/format'

type SortMode = 'default' | 'vence_pronto' | 'vence_tarde'

interface Props {
  clients: any[]
  today: string
  soonDate: string
}

export default function ClientsTable({ clients, today, soonDate }: Props) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortMode>('default')

  const filtered = useMemo(() => {
    let list = clients
    const t = q.trim().toLowerCase()
    if (t) {
      list = list.filter((c: any) => {
        const name = (c.profiles?.full_name ?? '').toLowerCase()
        const phone = (c.profiles?.phone ?? '').toLowerCase()
        return name.includes(t) || phone.includes(t)
      })
    }
    if (sort === 'vence_pronto') {
      list = [...list].sort((a: any, b: any) => {
        const da = a.access_until ?? '9999-12-31'
        const db = b.access_until ?? '9999-12-31'
        return da.localeCompare(db)
      })
    } else if (sort === 'vence_tarde') {
      list = [...list].sort((a: any, b: any) => {
        const da = a.access_until ?? '0000-01-01'
        const db = b.access_until ?? '0000-01-01'
        return db.localeCompare(da)
      })
    }
    return list
  }, [q, clients, sort])

  function getBadge(client: any) {
    if (client.status === 'inactive') return <span className="badge-inactive">Inactivo</span>
    if (!client.access_until) return <span className="badge-warning">Sin fecha</span>
    if (client.access_until < today) return <span className="badge-inactive">Vencido</span>
    if (client.access_until <= soonDate) return <span className="badge-warning">Vence pronto</span>
    return <span className="badge-active">Activo</span>
  }

  return (
    <>
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Buscar por nombre o teléfono…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <select
          className="select w-auto"
          value={sort}
          onChange={e => setSort(e.target.value as SortMode)}
        >
          <option value="default">Ordenar: Recientes</option>
          <option value="vence_pronto">Vence pronto</option>
          <option value="vence_tarde">Vence tarde</option>
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-700">
              <th className="text-left text-xs text-zinc-500 uppercase tracking-wider px-6 py-4">Cliente</th>
              <th className="text-left text-xs text-zinc-500 uppercase tracking-wider px-6 py-4">Programa</th>
              <th className="text-left text-xs text-zinc-500 uppercase tracking-wider px-6 py-4">Vence</th>
              <th className="text-left text-xs text-zinc-500 uppercase tracking-wider px-6 py-4">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-800">
            {filtered.map((client: any) => (
              <tr key={client.user_id} className="hover:bg-surface-800/50 transition-colors">
                <td className="px-6 py-4">
                  <Link href={`/admin/clients/${client.user_id}`} className="hover:text-brand-400 transition-colors">
                    <p className="text-sm text-zinc-200 font-medium">{client.profiles?.full_name ?? '—'}</p>
                    <p className="text-xs text-zinc-500">{client.profiles?.phone ?? ''}</p>
                  </Link>
                </td>
                <td className="px-6 py-4"><p className="text-sm text-zinc-300">{client.products?.title ?? '—'}</p></td>
                <td className="px-6 py-4">
                  <p className="text-sm text-zinc-400">
                    {client.access_until ? formatDateOnly(client.access_until) : <span className="text-amber-400">—</span>}
                  </p>
                </td>
                <td className="px-6 py-4">{getBadge(client)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-zinc-600">
                  No hay clientes que coincidan con “{q}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
