export interface DonutSegment {
  label: string
  value: number
  color: string
}

// Anillo de proporciones en CSS puro (conic-gradient), sin librería de gráficos.
// Server-renderable (sin interactividad) — reutilizable en cualquier panel admin.
export default function DonutChart({
  segments,
  centerValue,
  centerLabel,
  size = 148,
  thickness = 18,
  glow,
}: {
  segments: DonutSegment[]
  centerValue: string | number
  centerLabel?: string
  size?: number
  thickness?: number
  /** Color del resplandor ambiental detrás del anillo (ej. la tarjeta "instrumento"
   * de un KPI hero). Sin esta prop, el anillo se ve exactamente igual que antes. */
  glow?: string
}) {
  const total = segments.reduce((a, s) => a + s.value, 0)
  let cumulative = 0
  const stops = total > 0
    ? segments
        .filter(s => s.value > 0)
        .map(s => {
          const start = (cumulative / total) * 100
          cumulative += s.value
          const end = (cumulative / total) * 100
          return `${s.color} ${start}% ${end}%`
        })
        .join(', ')
    : ''

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        {glow && (
          <div
            className="pointer-events-none absolute rounded-full blur-2xl opacity-40"
            style={{ inset: -size * 0.25, background: glow }}
          />
        )}
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: total > 0 ? `conic-gradient(${stops})` : '#2f2621' }}
        />
        <div
          className="absolute rounded-full bg-surface-850 flex flex-col items-center justify-center text-center px-2"
          style={{ inset: thickness }}
        >
          <span
            className="font-bold text-cream leading-none tabular-nums"
            style={{ fontSize: size >= 180 ? '2.25rem' : '1.5rem' }}
          >
            {centerValue}
          </span>
          {centerLabel && <span className="text-[10px] text-cream-muted mt-1 leading-tight">{centerLabel}</span>}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 min-w-[120px]">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-cream-dim flex-1">{s.label}</span>
            <span className="text-cream font-medium">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
