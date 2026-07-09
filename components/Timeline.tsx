import { Flag, Star, CalendarCheck, Target, MessageSquare, Gauge, Play, Award, Milestone } from 'lucide-react'
import { formatDateOnly } from '@/lib/format'
import type { TimelineEvent, TimelineKind, TimelineTone } from '@/lib/timeline'

const ICON: Record<TimelineKind, typeof Flag> = {
  inicio: Play,
  producto: Milestone,
  hiperfoco: Target,
  sesion: CalendarCheck,
  unoauno: MessageSquare,
  nps: Gauge,
  flag: Flag,
}

const TONE_DOT: Record<TimelineTone, string> = {
  default: 'bg-brand-600/40 text-brand-300',
  good: 'bg-emerald-500/20 text-emerald-300',
  warn: 'bg-amber-500/20 text-amber-300',
  bad: 'bg-red-500/20 text-red-300',
}

export default function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-cream-muted">Sin actividad registrada todavía.</p>
  }

  return (
    <ol className="relative border-l border-surface-700 ml-2">
      {events.map((e, i) => {
        const Icon = e.kind === 'flag' && e.tone === 'good'
          ? Star
          : e.kind === 'hiperfoco' && e.tone === 'good'
          ? Award
          : ICON[e.kind]
        const tone = TONE_DOT[e.tone ?? 'default']
        return (
          <li key={i} className="ml-5 pb-5 last:pb-0">
            <span className={`absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-surface-900 ${tone}`}>
              <Icon size={12} />
            </span>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-cream">{e.title}</p>
              <span className="text-xs text-cream-muted shrink-0">{formatDateOnly(e.date)}</span>
            </div>
            {e.detail && (
              <p className="text-xs text-cream-muted mt-0.5 line-clamp-2">{e.detail}</p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
