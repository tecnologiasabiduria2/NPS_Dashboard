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
