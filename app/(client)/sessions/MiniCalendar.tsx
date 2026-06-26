'use client'

import { useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  sessionDates: string[]
}

const DAYS = ['L', 'M', 'Mi', 'J', 'V', 'S', 'D']
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export default function MiniCalendar({ sessionDates }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const dates = new Set(sessionDates)
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const firstDay = new Date(year, month, 1)
  const startDow = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const prev = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const next = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const scrollToDate = useCallback((dateKey: string) => {
    const el = document.getElementById(`session-day-${dateKey}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prev} className="btn-ghost p-1.5"><ChevronLeft size={16} /></button>
        <p className="text-sm font-medium text-cream">{MONTHS[month]} {year}</p>
        <button onClick={next} className="btn-ghost p-1.5"><ChevronRight size={16} /></button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {DAYS.map(d => (
          <span key={d} className="text-xs text-cream-dim py-1">{d}</span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const hasSession = dates.has(key)
          const isToday = key === todayKey
          return (
            <button
              key={key}
              onClick={() => hasSession && scrollToDate(key)}
              disabled={!hasSession}
              className={`text-xs py-1.5 rounded-lg transition-colors ${
                isToday
                  ? 'bg-brand-600/20 text-brand-400 font-semibold'
                  : hasSession
                    ? 'bg-accent/15 text-accent font-medium hover:bg-accent/25 cursor-pointer'
                    : 'text-cream-dim'
              }`}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
