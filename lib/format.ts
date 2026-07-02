// Formatea una fecha-solo (string 'YYYY-MM-DD' de columnas DATE) sin desfase de
// zona horaria. new Date('2026-12-31') se interpreta como medianoche UTC y, en
// zonas detrás de UTC (ej. Colombia UTC-5), retrocede un día al mostrarse.
// Construir la fecha con sus componentes la deja en medianoche LOCAL y lo evita.
export function formatDateOnly(
  value: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  locale = 'es-CO'
): string {
  if (!value) return ''
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return String(value)
  return new Date(y, m - 1, d).toLocaleDateString(locale, options)
}

// Nombre largo del mes a partir de una fecha-solo 'YYYY-MM-DD' (ej. 'noviembre').
// Útil para el encabezado del hiperfoco del mes ("ESTE MES · NOVIEMBRE").
export function formatMonthLong(
  value: string | null | undefined,
  locale = 'es-CO'
): string {
  return formatDateOnly(value, { month: 'long' }, locale)
}

// Mes + año corto a partir de 'YYYY-MM-DD' (ej. 'nov 2026'). Para el historial.
export function formatMonthShort(
  value: string | null | undefined,
  locale = 'es-CO'
): string {
  return formatDateOnly(value, { month: 'short', year: 'numeric' }, locale)
}

// ── Hora Colombia ──────────────────────────────────────────────────────────
// Las sesiones en vivo se manejan SIEMPRE en hora Colombia (America/Bogota,
// UTC-5 fijo, sin horario de verano) y se muestran así con la etiqueta
// "(hora Colombia)", para que no haya ambigüedad entre husos.
export const CO_TZ = 'America/Bogota'
export const CO_OFFSET = '-05:00' // Colombia no cambia de hora en el año

// Convierte un valor de <input type="datetime-local"> (hora de pared, ej.
// "2026-07-01T21:00") a ISO/UTC interpretándolo como hora Colombia.
export function coLocalToISO(localValue: string): string {
  if (!localValue) return ''
  const d = new Date(`${localValue}:00${CO_OFFSET}`)
  return isNaN(d.getTime()) ? '' : d.toISOString()
}

export function formatCOTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { timeZone: CO_TZ, hour: '2-digit', minute: '2-digit' })
}
export function formatCODateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', { timeZone: CO_TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
export function formatCODateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { timeZone: CO_TZ, weekday: 'long', day: 'numeric', month: 'long' })
}
// Día del mes y mes corto en hora Colombia (para las tarjetas de la lista lateral).
export function formatCODayNum(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { timeZone: CO_TZ, day: '2-digit' })
}
export function formatCOMonthShort(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { timeZone: CO_TZ, month: 'short' })
}
