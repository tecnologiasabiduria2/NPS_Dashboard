import { getHiperfocoVisual } from '@/lib/hiperfocoVisual'
import Sparkline from '@/components/Sparkline'

function npsColorClass(score: number) {
  if (score >= 8) return 'text-emerald-400'
  if (score >= 6) return 'text-amber-400'
  return 'text-red-400'
}

export interface NpsModuloRow {
  title: string
  avg: number
  count: number
  trend: number[] // promedios mensuales, más viejo primero (para el sparkline)
}

// Cajas por hiperfoco con el número grande + tendencia de los últimos meses,
// a pedido de Diana (calibración 2026-07-06): "yo haría cajas y que diga NPS
// por hiperfoco, entonces marketing y sale el número grande... ver la
// tendencia del último semestre o del último trimestre de ese módulo".
export default function NpsModuloBoxes({ rows }: { rows: NpsModuloRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-cream-muted text-center py-4">Sin respuestas de NPS este mes todavía.</p>
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {rows.map(row => {
        const visual = getHiperfocoVisual(row.title)
        const HfIcon = visual.icon
        return (
          <div key={row.title} className="bg-surface-800 rounded-xl px-4 py-4 flex flex-col items-center text-center">
            <div className="flex items-center gap-1.5 mb-2 min-w-0 max-w-full">
              <HfIcon size={13} style={{ color: visual.solid }} className="shrink-0" />
              <p className="text-xs text-cream-muted truncate">{row.title}</p>
            </div>
            <p className={`text-3xl font-bold leading-none ${npsColorClass(row.avg)}`}>{row.avg}</p>
            <p className="text-xs text-cream-muted mt-1.5">{row.count} voto{row.count === 1 ? '' : 's'}</p>
            {row.trend.length > 1 && (
              <Sparkline points={row.trend} color={visual.solid} width={80} height={24} />
            )}
          </div>
        )
      })}
    </div>
  )
}
