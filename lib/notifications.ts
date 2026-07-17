import { supabaseAdmin } from '@/lib/supabase/admin'

// Notificaciones in-app (2026-07-15, Fase 6): solo se insertan desde contextos
// de confianza (admin/cron, vía supabaseAdmin) — el cliente solo lee/marca
// como leídas las suyas (RLS de supabase/migracion_notificaciones.sql).

export type NotificationType = 'nueva_grabacion' | 'sesion_proxima' | 'foro_like'

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

interface LikeActor {
  id: string
  name: string
}

function composeLikeTitle(actors: LikeActor[]): string {
  const names = actors.map(a => a.name || 'Alguien')
  if (names.length === 1) return `${names[0]} le dio like a tu publicación`
  if (names.length === 2) return `${names[0]} y ${names[1]} le dieron like a tu publicación`
  const resto = names.length - 2
  return `${names[0]}, ${names[1]} y ${resto} persona${resto === 1 ? '' : 's'} más le dieron like a tu publicación`
}

// Notificación acumulativa de "me gusta" en Conversación (2026-07-17, estilo
// TikTok): mientras la notificación de un post siga SIN LEER, cada like nuevo
// se suma a la misma fila (recompone el título, no crea una nueva). En cuanto
// se marca como leída (solo existe "Marcar todas", global), el siguiente like
// sobre ese post arranca una fila nueva que puede volver a acumular.
export async function notifyForoLike(postId: string, postAuthorId: string, liker: LikeActor) {
  if (liker.id === postAuthorId) return
  try {
    const { data: existing } = await supabaseAdmin
      .from('notifications')
      .select('id, actors')
      .eq('user_id', postAuthorId).eq('type', 'foro_like').eq('post_id', postId)
      .is('read_at', null).maybeSingle()

    const prevActors: LikeActor[] = ((existing as { actors?: LikeActor[] } | null)?.actors as LikeActor[]) ?? []
    if (prevActors.some(a => a.id === liker.id)) return // ya estaba (doble clic / unlike+like)
    const actors = [...prevActors, liker]
    const title = composeLikeTitle(actors)

    if (existing) {
      await supabaseAdmin.from('notifications')
        .update({ actors, title, created_at: new Date().toISOString() })
        .eq('id', (existing as { id: string }).id)
    } else {
      await supabaseAdmin.from('notifications').insert({
        user_id: postAuthorId, type: 'foro_like', title, link: '/conversacion',
        post_id: postId, actors,
      })
    }
  } catch {
    // silencioso — no bloquea el like, mismo patrón que notifyNewRecording
  }
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
