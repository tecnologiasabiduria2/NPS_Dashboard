import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { timingSafeEqualStr } from '@/lib/timingSafeEqual'
import { notifyUsers } from '@/lib/notifications'
import { sessionTipoLabel } from '@/lib/sessionTypes'

// ============================================================================
// Recordatorio in-app "sesión próxima" (2026-07-15, notificaciones Fase 6)
// Mismo patrón que /api/cron/sync-ghl: lo dispara el crontab del VPS con un
// curl protegido por CRON_SECRET, corre cada 15-30 min.
//
//   crontab del VPS (cada 15 min):
//     */15 * * * * curl -fsS -H "x-cron-secret: $CRON_SECRET" \
//       https://vip.sabiduriaempresarial.com/api/cron/session-reminders > /dev/null
//
// Busca sesiones publicadas que empiezan en la próxima hora y notifica a sus
// destinatarios reales — mismo criterio de visibilidad que ya usa el cliente
// en app/(client)/sessions/page.tsx (producto + hiperfoco activo del mes,
// fix punto 6 2026-07-15). dedupe_key en `notifications` evita notificar 2
// veces la misma sesión aunque el cron corra varias veces antes de que empiece.
// ============================================================================

export async function POST(req: NextRequest) {
  return run(req)
}
export async function GET(req: NextRequest) {
  return run(req)
}

async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET no configurado.' }, { status: 501 })
  }
  const provided = req.headers.get('x-cron-secret') ?? ''
  if (!timingSafeEqualStr(provided, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const in1h = new Date(now.getTime() + 60 * 60 * 1000)

  const { data: sessions, error } = await supabaseAdmin
    .from('live_sessions')
    .select('id, title, tipo, starts_at, hiperfoco_nombre, product_id')
    .eq('is_published', true)
    .gte('starts_at', now.toISOString())
    .lte('starts_at', in1h.toISOString())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let notified = 0
  for (const s of (sessions ?? []) as any[]) {
    const recipients = await getSessionRecipients(s)
    if (recipients.length === 0) continue
    await notifyUsers({
      userIds: recipients,
      type: 'sesion_proxima',
      title: 'Tu sesión empieza pronto',
      body: s.title || sessionTipoLabel(s.tipo),
      link: '/sessions',
      dedupeKey: `sesion_proxima:${s.id}`,
    })
    notified += recipients.length
  }

  return NextResponse.json({ ok: true, sessions: sessions?.length ?? 0, notified })
}

function periodoActual(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

async function getSessionRecipients(s: { id: string; hiperfoco_nombre: string | null; product_id: string | null }): Promise<string[]> {
  let accessQuery = supabaseAdmin.from('user_access').select('user_id, product_id').eq('status', 'active')
  if (s.product_id) accessQuery = accessQuery.eq('product_id', s.product_id)
  const { data: accessRows } = await accessQuery
  let userIds = [...new Set((accessRows ?? []).map(r => r.user_id as string))]
  if (userIds.length === 0) return []

  // Sesión de un hiperfoco específico (no transversal/general): solo quien lo
  // tenga en_curso este mes — mismo filtro que app/(client)/sessions/page.tsx.
  if (s.hiperfoco_nombre) {
    const { data: hfRows } = await supabaseAdmin
      .from('user_hiperfoco_mes')
      .select('user_id, hiperfocos(title)')
      .eq('periodo', periodoActual())
      .eq('estado', 'en_curso')
      .in('user_id', userIds)
    userIds = ((hfRows ?? []) as any[])
      .filter(r => (Array.isArray(r.hiperfocos) ? r.hiperfocos[0]?.title : r.hiperfocos?.title) === s.hiperfoco_nombre)
      .map(r => r.user_id as string)
  }
  return userIds
}
