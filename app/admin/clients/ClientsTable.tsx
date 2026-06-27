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
  hiperfocoByUser: Map<string, string>
}

export default function ClientsTable({ clients, today, soonDate, hiperfocoByUser }: Props) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortMode>('default')
  const [hiperfocoFilter, setHiperfocoFilter] = useState('')
  const [productFilter, setProductFilter] = useState('')

  // Build unique hiperfoco options for the filter dropdown
  const hiperfocoOptions = useMemo(() => {
    const set = new Set<string>()
    for (const v of hiperfocoByUser.values()) if (v) set.add(v)
    return Array.from(set).sort()
  }, [hiperfocoByUser])

  // Build unique product options (slug → title) for the filter dropdown
  const productOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of clients) {
      const slug = c.products?.slug
      if (slug) map.set(slug, c.products?.title ?? slug)
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [clients])

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
    if (productFilter) {
      list = list.filter((c: any) => c.products?.slug === productFilter)
    }
    if (hiperfocoFilter === '__none__') {
      list = list.filter((c: any) => !hiperfocoByUser.get(c.user_id))
    } else if (hiperfocoFilter) {
      list = list.filter((c: any) => hiperfocoByUser.get(c.user_id) === hiperfocoFilter)
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
  }, [q, clients, sort, hiperfocoFilter, productFilter, hiperfocoByUser])

  function getBadge(client: any) {
    if (client.status === 'inactive') return <span className="badge-inactive">Inactivo</span>
    if (!client.access_until) return <span className="badge-warning">Sin fecha</span>
    if (client.access_until < today) return <span className="badge-inactive">Vencido</span>
    if (client.access_until <= soonDate) return <span className="badge-warning">Vence pronto</span>
    return <span className="badge-active">Activo</span>
  }

  return (
    <>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
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
          value={productFilter}
          onChange={e => setProductFilter(e.target.value)}
        >
          <option value="">Todos los programas</option>
          {productOptions.map(([slug, title]) => (
            <option key={slug} value={slug}>{title}</option>
          ))}
        </select>
        <select
          className="select w-auto"
          value={hiperfocoFilter}
          onChange={e => setHiperfocoFilter(e.target.value)}
        >
          <option value="">Todos los hiperfocos</option>
          <option value="__none__">Sin hiperfoco</option>
          {hiperfocoOptions.map(h => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
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
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-surface-700">
              <th className="text-left text-xs text-zinc-500 uppercase tracking-wider px-6 py-4">Cliente</th>
              <th className="text-left text-xs text-zinc-500 uppercase tracking-wider px-6 py-4">Programa</th>
              <th className="text-left text-xs text-zinc-500 uppercase tracking-wider px-4 py-4">Hiperfoco (mes)</th>
              <th className="text-left text-xs text-zinc-500 uppercase tracking-wider px-6 py-4">Vence</th>
              <th className="text-left text-xs text-zinc-500 uppercase tracking-wider px-6 py-4">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-800">
            {filtered.map((client: any) => {
              const hiperfoco = hiperfocoByUser.get(client.user_id)
              return (
                <tr key={client.user_id} className="hover:bg-surface-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/admin/clients/${client.user_id}`} className="hover:text-brand-400 transition-colors">
                      <p className="text-sm text-cream font-medium">{client.profiles?.full_name ?? '—'}</p>
                      <p className="text-xs text-zinc-500">{client.profiles?.phone ?? ''}</p>
                    </Link>
                  </td>
                  <td className="px-6 py-4"><p className="text-sm text-cream-dim">{client.products?.title ?? '—'}</p></td>
                  <td className="px-4 py-4">
                    {hiperfoco
                      ? <span className="text-xs px-2 py-0.5 bg-brand-600/20 text-brand-400 rounded-full">{hiperfoco}</span>
                      : <span className="text-xs text-zinc-600">—</span>
                    }
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-zinc-400">
                      {client.access_until ? formatDateOnly(client.access_until) : <span className="text-amber-400">—</span>}
                    </p>
                  </td>
                  <td className="px-6 py-4">{getBadge(client)}</td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-zinc-600">
                  No hay clientes que coincidan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </>
  )
}
