'use client'

import { useSearchParams } from 'next/navigation'

// Filtro por CS (pedido de Diana, calibración TI 2026-07-06: ver el éxito y el
// NPS de un solo Business Coach a la vez). Mismo patrón de form GET nativo que
// ProductFilter/MonthFilter — preserva los demás filtros con inputs ocultos.
export default function CsFilter({
  value,
  options,
}: {
  value: string
  options: { id: string; name: string }[]
}) {
  const searchParams = useSearchParams()
  const producto = searchParams.get('producto') ?? ''
  const csMes = searchParams.get('cs_mes') ?? ''

  return (
    <form method="get">
      {producto && <input type="hidden" name="producto" value={producto} />}
      {csMes && <input type="hidden" name="cs_mes" value={csMes} />}
      <select
        name="cs"
        className="select w-auto"
        defaultValue={value}
        onChange={e => e.currentTarget.form?.requestSubmit()}
      >
        <option value="">Todos los Business Coach</option>
        {options.map(o => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </form>
  )
}
