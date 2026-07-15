import type { SupabaseClient } from '@supabase/supabase-js'

// Preguntas cerradas de "retos" que se muestran al cliente al INICIAR un
// hiperfoco/módulo (punto 9 Fase 2, 2026-07-14). Se guardan en
// user_reto_hiperfoco.respuestas como { [preguntaId]: valor }.
//
// El texto de cada pregunta es editable por admin en /admin/retos/questions
// (tabla reto_preguntas, mismo patrón que nps_questions). Los ids y la escala
// 1-5 son fijos; lo único configurable es el texto de la pregunta.

export interface RetoOpcion {
  value: number
  label: string
}

export interface RetoPregunta {
  id: string
  texto: string
  opciones: RetoOpcion[]
}

// Escala cerrada 1–5 reutilizada por todas las preguntas.
const ESCALA_1_5: RetoOpcion[] = [
  { value: 1, label: 'Muy bajo' },
  { value: 2, label: 'Bajo' },
  { value: 3, label: 'Medio' },
  { value: 4, label: 'Alto' },
  { value: 5, label: 'Muy alto' },
]

// Textos por defecto — fallback si la tabla reto_preguntas está vacía/no existe
// todavía (migración no corrida) y seed de la migración.
export const DEFAULT_RETO_PREGUNTAS: RetoPregunta[] = [
  { id: 'claridad',  texto: '¿Qué tan claro tienes tus objetivos en esta área?', opciones: ESCALA_1_5 },
  { id: 'confianza', texto: '¿Qué tan preparado te sientes para aplicar lo de este módulo?', opciones: ESCALA_1_5 },
  { id: 'reto',      texto: '¿Qué tan grande es el reto que enfrentas hoy en esta área?', opciones: ESCALA_1_5 },
]

/** Lee los textos configurados en reto_preguntas, con fallback a los por defecto. */
export async function fetchRetoPreguntas(supabase: SupabaseClient): Promise<RetoPregunta[]> {
  const { data } = await supabase.from('reto_preguntas').select('id, texto')
  const textoById = new Map((data ?? []).map((r: any) => [r.id as string, r.texto as string]))
  return DEFAULT_RETO_PREGUNTAS.map(p => ({ ...p, texto: textoById.get(p.id) ?? p.texto }))
}
