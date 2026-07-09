import { createClient } from '@/lib/supabase/server'
import { formatDateOnly, mesesDesde } from '@/lib/format'
import { Play } from 'lucide-react'
import Timeline from '@/components/Timeline'
import Sparkline from '@/components/Sparkline'
import { buildTimeline } from '@/lib/timeline'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

export default async function MiRutaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: accessRows }, { data: historial }, { data: attendance }, { data: nps }, { data: notes }] =
    await Promise.all([
      // Sin filtro de status ni .limit(1): un "supercliente" (producto anterior
      // terminado + uno nuevo) tiene 2+ filas en user_access — se necesita el
      // historial completo para el hito "producto anterior" del timeline.
      supabase
        .from('user_access')
        .select('access_started, product_id, status, products(title)')
        .eq('user_id', user.id)
        .order('access_started', { ascending: false }),
      supabase
        .from('user_hiperfoco_mes')
        .select('periodo, estado, hiperfocos(title)')
        .eq('user_id', user.id)
        .order('periodo', { ascending: false }),
      supabase
        .from('live_session_attendance')
        .select('live_sessions!inner(title, starts_at)')
        .eq('user_id', user.id),
      supabase
        .from('nps_responses')
        .select('score, created_at, hiperfocos(title)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
      // coaching_notes: el cliente lee las suyas (RLS notes_select). Son sus sesiones 1:1.
      supabase
        .from('coaching_notes')
        .select('*, profiles!admin_id(full_name)')
        .eq('user_id', user.id)
        .order('session_date', { ascending: false }),
    ])

  const accessList = (accessRows as any[]) ?? []
  const access = accessList.find(a => a.status === 'active') ?? accessList[0] ?? null

  const productos = accessList
    .filter(a => a.access_started)
    .map(a => ({ producto: a.products?.title ?? 'Producto', inicio: a.access_started as string }))

  const timeline = buildTimeline({
    inicio: (access as any)?.access_started,
    productos,
    hiperfocos: ((historial as any[]) ?? []).map(r => ({
      periodo: r.periodo, title: r.hiperfocos?.title ?? null, estado: r.estado,
    })),
    sesiones: ((attendance as any[]) ?? []).map(a => ({
      date: a.live_sessions?.starts_at, title: a.live_sessions?.title ?? 'Sesión en vivo',
    })),
    unoAuno: ((notes as any[]) ?? []).map(n => ({
      date: n.session_date, content: n.content, fathomShareId: n.fathom_share_id,
    })),
    nps: ((nps as any[]) ?? []).map(n => ({
      date: n.created_at, score: n.score, hiperfoco: n.hiperfocos?.title ?? null,
    })),
    // El cliente NO ve banderas ni casos de éxito (interno del CS).
  })

  const unoAuno = (notes as any[]) ?? []

  // Panel de estadísticas (derecha) — el promedio es el dato principal (el
  // sparkline solo, con pocos votos, se veía sin sentido — 2026-07-09); ahora
  // el sparkline vuelve como detalle de apoyo bajo el número, en orden
  // cronológico (la query ya viene ordenada ascendente).
  const npsScores = ((nps as any[]) ?? []).map(n => Number(n.score))
  const npsPromedio = npsScores.length > 0
    ? Math.round((npsScores.reduce((a, b) => a + b, 0) / npsScores.length) * 10) / 10
    : null
  const sesionesGrupales = ((attendance as any[]) ?? []).length
  const sesionesTotales = sesionesGrupales + unoAuno.length
  const mesesActivo = mesesDesde((access as any)?.access_started)

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title">Mi ruta</h1>
        <p className="page-subtitle">
          {(access as any)?.products?.title ?? 'Tu proceso'} · tu historial en la plataforma
        </p>
      </div>

      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          {/* Hoja de vida */}
          <div className="card mb-6">
            <p className="section-label">Mi historial</p>
            <Timeline events={timeline} />
          </div>

          {/* Mis sesiones 1:1 */}
          <div className="card">
            <p className="section-label">Mis sesiones 1:1</p>
            {unoAuno.length > 0 ? (
              <div className="space-y-3">
                {unoAuno.map((note: any) => (
                  <div key={note.id} className="bg-surface-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-cream-muted">{formatDateOnly(note.session_date)}</span>
                      {note.profiles?.full_name && (
                        <span className="text-xs text-cream-muted">con {note.profiles.full_name}</span>
                      )}
                    </div>
                    <p className="text-sm text-cream-dim whitespace-pre-wrap">{note.content}</p>
                    {note.summary && (
                      <div className="mt-3 rounded-lg bg-surface-900/60 border border-surface-700 p-3">
                        <p className="text-[10px] text-cream-muted uppercase tracking-wide mb-1">Summary</p>
                        <p className="text-xs text-cream-dim whitespace-pre-wrap">{note.summary}</p>
                      </div>
                    )}
                    {note.fathom_share_id && WORKER_URL && (
                      <a
                        href={`${WORKER_URL}/player?id=${note.fathom_share_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 mt-3"
                      >
                        <Play size={12} /> Ver grabación de la sesión
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-cream-muted">Aún no tienes sesiones 1:1 registradas.</p>
            )}
          </div>
        </div>

        {/* Estadísticas — piloto del sistema "alta gama" (2026-07-09, tercera
            pasada): glow-border + glass-card real (deja ver la atmósfera del
            shell detrás, por eso funciona acá y no sobre un fondo plano). El
            NPS es el dato protagonista (escala "hero"); Sesiones/Meses quedan
            secundarios a propósito — no todo puede ser hero a la vez. */}
        <aside className="hidden xl:block w-72 shrink-0 sticky top-24">
          <div className="glow-border">
            <div className="glass-card divide-y divide-white/5 overflow-hidden">
              <div className="p-5 hover-lift">
                <p className="section-label !mb-1 !text-[11px]">NPS promedio</p>
                <p className="text-3xl font-bold tabular-nums text-cream leading-none">{npsPromedio ?? '—'}</p>
                <p className="text-[11px] tracking-widest text-cream-muted mt-2 uppercase">
                  {npsScores.length} voto{npsScores.length !== 1 ? 's' : ''} desde el inicio
                </p>
                {npsScores.length >= 2 && (
                  <div className="mt-2">
                    <Sparkline points={npsScores} color="#DA7D41" width={220} height={32} />
                  </div>
                )}
              </div>
              <div className="p-5 hover-lift">
                <p className="section-label !mb-1 !text-[11px]">Sesiones totales</p>
                <p className="text-3xl font-bold tabular-nums text-cream">{sesionesTotales}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="inline-flex items-center gap-1.5 text-[11px] tracking-wide text-cream-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-400" /> {sesionesGrupales} grupales
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] tracking-wide text-cream-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-surface-500" /> {unoAuno.length} individuales
                  </span>
                </div>
              </div>
              <div className="p-5 hover-lift">
                <p className="section-label !mb-1 !text-[11px]">Meses activo</p>
                <p className="text-3xl font-bold tabular-nums text-cream">{mesesActivo ?? '—'}</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
