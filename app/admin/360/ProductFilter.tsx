'use client'

import { useSearchParams } from 'next/navigation'

// Desplegable de producto de la Vista 360. Filtra (vía ?producto=slug) las
// secciones por hiperfoco. "" = todos los productos. Form GET nativo (más
// confiable que router.push con searchParams, ver nota en MonthFilter.tsx).
// Preserva ?cs_mes= si estaba puesto.
export default function ProductFilter({
  options,
  value,
}: {
  options: { slug: string; title: string }[]
  value: string
}) {
  const searchParams = useSearchParams()
  const csMes = searchParams.get('cs_mes') ?? ''
  const cs = searchParams.get('cs') ?? ''

  return (
    <form method="get">
      {csMes && <input type="hidden" name="cs_mes" value={csMes} />}
      {cs && <input type="hidden" name="cs" value={cs} />}
      <select
        name="producto"
        className="select w-auto"
        defaultValue={value}
        onChange={e => e.currentTarget.form?.requestSubmit()}
      >
        <option value="">Todos los productos</option>
        {options.map(o => (
          <option key={o.slug} value={o.slug}>{o.title}</option>
        ))}
      </select>
    </form>
  )
}
