import nodemailer from 'nodemailer'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { DEFAULT_NPS_COPY } from '@/lib/nps'

// ============================================================================
// NPS automático por correo (2026-07-03, ajustado 2026-07-03 noche para
// escalar más allá de los ~5 clientes de hoy). Lógica compartida entre el cron
// (/api/cron/send-nps-emails, agendado) y el botón manual del admin
// (/api/admin/send-nps-emails, para probar/forzar un envío inmediato).
//
// Busca sesiones publicadas que terminaron entre hace 1h y hace 24h y aún no
// se les mandó correo, toma los asistentes reales (live_session_attendance),
// y les manda el link /nps/{token} por correo (mismo SMTP que ya usa Supabase
// Auth para invitación/reset — Resend como relay).
//
// Dos cosas que se ajustaron pensando en crecer (150 clientes en unos meses,
// no solo los 5 de hoy):
//  1. Las sesiones se marcan "procesadas" ANTES de mandar los correos, no
//     después. Si el cron corre cada 30 min y una tanda tarda más que eso
//     (mucho volumen), sin esto dos corridas podrían tomar la misma sesión
//     al mismo tiempo y mandar el correo duplicado. Ahora, en cuanto se
//     detecta una sesión pendiente, se reclama de una — la siguiente corrida
//     ya no la vuelve a ver, mande lo que mande esta.
//  2. Los correos se mandan en paralelo (con un límite), no uno por uno. Con
//     pocos destinatarios uno por uno no se nota, pero con decenas de correos
//     por tanda, secuencial puede tardar más de lo que nginx espera por una
//     respuesta (encontramos justo este problema hoy).
// ============================================================================

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vip.sabiduriaempresarial.com'
const SEND_CONCURRENCY = 5

export interface NpsEmailBatchResult {
  ok: boolean
  configured: boolean
  sessionsProcessed: number
  emailsSent: number
  emailsFailed: number
  errors: { session: string; error: string }[]
}

async function sendNpsEmail(opts: {
  transporter: nodemailer.Transporter
  from: string
  to: string
  name: string
  sessionTitle: string
  link: string
}) {
  const question = DEFAULT_NPS_COPY.post_sesion.question
  await opts.transporter.sendMail({
    from: opts.from,
    to: opts.to,
    subject: `¿Cómo estuvo «${opts.sessionTitle}»?`,
    html: `
      <div style="font-family: -apple-system, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <p>Hola ${opts.name || ''},</p>
        <p>Terminaste hace poco la sesión <strong>${opts.sessionTitle}</strong>. ${question}</p>
        <p style="margin: 24px 0;">
          <a href="${opts.link}" style="background:#7E301F;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
            Calificar sesión
          </a>
        </p>
        <p style="font-size: 13px; color: #666;">Si el botón no funciona, copia este link: ${opts.link}</p>
      </div>
    `,
  })
}

// Corre `worker` sobre `items` con a lo sumo `limit` en paralelo a la vez.
async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let index = 0
  async function next(): Promise<void> {
    const i = index++
    if (i >= items.length) return
    await worker(items[i])
    return next()
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next))
}

export interface NpsEmailPending {
  sessionsCount: number
  recipientsCount: number
}

// Solo lectura: cuántas sesiones califican ahora mismo (terminaron hace 1-24h,
// sin correo mandado) y a cuántos destinatarios reales les tocaría (asistentes
// que aún no calificaron). Para mostrar debajo del botón, sin mandar nada ni
// reclamar sesiones.
export async function countPendingNpsEmails(): Promise<NpsEmailPending> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: sessions } = await supabaseAdmin
    .from('live_sessions')
    .select('id')
    .eq('is_published', true)
    .is('nps_email_sent_at', null)
    .lte('ends_at', oneHourAgo)
    .gte('ends_at', oneDayAgo)

  let recipientsCount = 0
  for (const session of sessions ?? []) {
    const { data: attendance } = await supabaseAdmin
      .from('live_session_attendance')
      .select('user_id')
      .eq('session_id', session.id)
    const attendeeIds = [...new Set((attendance ?? []).map((a: any) => a.user_id as string))]
    if (attendeeIds.length === 0) continue

    const { data: already } = await supabaseAdmin
      .from('nps_responses')
      .select('user_id')
      .eq('live_session_id', session.id)
      .eq('trigger', 'post_sesion')
      .in('user_id', attendeeIds)
    const answeredSet = new Set((already ?? []).map((r: any) => r.user_id as string))
    recipientsCount += attendeeIds.filter(id => !answeredSet.has(id)).length
  }

  return { sessionsCount: sessions?.length ?? 0, recipientsCount }
}

export async function runNpsEmailBatch(): Promise<NpsEmailBatchResult> {
  const smtpHost = process.env.SMTP_HOST
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const fromAddress = process.env.SMTP_FROM
  if (!smtpHost || !smtpUser || !smtpPass || !fromAddress) {
    return { ok: false, configured: false, sessionsProcessed: 0, emailsSent: 0, emailsFailed: 0, errors: [] }
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
  })

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Reclamar en UN SOLO UPDATE atómico (con el mismo WHERE que antes se hacía en
  // un SELECT aparte). Esto sí cierra la carrera de verdad: si dos llamadas
  // llegan al mismo tiempo (cron + botón manual, o el cron solapándose consigo
  // mismo), Postgres serializa el UPDATE — la segunda ve 0 filas para reclamar,
  // en vez de repetir el envío. Un SELECT-y-despues-UPDATE separado (lo que
  // había antes) no alcanza a cerrar esa ventana, se probó y sí duplicaba.
  const { data: claimed } = await supabaseAdmin
    .from('live_sessions')
    .update({ nps_email_sent_at: new Date().toISOString() })
    .eq('is_published', true)
    .is('nps_email_sent_at', null)
    .lte('ends_at', oneHourAgo)
    .gte('ends_at', oneDayAgo)
    .select('id, title, nps_token')

  const pending = claimed ?? []
  if (pending.length === 0) {
    return { ok: true, configured: true, sessionsProcessed: 0, emailsSent: 0, emailsFailed: 0, errors: [] }
  }

  let emailsSent = 0
  let emailsFailed = 0
  const errors: { session: string; error: string }[] = []

  // Armar la lista completa de "a quién mandarle qué" antes de mandar nada,
  // para poder procesarla en paralelo (con límite) en vez de sesión por sesión.
  type Job = { userId: string; name: string; sessionTitle: string; link: string }
  const jobs: Job[] = []

  for (const session of pending) {
    const { data: attendance } = await supabaseAdmin
      .from('live_session_attendance')
      .select('user_id')
      .eq('session_id', session.id)

    const attendeeIds = [...new Set((attendance ?? []).map((a: any) => a.user_id as string))]
    if (attendeeIds.length === 0) continue

    const { data: already } = await supabaseAdmin
      .from('nps_responses')
      .select('user_id')
      .eq('live_session_id', session.id)
      .eq('trigger', 'post_sesion')
      .in('user_id', attendeeIds)

    const answeredSet = new Set((already ?? []).map((r: any) => r.user_id as string))
    const pendingIds = attendeeIds.filter(id => !answeredSet.has(id))
    if (pendingIds.length === 0) continue

    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .in('id', pendingIds)
    const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name as string]))

    for (const userId of pendingIds) {
      jobs.push({
        userId,
        name: nameById.get(userId) ?? '',
        sessionTitle: session.title,
        link: `${SITE_URL}/nps/${session.nps_token}`,
      })
    }
  }

  await runWithConcurrency(jobs, SEND_CONCURRENCY, async (job) => {
    try {
      const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(job.userId)
      const email = userRes?.user?.email
      if (!email) return

      await sendNpsEmail({
        transporter,
        from: fromAddress,
        to: email,
        name: job.name,
        sessionTitle: job.sessionTitle,
        link: job.link,
      })
      emailsSent++
    } catch (e) {
      emailsFailed++
      errors.push({ session: job.sessionTitle, error: e instanceof Error ? e.message : String(e) })
    }
  })

  return { ok: emailsFailed === 0, configured: true, sessionsProcessed: pending.length, emailsSent, emailsFailed, errors: errors.slice(0, 20) }
}
