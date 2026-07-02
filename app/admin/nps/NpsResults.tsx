'use client'

import { useMemo, useState } from 'react'

interface Resp {
  id: string
  score: number
  feedback?: string | null
  type: 'mejora_sesion' | 'interes_ascension'
  trigger: 'post_sesion' | 'semanal'
  hiperfoco_id?: string | null
  created_at: string
  profiles?: { full_name?: string } | null
  hiperfocos?: { title?: string; products?: { title?: string } | null } | null
}

const SIN = '__sin__'

function scoreColor(n: number) {
  return n >= 9 ? 'text-green-400' : n >= 7 ? 'text-amber-400' : 'text-red-400'
}

function barColor(avg: number) {
  return avg >= 9 ? 'bg-green-500' : avg >= 7 ? 'bg-amber-500' : 'bg-red-500'
}

export default function NpsResults({ responses }: { responses: Resp[] }) {
  const [hiperfocoFilter, setHiperfocoFilter] = useState('')

  // Etiqueta de hiperfoco por respuesta = "Título · Producto" (B16: separa hiperfocos
  // homónimos entre productos). Cae a "Sin hiperfoco" si no hay hiperfoco.
  function labelOf(r: Resp) {
    const title = r.hiperfocos?.title
    if (!title) return null
    const product = r.hiperfocos?.products?.title
    return product ? `${title} · ${product}` : title
  }

  // Agregación por hiperfoco (sobre TODAS las respuestas, no las filtradas).
  const byHiperfoco = useMemo(() => {
    const map = new Map<string, { label: string; sum: number; count: number }>()
    for (const r of responses) {
      const label = labelOf(r)
      const key = label ?? SIN
      const entry = map.get(key) ?? { label: label ?? 'Sin hiperfoco', sum: 0, count: 0 }
      entry.sum += r.score
      entry.count += 1
      map.set(key, entry)
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, label: v.label, avg: v.sum / v.count, count: v.count }))
      .sort((a, b) => b.avg - a.avg)
  }, [responses])

  const globalAvg = useMemo(() => {
    if (responses.length === 0) return null
    return Math.round((responses.reduce((s, r) => s + r.score, 0) / responses.length) * 10) / 10
  }, [responses])

  const hiperfocoOptions = useMemo(() => {
    const set = new Set<string>()
    let hasNull = false
    for (const r of responses) {
      const label = labelOf(r)
      if (label) set.add(label)
      else hasNull = true
    }
    const arr = Array.from(set).sort()
    return { titles: arr, hasNull }
  }, [responses])

  const filtered = useMemo(() => {
    let list = responses
    if (hiperfocoFilter === SIN) list = list.filter(r => !labelOf(r))
    else if (hiperfocoFilter) list = list.filter(r => labelOf(r) === hiperfocoFilter)
    return list
  }, [responses, hiperfocoFilter])

  const filteredAvg = useMemo(() => {
    if (filtered.length === 0) return null
    return Math.round((filtered.reduce((s, r) => s + r.score, 0) / filtered.length) * 10) / 10
  }, [filtered])

  if (responses.length === 0) {
    return <div className="card text-center text-zinc-500">Sin respuestas NPS aún</div>
  }

  return (
    <div className="space-y-8">
      {/* Resumen: global + por hiperfoco */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-cream">NPS por hiperfoco</h2>
          {globalAvg !== null && (
            <div className="text-right">
              <span className="text-2xl font-bold text-brand-400">{globalAvg}</span>
              <span className="text-xs text-zinc-500 ml-2">global · {responses.length} resp.</span>
            </div>
          )}
        </div>
        <div className="space-y-3">
          {byHiperfoco.map(h => (
            <div key={h.key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={h.key === SIN ? 'text-zinc-500 italic' : 'text-cream-dim'}>{h.label}</span>
                <span className="text-zinc-500">
                  <span className={`font-bold ${scoreColor(h.avg)}`}>{Math.round(h.avg * 10) / 10}</span>
                  {' · '}{h.count} resp.
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
                <div className={`h-full rounded-full ${barColor(h.avg)}`} style={{ width: `${(h.avg / 10) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <select className="select w-auto" value={hiperfocoFilter} onChange={e => setHiperfocoFilter(e.target.value)}>
          <option value="">Todos los hiperfocos</option>
          {hiperfocoOptions.hasNull && <option value={SIN}>Sin hiperfoco</option>}
          {hiperfocoOptions.titles.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {hiperfocoFilter && filteredAvg !== null && (
          <span className="text-xs text-zinc-500">
            Promedio filtrado: <span className={`font-bold ${scoreColor(filteredAvg)}`}>{filteredAvg}</span>
            {' · '}{filtered.length} resp.
          </span>
        )}
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {filtered.map(r => (
          <div key={r.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-cream">{r.profiles?.full_name ?? '—'}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {labelOf(r) ?? <span className="italic">Sin hiperfoco</span>}
                  {' · '}
                  {new Date(r.created_at).toLocaleDateString('es-CO')}
                </p>
              </div>
              <div className={`text-lg font-bold ${scoreColor(r.score)}`}>{r.score}/10</div>
            </div>
            {r.feedback && (
              <p className="text-sm text-zinc-400 mt-3 bg-surface-800 rounded-lg px-3 py-2">"{r.feedback}"</p>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card text-center text-sm text-zinc-600">No hay respuestas que coincidan.</div>
        )}
      </div>
    </div>
  )
}
