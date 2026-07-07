'use client'

import { useMemo, useState } from 'react'
import NpsTrendChart from '@/components/admin/NpsTrendChart'

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
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function scoreColor(n: number) {
  return n >= 9 ? 'text-green-400' : n >= 7 ? 'text-amber-400' : 'text-red-400'
}

// Clave 'YYYY-MM' del mes actual desplazado `offset` meses (local).
function mesKey(offset = 0): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function NpsResults({ responses }: { responses: Resp[] }) {
  const [hiperfocoFilter, setHiperfocoFilter] = useState('')
  const [monthsWindow, setMonthsWindow] = useState<3 | 6>(6)

  // Etiqueta de hiperfoco por respuesta = "Título · Producto" (B16: separa hiperfocos
  // homónimos entre productos). Cae a "Sin hiperfoco" si no hay hiperfoco.
  function labelOf(r: Resp) {
    const title = r.hiperfocos?.title
    if (!title) return null
    const product = r.hiperfocos?.products?.title
    return product ? `${title} · ${product}` : title
  }

  // Meses de la ventana elegida (3 o 6), ascendente — más viejo primero.
  const meses = useMemo(
    () => Array.from({ length: monthsWindow }, (_, i) => mesKey(-(monthsWindow - 1) + i)),
    [monthsWindow]
  )
  const mesActual = meses[meses.length - 1]

  // Serie mensual global — para la gráfica grande (pedido de calibración 2026-07-06:
  // "que sea lo primero que se muestre", con selector de 3/6 meses).
  const globalTrend = useMemo(() => {
    const porMes = new Map<string, { sum: number; count: number }>()
    for (const r of responses) {
      const key = r.created_at.slice(0, 7)
      const d = porMes.get(key) ?? { sum: 0, count: 0 }
      d.sum += r.score
      d.count++
      porMes.set(key, d)
    }
    return meses.map(m => {
      const d = porMes.get(m)
      const mo = Number(m.split('-')[1])
      return { label: MES_CORTO[mo - 1], value: d ? Math.round((d.sum / d.count) * 10) / 10 : 0 }
    })
  }, [responses, meses])

  // Serie mensual completa por hiperfoco (calibración 2026-07-07 noche: "una
  // gráfica elaborada de verdad" en vez de mini-sparklines en cajas) — cada
  // hiperfoco con su propia serie {label, value} lista para NpsTrendChart, más
  // el conteo/promedio del mes actual para el desplegable y el resumen.
  const byHiperfoco = useMemo(() => {
    const porTitle = new Map<string, Map<string, { sum: number; count: number }>>()
    for (const r of responses) {
      const label = labelOf(r) ?? 'Sin hiperfoco'
      const key = r.created_at.slice(0, 7)
      if (!porTitle.has(label)) porTitle.set(label, new Map())
      const porMes = porTitle.get(label)!
      const d = porMes.get(key) ?? { sum: 0, count: 0 }
      d.sum += r.score
      d.count++
      porMes.set(key, d)
    }
    return Array.from(porTitle.entries())
      .map(([title, porMes]) => {
        const series = meses.map(m => {
          const d = porMes.get(m)
          const mo = Number(m.split('-')[1])
          return { label: MES_CORTO[mo - 1], value: d ? Math.round((d.sum / d.count) * 10) / 10 : 0 }
        })
        const actual = porMes.get(mesActual)
        return {
          title,
          avg: actual ? Math.round((actual.sum / actual.count) * 10) / 10 : 0,
          count: actual?.count ?? 0,
          series,
        }
      })
      .filter(row => row.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [responses, meses, mesActual])

  const [selectedHf, setSelectedHf] = useState('')
  const selectedRow = byHiperfoco.find(h => h.title === selectedHf) ?? byHiperfoco[0]

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
    return <div className="card text-center text-cream-muted">Sin respuestas NPS aún</div>
  }

  return (
    <div className="space-y-8">
      {/* NPS Global — lo primero que se ve, con selector de ventana (pedido de
          calibración 2026-07-06). El desglose por hiperfoco vive acá también
          (ya no se repite en Vista 360). */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-cream">NPS Global</h2>
          <select
            className="select w-auto text-xs"
            value={monthsWindow}
            onChange={e => setMonthsWindow(Number(e.target.value) as 3 | 6)}
          >
            <option value={3}>Últimos 3 meses</option>
            <option value={6}>Últimos 6 meses</option>
          </select>
        </div>
        <NpsTrendChart data={globalTrend} height={220} />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-cream">NPS por hiperfoco</h2>
          {byHiperfoco.length > 0 && (
            <select
              className="select w-auto text-xs"
              value={selectedRow?.title ?? ''}
              onChange={e => setSelectedHf(e.target.value)}
            >
              {byHiperfoco.map(h => (
                <option key={h.title} value={h.title}>{h.title}</option>
              ))}
            </select>
          )}
        </div>
        {selectedRow ? (
          <>
            <p className="text-xs text-cream-muted mb-2">
              Mes actual: <span className={`font-bold ${scoreColor(selectedRow.avg)}`}>{selectedRow.avg}</span> · {selectedRow.count} respuesta{selectedRow.count !== 1 ? 's' : ''}
            </p>
            <NpsTrendChart data={selectedRow.series} height={220} />
          </>
        ) : (
          <p className="text-sm text-cream-muted">Sin respuestas por hiperfoco todavía.</p>
        )}
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
          <span className="text-xs text-cream-muted">
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
                <p className="text-xs text-cream-muted mt-0.5">
                  {labelOf(r) ?? <span className="italic">Sin hiperfoco</span>}
                  {' · '}
                  {new Date(r.created_at).toLocaleDateString('es-CO')}
                </p>
              </div>
              <div className={`text-lg font-bold ${scoreColor(r.score)}`}>{r.score}/10</div>
            </div>
            {r.feedback && (
              <p className="text-sm text-cream-dim mt-3 bg-surface-800 rounded-lg px-3 py-2">"{r.feedback}"</p>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card text-center text-sm text-cream-muted">No hay respuestas que coincidan.</div>
        )}
      </div>
    </div>
  )
}
