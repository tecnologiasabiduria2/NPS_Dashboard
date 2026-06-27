// Construcción de la "hoja de vida" (timeline) del cliente a partir de sus datos.
// Lo usan tanto el detalle admin (incluye banderas) como la vista cliente (no).

export type TimelineKind = 'inicio' | 'hiperfoco' | 'sesion' | 'unoauno' | 'nps' | 'flag'
export type TimelineTone = 'default' | 'good' | 'warn' | 'bad'

export interface TimelineEvent {
  date: string // YYYY-MM-DD (para orden y display)
  kind: TimelineKind
  title: string
  detail?: string
  tone?: TimelineTone
}

export interface TimelineInputs {
  inicio?: string | null
  hiperfocos?: { periodo: string; title: string | null; estado: string }[]
  sesiones?: { date: string; title: string }[]
  unoAuno?: { date: string; content: string; fathomShareId?: string | null }[]
  nps?: { date: string; score: number; hiperfoco?: string | null }[]
  flags?: { date: string; type: string; reason?: string | null }[]
}

const d10 = (v: string) => String(v).slice(0, 10)

export function buildTimeline(input: TimelineInputs): TimelineEvent[] {
  const events: TimelineEvent[] = []

  if (input.inicio) {
    events.push({ date: d10(input.inicio), kind: 'inicio', title: 'Inicio en el programa' })
  }

  for (const h of input.hiperfocos ?? []) {
    if (!h.title) continue // pausa / sin asignar no son hitos del timeline
    events.push({
      date: d10(h.periodo),
      kind: 'hiperfoco',
      title: `Hiperfoco: ${h.title}`,
      detail: h.estado === 'cerrado' ? 'cerrado' : h.estado === 'en_curso' ? 'en curso' : undefined,
    })
  }

  for (const s of input.sesiones ?? []) {
    events.push({ date: d10(s.date), kind: 'sesion', title: 'Asistió a sesión', detail: s.title, tone: 'good' })
  }

  for (const u of input.unoAuno ?? []) {
    events.push({
      date: d10(u.date),
      kind: 'unoauno',
      title: 'Sesión 1:1',
      detail: u.content,
    })
  }

  for (const n of input.nps ?? []) {
    events.push({
      date: d10(n.date),
      kind: 'nps',
      title: `NPS ${n.score}/10`,
      detail: n.hiperfoco ?? undefined,
      tone: n.score >= 9 ? 'good' : n.score >= 7 ? 'warn' : 'bad',
    })
  }

  for (const f of input.flags ?? []) {
    const esCaso = f.type === 'caso_exito'
    events.push({
      date: d10(f.date),
      kind: 'flag',
      title: esCaso ? 'Caso de éxito' : 'Bandera levantada',
      detail: f.reason ?? undefined,
      tone: esCaso ? 'good' : 'bad',
    })
  }

  // Orden cronológico descendente (más reciente arriba).
  return events.sort((a, b) => b.date.localeCompare(a.date))
}
