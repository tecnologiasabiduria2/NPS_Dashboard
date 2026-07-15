import { createClient } from '@/lib/supabase/server'
import { Calendar, Layers, Video, Star, CheckCircle2, TrendingUp, DollarSign, Target, Flame } from 'lucide-react'
import { clsx } from 'clsx'
import Sparkline from '@/components/Sparkline'
import ProgressBar from '@/components/ProgressBar'
import { getConquistas, getInsignias } from '@/lib/conquistas'
import ShareCard from './ShareCard'
import { getHiperfocoVisual } from '@/lib/hiperfocoVisual'
import { productFullName } from '@/lib/productIdentity'
import { formatMoneda } from '@/lib/monedas'

function npsColorClass(score: number) {
  if (score >= 8) return 'text-emerald-400'
  if (score >= 6) return 'text-amber-400'
  return 'text-red-400'
}

export default async function MiProgresoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: accessRows } = await supabase
    .from('user_access')
    .select('product_id, access_started, products(title)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
  const access = (accessRows as any[])?.[0] ?? null

  const conquistas = await getConquistas(supabase, {
    userId: user.id,
    productId: access?.product_id ?? null,
    accessStarted: access?.access_started,
  })

  const productoTitulo = access?.products?.title ? productFullName(access.products.title) : 'Tu proceso'
  const insignias = getInsignias(conquistas)

  // Facturación / objetivos (punto 9 Fase 2). Resiliente: si la migración no
  // corrió, la query falla y se trata como sin datos (no rompe la página).
  const { data: metricasRaw, error: metErr } = await supabase
    .from('user_metricas_mes')
    .select('periodo, facturacion_real, objetivo, moneda')
    .eq('user_id', user.id)
    .order('periodo', { ascending: true })
  const metricas = (!metErr ? (metricasRaw as any[]) : null) ?? []
  const factSeries = metricas.filter(m => m.facturacion_real != null).map(m => Number(m.facturacion_real))
  const lastFactRow = [...metricas].reverse().find(m => m.facturacion_real != null) ?? null
  const facturacionActual = lastFactRow ? Number(lastFactRow.facturacion_real) : null
  const lastObjRow = [...metricas].reverse().find(m => m.objetivo != null) ?? null
  const objetivoActual = lastObjRow ? Number(lastObjRow.objetivo) : null

  const kpis: { icon: typeof Calendar; label: string; value: string | number; accent?: boolean }[] = [
    { icon: Calendar, label: 'Meses activo', value: conquistas.mesesActivo ?? '—' },
    { icon: Layers, label: 'Módulos cursados', value: conquistas.modulosVividos },
    { icon: Video, label: 'Sesiones', value: conquistas.sesionesTotales },
    { icon: Star, label: 'NPS promedio', value: conquistas.npsPromedio ?? '—' },
    { icon: Flame, label: 'Racha semanal', value: `${conquistas.rachaSemanas} sem.`, accent: true },
  ]

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Mi progreso</h1>
          <p className="page-subtitle">{productoTitulo} · tus conquistas y evolución</p>
        </div>
        <ShareCard
          productoTitulo={productoTitulo}
          mesesActivo={conquistas.mesesActivo}
          modulosVividos={conquistas.modulosVividos}
          sesionesTotales={conquistas.sesionesTotales}
          rachaSemanas={conquistas.rachaSemanas}
          insignias={insignias.map(i => ({ id: i.id, label: i.label, unlocked: i.unlocked }))}
        />
      </div>

      {/* Hero de conquistas */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        {kpis.map((k, i) => {
          const Icon = k.icon
          return (
            <div
              key={k.label}
              className="glow-border animate-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="glass-card p-5 hover-lift h-full">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={15} className={k.accent ? 'text-accent' : 'text-sand'} />
                  <p className="section-label !mb-0 !text-[11px]">{k.label}</p>
                </div>
                <p className="text-3xl font-bold tabular-nums text-cream leading-none">{k.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Insignias/logros (2026-07-15, agrandadas y con más carácter 2026-07-16
          a pedido de Juan: antes quedaban chicas y apiñadas a la izquierda con
          medio panel vacío a la derecha, y el look era demasiado tenue para
          sentirse una insignia real. Ahora: mismo glow-border/glass-card "alta
          gama" que ya usa el hero de KPIs, medallón con degradado de marca +
          sombra cuando está desbloqueada, borde punteado cuando no. */}
      <div className="mb-8">
        <p className="section-label !mb-3">Insignias</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {insignias.map((ins, i) => {
            const Icon = ins.icon
            return (
              <div key={ins.id} className="glow-border animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="glass-card p-5 flex flex-col items-center text-center gap-2 h-full">
                  <div
                    className={clsx(
                      'w-16 h-16 rounded-full flex items-center justify-center shrink-0',
                      ins.unlocked
                        ? 'bg-gradient-to-br from-sand via-accent to-brand-600 text-white shadow-lg shadow-accent/30'
                        : 'bg-surface-800 text-cream-muted/50 border-2 border-dashed border-surface-600'
                    )}
                  >
                    <Icon size={28} />
                  </div>
                  <p className={clsx('text-sm font-semibold leading-tight', ins.unlocked ? 'text-cream' : 'text-cream-dim')}>
                    {ins.label}
                  </p>
                  <p className="text-[11px] text-cream-muted leading-snug">
                    {ins.unlocked ? '¡Desbloqueada!' : ins.requirement}
                  </p>
                  {!ins.unlocked && ins.progressLabel && (
                    <p className="text-[11px] text-accent font-semibold">{ins.progressLabel}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Facturación y objetivos (punto 9 Fase 2) */}
      <div className="card mb-8">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign size={15} className="text-sand" />
          <p className="text-sm font-semibold text-cream">Facturación y objetivos</p>
        </div>
        {facturacionActual !== null || objetivoActual !== null ? (
          <div className="flex flex-wrap items-center gap-8">
            <div>
              <p className="text-[11px] text-cream-muted uppercase tracking-wide mb-1">Facturación reciente</p>
              <p className="text-2xl font-bold text-cream tabular-nums leading-none">
                {facturacionActual !== null ? formatMoneda(facturacionActual, lastFactRow?.moneda) : '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-cream-muted uppercase tracking-wide mb-1">Objetivo</p>
              <p className="text-2xl font-bold text-sand tabular-nums leading-none inline-flex items-center gap-1.5">
                <Target size={16} /> {objetivoActual !== null ? formatMoneda(objetivoActual, lastObjRow?.moneda) : '—'}
              </p>
            </div>
            {factSeries.length >= 2 && (
              <div className="flex-1 min-w-[220px]">
                <Sparkline points={factSeries} min={0} max={Math.max(...factSeries, 1)} width={300} height={52} color="#DA7D41" />
                <p className="text-[11px] text-cream-muted mt-1">Evolución de tu facturación</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-cream-muted">
            Aún no has registrado tu facturación. Cada mes te la preguntamos para mostrarte tu
            evolución y tus conquistas con números.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Módulos vividos */}
        <div className="xl:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={15} className="text-sand" />
            <p className="text-sm font-semibold text-cream">Módulos cursados</p>
          </div>

          {conquistas.modulos.length === 0 ? (
            <div className="card">
              <p className="text-sm text-cream-muted">
                Todavía no tienes módulos registrados. A medida que avances en tus hiperfocos,
                aparecerán aquí con tu progreso.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {conquistas.modulos.map((m, i) => {
                const visual = getHiperfocoVisual(m.title)
                const Icon = visual.icon
                const pct = m.total > 0 ? Math.round((m.vistos / m.total) * 100) : 0
                return (
                  <div
                    key={m.hiperfocoId}
                    className="card hover-lift animate-fade-up"
                    style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `linear-gradient(135deg, ${visual.from}, ${visual.to})` }}
                      >
                        <Icon size={17} className="text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-cream truncate">{m.title}</p>
                        <p className="text-xs mt-0.5 inline-flex items-center gap-1">
                          {m.activo ? (
                            <span className="text-sky-300">En curso</span>
                          ) : (
                            <span className="text-emerald-300 inline-flex items-center gap-1">
                              <CheckCircle2 size={11} /> Completado
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    {m.total > 0 ? (
                      <>
                        <ProgressBar percent={pct} color={visual.solid} />
                        <p className="text-[11px] text-cream-muted mt-1.5">
                          {m.vistos} de {m.total} grabaciones · {pct}%
                        </p>
                      </>
                    ) : (
                      <p className="text-[11px] text-cream-muted">Sin grabaciones publicadas todavía.</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Evolución de NPS */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={15} className="text-sand" />
            <p className="text-sm font-semibold text-cream">Evolución de tu NPS</p>
          </div>
          <div className="card">
            {conquistas.npsScores.length > 0 ? (
              <>
                <div className="flex items-baseline gap-2">
                  <p className={`text-4xl font-bold tabular-nums leading-none ${conquistas.npsPromedio !== null ? npsColorClass(conquistas.npsPromedio) : 'text-cream'}`}>
                    {conquistas.npsPromedio}
                  </p>
                  <p className="text-xs text-cream-muted">
                    promedio · {conquistas.npsScores.length} voto{conquistas.npsScores.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {conquistas.npsScores.length >= 2 && (
                  <div className="mt-4">
                    <Sparkline points={conquistas.npsScores} color="#DA7D41" width={260} height={56} />
                  </div>
                )}
                <p className="text-xs text-cream-dim mt-4 leading-relaxed">
                  Tu satisfacción en las sesiones a lo largo del tiempo. Cada voto es una sesión que
                  calificaste.
                </p>
              </>
            ) : (
              <p className="text-sm text-cream-muted">
                Aún no has calificado sesiones. Cuando lo hagas, verás aquí tu evolución.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
