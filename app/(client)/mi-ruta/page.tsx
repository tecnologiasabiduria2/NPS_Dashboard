import { createClient } from '@/lib/supabase/server'
import { formatDateOnly, formatMonthShort, mesesDesde } from '@/lib/format'
import { Play, Calendar, User, MessagesSquare, Sparkles } from 'lucide-react'
import Sparkline from '@/components/Sparkline'
import { productFullName } from '@/lib/productIdentity'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

// Metadatos por estado del hiperfoco (mismos que el dashboard cliente).
const ESTADO_META: Record<string, { label: string; chip: string }> = {
  en_curso:   { label: 'en curso',    chip: 'bg-sky-500/15 text-sky-300' },
  cerrado:    { label: 'cerrado',     chip: 'bg-emerald-500/15 text-emerald-300' },
  pausa:      { label: 'descanso',    chip: 'bg-surface-700 text-cream-muted' },
  no_elegido: { label: 'sin asignar', chip: 'bg-surface-700 text-cream-dim' },
}

function npsColorClass(score: number) {
  if (score >= 8) return 'text-emerald-400'
  if (score >= 6) return 'text-amber-400'
  return 'text-red-400'
}

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

  const unoAuno = (notes as any[]) ?? []

  // Historial de hiperfocos como tabla limpia (2026-07-14, rediseño según
  // refe.jpeg — reemplaza el timeline mixto que "se veía muy plano"). Mismo
  // enriquecido que el dashboard: asistió (hubo asistencia ese mes), repitió
  // (mismo hiperfoco que el mes anterior) y NPS del mes.
  const npsPorMes = new Map<string, number>()
  // nps ya viene ordenado ascendente → la última escritura por mes (la más
  // reciente) gana.
  for (const n of ((nps as any[]) ?? [])) {
    npsPorMes.set(String(n.created_at).slice(0, 7), Number(n.score))
  }
  const mesesAsistidos = new Set<string>()
  for (const a of ((attendance as any[]) ?? [])) {
    const key = (a.live_sessions?.starts_at as string | undefined)?.slice(0, 7)
    if (key) mesesAsistidos.add(key)
  }
  const histRows = (historial as any[]) ?? []
  const historialView = histRows.map((row, i, arr) => {
    const mesKey = String(row.periodo).slice(0, 7)
    const prev = arr[i + 1] // siguiente en orden desc = mes anterior
    const title = row.hiperfocos?.title ?? null
    return {
      periodo: row.periodo as string,
      estado: row.estado as string,
      title,
      asistio: mesesAsistidos.has(mesKey),
      repitio: Boolean(title) && (prev?.hiperfocos?.title ?? null) === title,
      nps: npsPorMes.get(mesKey) ?? null,
    }
  })

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
          {(access as any)?.products?.title ? productFullName((access as any).products.title) : 'Tu proceso'} · tu historial en la plataforma
        </p>
      </div>

      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0 space-y-6">
          {/* Sesiones 1 a 1 — sección propia y prominente, movida ARRIBA del
              historial (2026-07-14, pedido de Diana: es lo más valioso del
              acompañamiento y antes quedaba enterrado bajo el timeline). Tarjetas
              rediseñadas siguiendo refe.jpeg: bloque limpio con acento de marca,
              notas + resumen destacado + acceso a la grabación. */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessagesSquare size={15} className="text-sand" />
                <p className="text-sm font-semibold text-cream">Mis sesiones 1 a 1</p>
              </div>
              {unoAuno.length > 0 && (
                <span className="text-xs text-cream-muted">
                  {unoAuno.length} sesión{unoAuno.length !== 1 ? 'es' : ''} de acompañamiento
                </span>
              )}
            </div>

            {unoAuno.length > 0 ? (
              // Timeline numerado con conector (2026-07-14, 2ª pasada): la versión
              // anterior (acento fino a la izquierda) se veía "apenas perceptible".
              // Ahora cada sesión es un nodo numerado sobre una línea vertical, con
              // header propio y bloques claros de Notas / Resumen — da la sensación
              // de recorrido/evolución que pidió Diana.
              <div className="relative">
                <div className="absolute left-[19px] top-3 bottom-3 w-px bg-gradient-to-b from-brand-500/60 via-surface-600 to-transparent" />
                <div className="space-y-5">
                  {unoAuno.map((note: any, i: number) => {
                    const numero = unoAuno.length - i // notas en orden desc → la más antigua es la #1
                    return (
                      <div
                        key={note.id}
                        className="relative pl-14 animate-fade-up"
                        style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                      >
                        {/* Nodo numerado */}
                        <div
                          className="absolute left-0 top-1 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-black/40 ring-4 ring-surface-950"
                          style={{ background: 'linear-gradient(135deg, #7E301F, #DA7D41)' }}
                        >
                          {numero}
                        </div>

                        <div className="rounded-2xl overflow-hidden bg-surface-850 border border-surface-700 hover-lift">
                          {/* Cabecera de la sesión */}
                          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-surface-700 bg-surface-800/40">
                            <p className="text-sm font-semibold text-cream inline-flex items-center gap-1.5 capitalize">
                              <Calendar size={13} className="text-sand" /> {formatDateOnly(note.session_date)}
                            </p>
                            {note.profiles?.full_name && (
                              <span className="text-xs text-cream-muted inline-flex items-center gap-1.5 shrink-0">
                                <User size={12} /> {note.profiles.full_name}
                              </span>
                            )}
                          </div>

                          <div className="p-5 space-y-3">
                            <div>
                              <p className="section-label !text-[10px] !mb-1">Notas de la sesión</p>
                              <p className="text-sm text-cream-dim whitespace-pre-wrap leading-relaxed">{note.content}</p>
                            </div>

                            {note.summary && (
                              <div className="rounded-xl bg-brand-600/10 border border-brand-600/20 p-3.5">
                                <p className="text-[10px] text-sand uppercase tracking-wide mb-1.5 font-semibold inline-flex items-center gap-1.5">
                                  <Sparkles size={11} /> Resumen y plan de acción
                                </p>
                                <p className="text-xs text-cream-dim whitespace-pre-wrap leading-relaxed">{note.summary}</p>
                              </div>
                            )}

                            {note.fathom_share_id && WORKER_URL && (
                              <a
                                href={`${WORKER_URL}/player?id=${note.fathom_share_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300"
                              >
                                <Play size={12} /> Ver grabación de la sesión
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="card">
                <p className="text-sm text-cream-muted">
                  Aún no tienes sesiones 1 a 1 registradas. Aquí verás las notas, acuerdos y la
                  grabación de cada sesión con tu acompañante.
                </p>
              </div>
            )}
          </div>

          {/* Historial de hiperfocos — tabla limpia (rediseño 2026-07-14, estilo
              refe.jpeg): mes · hiperfoco (con "repitió"/"asistió") · NPS o estado
              a la derecha. Reemplaza el timeline mixto anterior. */}
          <div className="card">
            <p className="section-label">Historial de hiperfocos</p>
            {historialView.length === 0 ? (
              <p className="text-sm text-cream-muted">
                Todavía no hay hiperfocos registrados. Aparecerán aquí mes a mes.
              </p>
            ) : (
              <div className="divide-y divide-surface-700">
                {historialView.map((row, i) => {
                  const meta = ESTADO_META[row.estado] ?? ESTADO_META.no_elegido
                  const conHiperfoco = Boolean(row.title)
                  return (
                    <div
                      key={row.periodo}
                      className="flex items-center justify-between gap-3 py-3 animate-fade-up"
                      style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-cream-muted capitalize">{formatMonthShort(row.periodo)}</p>
                        <p className={`text-sm mt-0.5 ${conHiperfoco ? 'text-cream' : 'text-cream-muted'}`}>
                          {row.title ?? (row.estado === 'pausa' ? 'Pausa' : 'Sin asignar')}
                          {row.repitio && <span className="text-xs text-cream-muted ml-1.5">· repitió</span>}
                          {row.asistio && <span className="text-xs text-cream-muted ml-1.5">· asistió ✓</span>}
                        </p>
                      </div>
                      {row.nps !== null ? (
                        <span className={`text-sm font-medium shrink-0 ${npsColorClass(row.nps)}`}>NPS {row.nps}</span>
                      ) : (
                        <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 ${meta.chip}`}>{meta.label}</span>
                      )}
                    </div>
                  )
                })}
              </div>
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
