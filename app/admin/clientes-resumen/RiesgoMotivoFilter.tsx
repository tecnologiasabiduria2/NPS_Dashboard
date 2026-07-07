'use client'

import { useSearchParams } from 'next/navigation'

// Filtro de "Clientes en riesgo por asistencia" por criterio (pedido de Juan,
// 2026-07-07 noche) — mismo patrón de form GET nativo que ProductFilter/MonthFilter.
export default function RiesgoMotivoFilter({ value }: { value: string }) {
  const searchParams = useSearchParams()
  const producto = searchParams.get('producto') ?? ''
  const csMes = searchParams.get('cs_mes') ?? ''

  return (
    <form method="get">
      {producto && <input type="hidden" name="producto" value={producto} />}
      {csMes && <input type="hidden" name="cs_mes" value={csMes} />}
      <select
        name="motivo"
        className="select w-auto text-xs"
        defaultValue={value}
        onChange={e => e.currentTarget.form?.requestSubmit()}
      >
        <option value="">Todos los motivos</option>
        <option value="racha">Solo racha de faltas seguidas</option>
        <option value="porcentaje">Solo % de asistencia</option>
      </select>
    </form>
  )
}
