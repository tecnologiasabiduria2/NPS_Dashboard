// Mini-gráfico de tendencia (sin librería, SVG puro). Puntos en orden
// cronológico (más viejo primero). Pensado para series cortas tipo NPS,
// donde el rango (0-10) es fijo y conocido — se mapea a ese rango exacto,
// no al min/max observado, para que la posición en la línea sea real.
export default function Sparkline({
  points,
  min = 0,
  max = 10,
  width = 160,
  height = 40,
  color = '#DA7D41',
}: {
  points: number[]
  min?: number
  max?: number
  width?: number
  height?: number
  color?: string
}) {
  if (points.length === 0) return null

  const pad = 4
  const scaleY = (v: number) => {
    const clamped = Math.min(max, Math.max(min, v))
    return height - pad - ((clamped - min) / (max - min)) * (height - pad * 2)
  }

  if (points.length === 1) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        <circle cx={width / 2} cy={scaleY(points[0])} r={3} fill={color} />
      </svg>
    )
  }

  const stepX = (width - pad * 2) / (points.length - 1)
  const coords = points.map((v, i) => [pad + i * stepX, scaleY(v)] as const)
  const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" className="overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === coords.length - 1 ? 3 : 1.75}
          fill={i === coords.length - 1 ? color : `${color}99`}
        />
      ))}
    </svg>
  )
}
