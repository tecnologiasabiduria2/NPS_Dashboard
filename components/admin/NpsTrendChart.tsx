export interface TrendPoint {
  label: string // mes corto, ej. "ene", "feb"
  value: number
}

// Gráfica grande de tendencia (línea + área), SVG puro, mismo patrón sin
// librería que Sparkline.tsx/DonutChart.tsx. Pensada para el "vistazo rápido"
// del dashboard y como pieza principal de /admin/nps (pedido de calibración
// 2026-07-06: "el dashboard sea muy visual").
export default function NpsTrendChart({
  data,
  color = '#DA7D41',
  height = 200,
  min = 0,
  max = 10,
}: {
  data: TrendPoint[]
  color?: string
  height?: number
  min?: number
  max?: number
}) {
  if (data.length === 0) {
    return <p className="text-sm text-cream-muted text-center py-10">Sin datos suficientes todavía.</p>
  }

  const width = 640
  const padX = 8
  const padTop = 20
  const padBottom = 8
  const plotH = height - padTop - padBottom

  const scaleY = (v: number) => {
    const clamped = Math.min(max, Math.max(min, v))
    return padTop + plotH - ((clamped - min) / (max - min)) * plotH
  }

  const stepX = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0
  const coords = data.map((d, i) => [padX + i * stepX, scaleY(d.value)] as const)

  const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaPath = coords.length > 1
    ? `${linePath} L${coords[coords.length - 1][0].toFixed(1)},${padTop + plotH} L${coords[0][0].toFixed(1)},${padTop + plotH} Z`
    : ''

  const last = data[data.length - 1]
  const prev = data.length > 1 ? data[data.length - 2] : null
  const delta = prev ? Math.round((last.value - prev.value) * 10) / 10 : null
  const gradId = `nps-trend-fill-${color.replace('#', '')}`

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-4xl font-bold text-cream leading-none">{last.value.toFixed(1)}</span>
        {delta !== null && delta !== 0 && (
          <span className={`inline-flex items-center gap-1 text-sm font-medium ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)} vs. mes anterior
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" className="overflow-visible">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map(f => (
          <line
            key={f}
            x1={padX} x2={width - padX}
            y1={padTop + plotH * (1 - f)} y2={padTop + plotH * (1 - f)}
            stroke="#443830" strokeWidth={1}
          />
        ))}
        {areaPath && <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map(([x, y], i) => {
          const isLast = i === coords.length - 1
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={isLast ? 4 : 2.5} fill={color} />
            </g>
          )
        })}
      </svg>
      <div className="flex justify-between mt-1.5 px-1">
        {data.map((d, i) => (
          <span key={i} className="text-[10px] text-cream-muted capitalize">{d.label}</span>
        ))}
      </div>
    </div>
  )
}
