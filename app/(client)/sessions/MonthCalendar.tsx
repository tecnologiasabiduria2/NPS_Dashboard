'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, X, Clock, ArrowRight, AlignLeft } from 'lucide-react'
import { clsx } from 'clsx'
import { formatCOTime, formatCODateLong } from '@/lib/format'

export interface CalendarEvent {
  id: string
  date: string // ISO (starts_at)
  endsAt: string
  label: string // tipo legible
  subtitle?: string // título de la sesión
  tipo: string
  descripcion?: string | null
  joinHref: string
  pending?: boolean // link aún no asignado (sesión variable)
}

const DOW = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function chipClass(tipo: string) {
  if (tipo === 'sala_gerencia') return 'bg-blue-600/80 text-white'
  if (tipo === 'entrenamiento_comercial') return 'bg-orange-600/80 text-white'
  if (tipo === 'mentoria') return 'bg-brand-600/80 text-white'
  return 'bg-accent/80 text-surface-950'
}

function dayKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const timeFmt = (iso: string) => formatCOTime(iso)

export default function MonthCalendar({ events }: { events: CalendarEvent[] }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState<CalendarEvent | null>(null)

  const todayKey = dayKey(today.getFullYear(), today.getMonth(), today.getDate())

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

  const isPast = selected ? new Date(selected.endsAt).getTime() < Date.now() : false

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-lg font-semibold text-cream capitalize">{MONTHS[month]} {year}</p>
          <p className="text-[11px] text-cream-muted">Horarios en hora Colombia</p>
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
              {dayEvents.slice(0, 3).map(e => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setSelected(e)}
                  className={clsx('text-[10px] leading-tight rounded px-1 py-0.5 truncate text-left w-full hover:brightness-110 transition', chipClass(e.tipo))}
                  title={e.label}
                >
                  {timeFmt(e.date)} {e.label}
                </button>
              ))}
              {dayEvents.length > 3 && (
                <span className="text-[10px] text-cream-muted">+{dayEvents.length - 3} más</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal de detalle del evento */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-md card">
            <button onClick={() => setSelected(null)} className="absolute top-4 right-4 text-cream-muted hover:text-cream" aria-label="Cerrar">
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-medium', chipClass(selected.tipo))}>{selected.label}</span>
            </div>
            {selected.subtitle && <h3 className="text-lg font-semibold text-cream leading-snug mb-3">{selected.subtitle}</h3>}

            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2 text-cream-dim">
                <Clock size={15} className="text-cream-muted shrink-0" />
                <span>
                  {formatCODateLong(selected.date)}
                  {' · '}{timeFmt(selected.date)}–{timeFmt(selected.endsAt)}
                  <span className="text-cream-muted"> (hora Colombia)</span>
                </span>
              </div>
              <div className="flex items-start gap-2 text-cream-dim">
                <AlignLeft size={15} className="text-cream-muted shrink-0 mt-0.5" />
                {selected.descripcion
                  ? <p className="whitespace-pre-wrap">{selected.descripcion}</p>
                  : <p className="italic text-cream-muted">El anfitrión no agregó una descripción.</p>}
              </div>
            </div>

            {!isPast && selected.pending ? (
              <div className="w-full justify-center mt-5 btn-secondary opacity-70 pointer-events-none flex items-center gap-1.5">
                <Clock size={14} /> Link próximamente
              </div>
            ) : (
              <a
                href={selected.joinHref}
                target="_blank"
                rel="noopener noreferrer"
                className={clsx('w-full justify-center mt-5', isPast ? 'btn-secondary opacity-60 pointer-events-none' : 'btn-primary')}
              >
                {isPast ? 'Sesión finalizada' : <>Unirme <ArrowRight size={14} /></>}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
