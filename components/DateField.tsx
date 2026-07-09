'use client'

import { useEffect, useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, subMonths, isSameDay, isSameMonth, isToday, format,
} from 'date-fns'
import { es } from 'date-fns/locale'

type Mode = 'date' | 'datetime'

interface Props {
  value: string // 'YYYY-MM-DD' (mode='date') o 'YYYY-MM-DDTHH:mm' (mode='datetime')
  onChange: (value: string) => void
  mode?: Mode
  required?: boolean
  placeholder?: string
  className?: string
}

// 'YYYY-MM-DD' -> Date en medianoche LOCAL (nunca `new Date(string)`: se
// interpreta en UTC y retrocede un día en zonas detrás de UTC — mismo bug
// documentado en lib/format.ts).
function parseDateOnly(datePart: string): Date | null {
  if (!datePart) return null
  const [y, m, d] = datePart.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function toDateOnlyString(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export default function DateField({
  value, onChange, mode = 'date', required, placeholder = 'Sin definir', className = '',
}: Props) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => new Date())
  const wrapRef = useRef<HTMLDivElement>(null)

  const [datePart, timePart] = value ? value.split('T') : ['', '']
  const selected = parseDateOnly(datePart)
  const hh = (timePart ?? '').split(':')[0] || '00'
  const mm = (timePart ?? '').split(':')[1] || '00'

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function toggleOpen() {
    setOpen(o => {
      if (!o) setViewMonth(selected ?? new Date())
      return !o
    })
  }

  function pickDay(d: Date) {
    if (mode === 'date') {
      onChange(toDateOnlyString(d))
      setOpen(false)
    } else {
      onChange(`${toDateOnlyString(d)}T${hh}:${mm}`)
      // Se queda abierto para ajustar la hora.
    }
  }

  function commitTime(nextHH: string, nextMM: string) {
    const base = selected ?? new Date()
    onChange(`${toDateOnlyString(base)}T${nextHH}:${nextMM}`)
  }

  function handleTimeInput(raw: string, kind: 'hh' | 'mm') {
    const digits = raw.replace(/\D/g, '').slice(0, 2)
    if (digits === '') return
    const n = clamp(Number(digits), 0, kind === 'hh' ? 23 : 59)
    const padded = String(n).padStart(2, '0')
    commitTime(kind === 'hh' ? padded : hh, kind === 'mm' ? padded : mm)
  }

  const label = !selected
    ? placeholder
    : mode === 'datetime'
      ? `${format(selected, 'd MMM', { locale: es })}, ${hh}:${mm}`
      : format(selected, 'd MMM yyyy', { locale: es })

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 }),
  })

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <button
        type="button"
        onClick={toggleOpen}
        className="input flex items-center gap-2 text-left cursor-pointer"
      >
        <Calendar size={15} className="text-cream-muted shrink-0" />
        <span className={selected ? 'text-cream' : 'text-cream-muted'}>{label}</span>
        {selected && !required && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Limpiar fecha"
            onClick={e => { e.stopPropagation(); onChange('') }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onChange('') } }}
            className="ml-auto text-cream-muted hover:text-cream p-0.5 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-600/50"
          >
            <X size={14} />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-2 w-72 bg-surface-850 border border-surface-700 rounded-2xl p-4 shadow-xl shadow-black/30">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setViewMonth(m => subMonths(m, 1))}
              className="p-1.5 rounded-lg text-cream-muted hover:bg-surface-700 hover:text-cream focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-600/50"
              aria-label="Mes anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <p className="text-sm font-medium text-cream capitalize">
              {format(viewMonth, 'MMMM yyyy', { locale: es })}
            </p>
            <button
              type="button"
              onClick={() => setViewMonth(m => addMonths(m, 1))}
              className="p-1.5 rounded-lg text-cream-muted hover:bg-surface-700 hover:text-cream focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-600/50"
              aria-label="Mes siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-cream-muted mb-1 uppercase tracking-wide">
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <span key={d}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map(d => {
              const inMonth = isSameMonth(d, viewMonth)
              const isSel = selected ? isSameDay(d, selected) : false
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => pickDay(d)}
                  className={[
                    'h-8 w-8 rounded-lg text-sm flex items-center justify-center transition-colors',
                    'focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-600/50',
                    isSel
                      ? 'bg-brand-600 text-cream font-medium'
                      : isToday(d)
                        ? 'ring-1 ring-brand-600/50 text-cream'
                        : inMonth
                          ? 'text-cream-dim hover:bg-surface-700'
                          : 'text-cream-muted/40 hover:bg-surface-800',
                  ].join(' ')}
                >
                  {format(d, 'd')}
                </button>
              )
            })}
          </div>

          {mode === 'datetime' && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-700">
              <span className="text-xs text-cream-muted mr-1">Hora</span>
              <input
                type="text" inputMode="numeric" value={hh}
                onChange={e => handleTimeInput(e.target.value, 'hh')}
                className="input w-12 text-center py-1.5 px-1"
                aria-label="Hora"
              />
              <span className="text-cream-muted">:</span>
              <input
                type="text" inputMode="numeric" value={mm}
                onChange={e => handleTimeInput(e.target.value, 'mm')}
                className="input w-12 text-center py-1.5 px-1"
                aria-label="Minuto"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
