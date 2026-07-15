import { supabaseAdmin } from '@/lib/supabase/admin'

// Notificaciones in-app (2026-07-15, Fase 6): solo se insertan desde contextos
// de confianza (admin/cron, vía supabaseAdmin) — el cliente solo lee/marca
// como leídas las suyas (RLS de supabase/migracion_notificaciones.sql).

export type NotificationType = 'nueva_grabacion' | 'sesion_proxima'

interface NotifyInput {
  userIds: string[]
  type: NotificationType
  title: string
  body?: string | null
  link?: string | null
  // Evita duplicados entre corridas del cron (ej. 'sesion_proxima:<session_id>').
  // Sin dedupeKey (null), cada llamada inserta sin bloquear duplicados —
  // correcto para 'nueva_grabacion', que solo se dispara una vez por publicación.
  dedupeKey?: string | null
}

export async function notifyUsers({ userIds, type, title, body = null, link = null, dedupeKey = null }: NotifyInput) {
  const ids = [...new Set(userIds)]
  if (ids.length === 0) return
  const rows = ids.map(user_id => ({ user_id, type, title, body, link, dedupe_key: dedupeKey }))
  await supabaseAdmin.from('notifications').upsert(rows, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
}

const TRANSVERSAL_TIPOS = ['sala_gerencia', 'entrenamiento_comercial']

// Destinatarios de una grabación publicada: transversales (Sala de
// Gerencia/Entrenamiento Comercial) van a todo cliente con acceso activo
// (cualquier producto); el resto, a quien tenga ese hiperfoco en su historial
// (mismo criterio de "accesibilidad" que ya usa app/(client)/roadmap/page.tsx).
export async function getRecordingRecipients(hiperfocoId: string, tipo: string): Promise<string[]> {
  if (TRANSVERSAL_TIPOS.includes(tipo)) {
    const { data } = await supabaseAdmin.from('user_access').select('user_id').eq('status', 'active')
    return (data ?? []).map(r => r.user_id as string)
  }
  const { data } = await supabaseAdmin.from('user_hiperfoco_mes').select('user_id').eq('hiperfoco_id', hiperfocoId)
  return [...new Set((data ?? []).map(r => r.user_id as string))]
}
