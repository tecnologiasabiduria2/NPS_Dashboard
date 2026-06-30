import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { updateContactFields } from '@/lib/ghl/api'

// ============================================================================
// SYNC INVERSO progreso → GHL  (Fase 7 del plan original · Bloque 4)
// Corre 1×/día. Lo dispara el crontab del VPS con un curl al endpoint, protegido
// por CRON_SECRET. Reusa lib/ghl/api.ts (Opción A confirmada por Juan 2026-06-29).
//
//   crontab del VPS (ejemplo, 8:00am):
//     0 8 * * * curl -fsS -H "x-cron-secret: $CRON_SECRET" \
//       https://vip.sabiduriaempresarial.com/api/cron/sync-ghl > /dev/null
//
// Por cada cliente ACTIVO con ghl_contact_id, escribe custom fields en su contacto
// de GHL. GHL es la fuente de verdad del negocio; esto lo mantiene al día para que
// comerciales/CS y Diana vean el consumo sin entrar a la plataforma.
//
// NOTA DE LÓGICA: NO se envía `progress_percent` ni `modules_completed` — el modelo
// de hiperfoco NO es lineal (B6/B10 derogaron el progreso por %; no hay "100%"). En su
// lugar se envía `recordings_completed` (conteo absoluto) + `current_hiperfoco`.
// Los custom fields ya existen en GHL (access_until preexistente; el resto creados por
// API el 2026-06-29, Opción A). Verificado contra GHL real: access_until se puebla OK.
// ============================================================================

// Mapa de custom fields que se escriben en GHL. Cada KEY (pelado) resuelve al
// fieldKey `contact.<key>` de GHL. TODOS verificados/creados en GHL el 2026-06-29:
//   access_until → ya existía (id ZURuFEzgnFMpfrk9bkOc, DATE)
//   los demás → creados por API (Opción A): contact.current_hiperfoco,
//   contact.recordings_completed, contact.last_nps_score (NUMERICAL),
//   contact.last_nps_date, contact.last_activity (DATE), contact.platform_status (TEXT).
const CF_KEYS = {
  access_until: 'access_until',
  platform_status: 'platform_status',
  current_hiperfoco: 'current_hiperfoco',
  recordings_completed: 'recordings_completed',
  last_nps_score: 'last_nps_score',
  last_nps_date: 'last_nps_date',
  last_activity: 'last_activity',
} as const

// Primer día del mes actual (local) en 'YYYY-MM-01'.
function periodoActual(): string {
  const d = new Date()
  d.setDate(1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export async function POST(req: NextRequest) {
  return run(req)
}
// Permite también GET para que el curl del cron sea trivial.
export async function GET(req: NextRequest) {
  return run(req)
}

async function run(req: NextRequest) {
  // --- Auth del cron ------------------------------------------------------
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET no configurado. Define CRON_SECRET en el .env del servidor.' },
      { status: 501 }
    )
  }
  const provided = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.GHL_API_KEY) {
    return NextResponse.json(
      { error: 'GHL_API_KEY no configurada — no se puede sincronizar a GHL.' },
      { status: 501 }
    )
  }

  // --- Datos: clientes activos con contacto en GHL ------------------------
  const { data: accesos, error: accErr } = await supabaseAdmin
    .from('user_access')
    .select('user_id, status, access_until, ghl_contact_id, last_activity')
    .eq('status', 'active')
    .not('ghl_contact_id', 'is', null)

  if (accErr) {
    return NextResponse.json({ error: `Error leyendo user_access: ${accErr.message}` }, { status: 500 })
  }

  const rows = (accesos ?? []).filter(r => r.ghl_contact_id)
  const userIds = [...new Set(rows.map(r => r.user_id as string))]
  if (userIds.length === 0) {
    return NextResponse.json({ ok: true, total: 0, updated: 0, failed: 0, message: 'Sin clientes activos con ghl_contact_id.' })
  }

  const periodo = periodoActual()

  // Hiperfoco del mes (título), NPS más reciente y grabaciones completadas — todo
  // en consultas batched (sin N+1) para los userIds activos.
  const [{ data: uhm }, { data: nps }, { data: recProg }] = await Promise.all([
    supabaseAdmin
      .from('user_hiperfoco_mes')
      .select('user_id, estado, hiperfocos(title)')
      .eq('periodo', periodo)
      .in('user_id', userIds),
    supabaseAdmin
      .from('nps_responses')
      .select('user_id, score, created_at')
      .in('user_id', userIds)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('recording_progress')
      .select('user_id')
      .eq('completed', true)
      .in('user_id', userIds),
  ])

  // user_id -> título del hiperfoco en curso este mes
  const hiperfocoByUser = new Map<string, string>()
  for (const r of (uhm ?? []) as any[]) {
    if (r.estado === 'en_curso' && r.hiperfocos?.title) hiperfocoByUser.set(r.user_id, r.hiperfocos.title)
  }
  // user_id -> NPS más reciente (la query viene ordenada desc; el primero gana)
  const npsByUser = new Map<string, { score: number; date: string }>()
  for (const r of (nps ?? []) as any[]) {
    if (!npsByUser.has(r.user_id)) npsByUser.set(r.user_id, { score: Number(r.score), date: String(r.created_at).slice(0, 10) })
  }
  // user_id -> nº de grabaciones completadas
  const completedByUser = new Map<string, number>()
  for (const r of (recProg ?? []) as any[]) {
    completedByUser.set(r.user_id, (completedByUser.get(r.user_id) ?? 0) + 1)
  }

  // --- Push a GHL contacto por contacto -----------------------------------
  let updated = 0
  let failed = 0
  const errors: { contact: string; error: string }[] = []

  for (const row of rows) {
    const userId = row.user_id as string
    const contactId = row.ghl_contact_id as string

    const fields: Record<string, string | number> = {
      [CF_KEYS.platform_status]: 'active',
      [CF_KEYS.current_hiperfoco]: hiperfocoByUser.get(userId) ?? 'Sin hiperfoco',
      [CF_KEYS.recordings_completed]: completedByUser.get(userId) ?? 0,
    }
    if (row.access_until) fields[CF_KEYS.access_until] = row.access_until as string
    if (row.last_activity) fields[CF_KEYS.last_activity] = String(row.last_activity).slice(0, 10)
    const userNps = npsByUser.get(userId)
    if (userNps) {
      fields[CF_KEYS.last_nps_score] = userNps.score
      fields[CF_KEYS.last_nps_date] = userNps.date
    }

    try {
      await updateContactFields(contactId, fields)
      updated++
    } catch (e) {
      failed++
      errors.push({ contact: contactId, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    total: rows.length,
    updated,
    failed,
    periodo,
    // solo los primeros errores para no inflar la respuesta
    errors: errors.slice(0, 20),
  })
}
