// Tipos de sesión en vivo — coinciden con el CHECK de live_sessions.tipo
// (migración migracion_tipo_sesion.sql, 2026-06-22). NOT NULL, default 'mentoria'.
export type SessionTipo =
  | 'inmersion_1'
  | 'inmersion_2'
  | 'mentoria'
  | 'sala_gerencia'
  | 'entrenamiento_comercial'
  | '1_a_1'

// Ordenados para los selects del admin.
export const SESSION_TIPOS: { value: SessionTipo; label: string }[] = [
  { value: 'inmersion_1', label: 'Inmersión 1' },
  { value: 'inmersion_2', label: 'Inmersión 2' },
  { value: 'mentoria', label: 'Mentoría' },
  { value: 'sala_gerencia', label: 'Sala de gerencia' },
  { value: 'entrenamiento_comercial', label: 'Entrenamiento comercial' },
  { value: '1_a_1', label: 'Sesión 1:1' },
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

// Tipos para CONTENIDO grabado (más simples: no se distingue inmersión 1 vs 2).
// El título de la grabación identifica el detalle específico.
export const CONTENT_TIPOS = [
  { value: 'inmersion',               label: 'Inmersión' },
  { value: 'mentoria',                label: 'Mentoría' },
  { value: 'sala_gerencia',           label: 'Sala de Gerencia' },
  { value: 'entrenamiento_comercial', label: 'Entrenamiento Comercial' },
] as const

export type ContentTipoValue = typeof CONTENT_TIPOS[number]['value']
export const CONTENT_TIPO_LABELS = CONTENT_TIPOS.map(t => t.label)
export const CONTENT_TIPO_VALUES = CONTENT_TIPOS.map(t => t.value)
export const contentTipoLabel = (v: string) => CONTENT_TIPOS.find(t => t.value === v)?.label ?? v
