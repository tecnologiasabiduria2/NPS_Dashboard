'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'

export interface CalendarEvent {
  date: string // ISO (starts_at)
  label: string
  tipo: string
}

const DOW = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

// Color del chip por tipo de sesión (SG azul, EC naranja, resto ámbar/marca).
function chipClass(tipo: string) {
  if (tipo === 'sala_gerencia') return 'bg-blue-600/80 text-white'
  if (tipo === 'entrenamiento_comercial') return 'bg-orange-600/80 text-white'
  if (tipo === 'mentoria') return 'bg-brand-600/80 text-white'
  return 'bg-accent/80 text-surface-950'
}

function dayKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function MonthCalendar({ events }: { events: CalendarEvent[] }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const todayKey = dayKey(today.getFullYear(), today.getMonth(), today.getDate())

  // Eventos por día
  const byDay = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    const d = new Date(e.date)
    const k = dayKey(d.getFullYear(), d.getMonth(), d.getDate())
    if (!byDay.has(k)) byDay.set(k, [])
    byDay.get(k)!.push(e)
  }

  const startDow = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const prev = () => (month === 0 ? (setMonth(11), setYear(y => y - 1)) : setMonth(m => m - 1))
  const next = () => (month === 11 ? (setMonth(0), setYear(y => y + 1)) : setMonth(m => m + 1))
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()) }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-lg font-semibold text-cream capitalize">{MONTHS[month]} {year}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={goToday} className="btn-secondary py-1.5 px-3 text-xs">Hoy</button>
          <button onClick={prev} className="btn-ghost p-1.5" aria-label="Mes anterior"><ChevronLeft size={16} /></button>
          <button onClick={next} className="btn-ghost p-1.5" aria-label="Mes siguiente"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-surface-700 rounded-lg overflow-hidden border border-surface-700">
        {DOW.map(d => (
          <div key={d} className="bg-surface-900 text-[10px] font-medium text-cream-muted text-center py-1.5">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} className="bg-surface-900/40 min-h-[76px]" />
          const k = dayKey(year, month, day)
          const dayEvents = byDay.get(k) ?? []
          const isToday = k === todayKey
          return (
            <div key={k} className={clsx('bg-surface-850 min-h-[76px] p-1.5 flex flex-col gap-1', isToday && 'ring-1 ring-inset ring-accent/50')}>
              <span className={clsx('text-[11px]', isToday ? 'text-accent font-semibold' : 'text-cream-dim')}>{day}</span>
              {dayEvents.slice(0, 3).map((e, idx) => (
                <span key={idx} className={clsx('text-[10px] leading-tight rounded px-1 py-0.5 truncate', chipClass(e.tipo))} title={e.label}>
                  {new Date(e.date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} {e.label}
                </span>
              ))}
              {dayEvents.length > 3 && (
                <span className="text-[10px] text-cream-muted">+{dayEvents.length - 3} más</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
