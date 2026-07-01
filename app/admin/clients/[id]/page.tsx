import { createClient } from '@/lib/supabase/server'
import { formatDateOnly, formatMonthShort } from '@/lib/format'
import { notFound } from 'next/navigation'
import { Flag, Star, Play } from 'lucide-react'
import BackLink from '@/components/BackLink'
import Timeline from '@/components/Timeline'
import { buildTimeline } from '@/lib/timeline'
import EditAccessForm from './EditAccessForm'
import AddNoteForm from './AddNoteForm'
import AddCsNoteForm from './AddCsNoteForm'
import HiperfocoActions from './HiperfocoActions'
import FlagsList from './FlagsList'

interface Props {
  params: Promise<{ id: string }>
}

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

// Color del NPS según el puntaje (1–10).
function npsColor(score: number) {
  if (score >= 9) return 'text-emerald-400'
  if (score >= 7) return 'text-amber-400'
  return 'text-red-400'
}

// Meses transcurridos entre una fecha-solo 'YYYY-MM-DD' y hoy.
function mesesDesde(value: string | null | undefined): number | null {
  if (!value) return null
  const [y, m] = value.split('-').map(Number)
  if (!y || !m) return null
  const now = new Date()
  return Math.max(0, (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m))
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: profile }, { data: access }, { data: notes }] = await Promise.all([
    supabase.from('profiles').select('full_name, phone, created_at').eq('id', id).single(),
    supabase.from('user_access').select('*, products(title, slug)').eq('user_id', id).single(),
    supabase.from('coaching_notes').select('*, profiles!admin_id(full_name)').eq('user_id', id).order('session_date', { ascending: false }),
  ])

  if (!profile) notFound()

  const productId: string | null = (access as any)?.product_id ?? null

  // Capa de hiperfoco / CS — todo depende del producto activo del cliente.
  const [
    { data: historialRaw },
    { data: attendanceRaw },
    { data: npsRaw },
    { data: catalogo },
    { data: flags },
    { data: csNotes },
  ] = await Promise.all([
    supabase
      .from('user_hiperfoco_mes')
      .select('periodo, estado, hiperfoco_id, hiperfocos(title)')
      .eq('user_id', id)
      .order('periodo', { ascending: false }),
    productId
      ? supabase
          .from('live_session_attendance')
          .select('live_sessions!inner(title, starts_at, product_id)')
          .eq('user_id', id)
          .eq('live_sessions.product_id', productId)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('nps_responses').select('score, created_at, hiperfocos(title)').eq('user_id', id),
    productId
      ? supabase.from('hiperfocos').select('id, title').eq('product_id', productId).eq('is_active', true).order('order')
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from('client_flags')
      .select('id, type, reason, created_at')
      .eq('user_id', id)
      .eq('status', 'abierta')
      .order('created_at', { ascending: false }),
    supabase
      .from('cs_internal_notes')
      .select('*, profiles!author_id(full_name)')
      .eq('user_id', id)
      .order('note_date', { ascending: false }),
  ])

  // Meses con asistencia (clave 'YYYY-MM' del inicio de la sesión).
  const mesesAsistidos = new Set<string>(
    ((attendanceRaw as any[]) ?? [])
      .map(a => (a.live_sessions?.starts_at as string | undefined)?.slice(0, 7))
      .filter(Boolean) as string[]
  )

  // NPS por mes (clave 'YYYY-MM'); si hay varias respuestas en el mes, gana la más reciente.
  const npsPorMes = new Map<string, number>()
  for (const r of (((npsRaw as any[]) ?? []).slice().sort(
    (a, b) => String(a.created_at).localeCompare(String(b.created_at))
  ))) {
    const key = String(r.created_at).slice(0, 7)
    npsPorMes.set(key, r.score)
  }

  // Historial enriquecido + cálculo de "repitió" (mismo hiperfoco que el mes anterior).
  const historial = ((historialRaw as any[]) ?? []).map((row, i, arr) => {
    const mesKey = String(row.periodo).slice(0, 7)
    const prev = arr[i + 1] // el siguiente en orden desc = mes anterior
    return {
      periodo: row.periodo as string,
      estado: row.estado as string,
      title: row.hiperfocos?.title ?? null,
      asistio: mesesAsistidos.has(mesKey),
      nps: npsPorMes.get(mesKey) ?? null,
      repitio: Boolean(row.hiperfoco_id) && prev?.hiperfoco_id === row.hiperfoco_id,
    }
  })

  // Hoja de vida (timeline): fusiona inicio + hiperfocos + sesiones + 1:1 + NPS + banderas.
  const timeline = buildTimeline({
    inicio: (access as any)?.access_started ?? profile.created_at,
    hiperfocos: ((historialRaw as any[]) ?? []).map(r => ({
      periodo: r.periodo, title: r.hiperfocos?.title ?? null, estado: r.estado,
    })),
    sesiones: ((attendanceRaw as any[]) ?? []).map(a => ({
      date: a.live_sessions?.starts_at, title: a.live_sessions?.title ?? 'Sesión en vivo',
    })),
    unoAuno: ((notes as any[]) ?? []).map(n => ({
      date: n.session_date, content: n.content, fathomShareId: n.fathom_share_id,
    })),
    nps: ((npsRaw as any[]) ?? []).map(n => ({
      date: n.created_at, score: n.score, hiperfoco: n.hiperfocos?.title ?? null,
    })),
    flags: ((flags as any[]) ?? []).map(f => ({ date: f.created_at, type: f.type, reason: f.reason })),
  })

  // Badge "repite X N veces": hiperfoco más repetido en el historial (>=2).
  const conteo: Record<string, number> = {}
  for (const h of historial) if (h.title) conteo[h.title] = (conteo[h.title] ?? 0) + 1
  const masRepetido = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0]
  const repiteBadge = masRepetido && masRepetido[1] >= 2 ? `repite ${masRepetido[0]} ${masRepetido[1]} veces` : null

  // Badge de NPS general (promedio de los meses con respuesta).
  const scores = [...npsPorMes.values()]
  const npsAvg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  const npsBadge = npsAvg === null ? null : npsAvg >= 8.5 ? 'alto' : npsAvg <= 6.5 ? 'bajo' : null

  const tieneCasoExito = ((flags as any[]) ?? []).some(f => f.type === 'caso_exito')
  const meses = mesesDesde((access as any)?.access_started ?? profile.created_at?.slice(0, 10))

  return (
    <div className="max-w-3xl">
      <BackLink />
      {/* Header + capa CS */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cream">{profile.full_name}</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {(access as any)?.products?.title ?? '—'}
            {meses !== null && <> · {meses} {meses === 1 ? 'mes' : 'meses'} contigo</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {tieneCasoExito && (
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300">
              <Star size={12} /> Caso de éxito
            </span>
          )}
          {repiteBadge && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300">{repiteBadge}</span>
          )}
          {npsBadge && (
            <span className={`text-xs px-2.5 py-1 rounded-full ${npsBadge === 'alto' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
              NPS {npsBadge}
            </span>
          )}
        </div>
      </div>

      {/* Control de acceso */}
      <div className="card mb-6">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Control de acceso</p>
        <EditAccessForm
          userId={id}
          currentDate={access?.access_until ?? ''}
          ghlContactId={access?.ghl_contact_id ?? ''}
          status={access?.status ?? 'pending'}
        />
      </div>

      {/* Hoja de vida (timeline) */}
      <div className="card mb-6">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-5">Hoja de vida</p>
        <Timeline events={timeline} />
      </div>

      {/* Hiperfocos */}
      <div className="card mb-6">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Hiperfocos</p>
        {historial.length === 0 ? (
          <p className="text-sm text-zinc-600">Sin hiperfocos registrados todavía.</p>
        ) : (
          <div className="flex flex-col">
            {historial.map((h, i) => (
              <div
                key={h.periodo}
                className={`grid grid-cols-[64px_1fr_auto_auto] gap-3 items-center py-2.5 text-sm ${
                  i < historial.length - 1 ? 'border-b border-surface-800' : ''
                }`}
              >
                <span className="text-xs text-zinc-500 capitalize">{formatMonthShort(h.periodo)}</span>
                <span className={h.title ? 'text-cream' : 'text-zinc-500'}>
                  {h.title ?? (h.estado === 'pausa' ? 'Pausa' : 'Sin asignar')}
                  {h.repitio && <span className="text-xs text-amber-400 ml-2">repitió</span>}
                </span>
                <span className="text-xs text-right">
                  {h.asistio ? <span className="text-emerald-400">asistió</span> : <span className="text-zinc-600">—</span>}
                </span>
                <span className="text-xs text-right w-14">
                  {h.nps !== null ? <span className={`font-medium ${npsColor(h.nps)}`}>NPS {h.nps}</span> : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seguimiento CS: banderas abiertas + acciones */}
      <div className="card mb-6">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4 inline-flex items-center gap-1.5">
          <Flag size={12} /> Seguimiento CS
        </p>
        <div className="mb-5">
          <FlagsList flags={(flags as any[]) ?? []} />
        </div>
        <HiperfocoActions userId={id} productId={productId} hiperfocos={(catalogo as any[]) ?? []} />
      </div>

      {/* Notas internas (CS) — no visibles para el cliente */}
      <div className="card mb-6">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Notas internas (CS)</p>
        <AddCsNoteForm userId={id} />
        {csNotes && csNotes.length > 0 ? (
          <div className="space-y-3">
            {(csNotes as any[]).map((note: any) => (
              <div key={note.id} className="bg-surface-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-500">{formatDateOnly(note.note_date)}</span>
                  <span className="text-xs text-zinc-600">{note.profiles?.full_name}</span>
                </div>
                <p className="text-sm text-cream-dim">{note.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-600">Sin notas internas aún.</p>
        )}
      </div>

      {/* Sesiones 1:1 (notas de coaching — visibles para el cliente según RLS) */}
      <div className="card">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Sesiones 1:1</p>
        <AddNoteForm userId={id} />
        {notes && notes.length > 0 ? (
          <div className="space-y-3">
            {notes.map((note: any) => (
              <div key={note.id} className="bg-surface-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-500">{formatDateOnly(note.session_date)}</span>
                  <span className="text-xs text-zinc-600">{note.profiles?.full_name}</span>
                </div>
                <p className="text-sm text-cream-dim whitespace-pre-wrap">{note.content}</p>
                {note.somai && (
                  <div className="mt-3 rounded-lg bg-surface-900/60 border border-surface-700 p-3">
                    <p className="text-[10px] text-cream-muted uppercase tracking-wide mb-1">Summary</p>
                    <p className="text-xs text-cream-dim whitespace-pre-wrap">{note.somai}</p>
                  </div>
                )}
                {note.fathom_share_id && WORKER_URL && (
                  <a
                    href={`${WORKER_URL}/player?id=${note.fathom_share_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 mt-3"
                  >
                    <Play size={12} /> Ver grabación 1:1
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-600">Sin sesiones 1:1 registradas aún.</p>
        )}
      </div>
    </div>
  )
}
