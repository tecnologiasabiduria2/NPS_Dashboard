'use client'

import { useSearchParams } from 'next/navigation'

// Filtro de mes para "Sesiones 1:1 por CS" (pedido de Diana, reunión 2026-07-03:
// poder medir el cumplimiento en un mes distinto al actual). Form GET nativo en
// vez de router.push: más simple y confiable que la navegación soft de Next
// (que en pruebas no siempre aplicaba el cambio de searchParams al vuelo).
// Preserva los demás filtros de la URL (ej. ?producto=) con inputs ocultos.
export default function MonthFilter({
  value,
  options,
}: {
  value: string
  options: { value: string; label: string }[]
}) {
  const searchParams = useSearchParams()
  const producto = searchParams.get('producto') ?? ''

  return (
    <form method="get">
      {producto && <input type="hidden" name="producto" value={producto} />}
      <select
        name="cs_mes"
        className="select w-auto"
        defaultValue={value}
        onChange={e => e.currentTarget.form?.requestSubmit()}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </form>
  )
}
