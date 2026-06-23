// Tipos de sesión en vivo — coinciden con el CHECK de live_sessions.tipo
// (migración migracion_tipo_sesion.sql, 2026-06-22). NOT NULL, default 'mentoria'.
export type SessionTipo =
  | 'inmersion_1'
  | 'inmersion_2'
  | 'mentoria'
  | 'sala_gerencia'
  | 'entrenamiento_comercial'

// Ordenados para los selects del admin.
export const SESSION_TIPOS: { value: SessionTipo; label: string }[] = [
  { value: 'inmersion_1', label: 'Inmersión 1' },
  { value: 'inmersion_2', label: 'Inmersión 2' },
  { value: 'mentoria', label: 'Mentoría' },
  { value: 'sala_gerencia', label: 'Sala de gerencia' },
  { value: 'entrenamiento_comercial', label: 'Entrenamiento comercial' },
]

const LABELS: Record<string, string> = Object.fromEntries(
  SESSION_TIPOS.map(t => [t.value, t.label])
)

export const SESSION_TIPO_VALUES = SESSION_TIPOS.map(t => t.value)

// Label legible a partir del valor de la columna `tipo`. Fallback seguro.
export function sessionTipoLabel(tipo: string | null | undefined): string {
  if (!tipo) return 'Sesión en vivo'
  return LABELS[tipo] ?? 'Sesión en vivo'
}
