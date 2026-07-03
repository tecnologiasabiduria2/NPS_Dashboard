import nodemailer from 'nodemailer'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { DEFAULT_NPS_COPY } from '@/lib/nps'

// ============================================================================
// NPS automático por correo (2026-07-03). Lógica compartida entre el cron
// (/api/cron/send-nps-emails, agendado) y el botón manual del admin
// (/api/admin/send-nps-emails, para probar/forzar un envío inmediato).
//
// Busca sesiones publicadas que terminaron entre hace 1h y hace 24h y aún no
// se les mandó correo, toma los asistentes reales (live_session_attendance),
// y les manda el link /nps/{token} por correo (mismo SMTP que ya usa Supabase
// Auth para invitación/reset — Resend como relay). Marca la sesión como
// procesada para no repetir el envío.
// ============================================================================

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vip.sabiduriaempresarial.com'

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

  const { data: sessions } = await supabaseAdmin
    .from('live_sessions')
    .select('id, title, nps_token')
    .eq('is_published', true)
    .is('nps_email_sent_at', null)
    .lte('ends_at', oneHourAgo)
    .gte('ends_at', oneDayAgo)

  let sessionsProcessed = 0
  let emailsSent = 0
  let emailsFailed = 0
  const errors: { session: string; error: string }[] = []

  for (const session of sessions ?? []) {
    const { data: attendance } = await supabaseAdmin
      .from('live_session_attendance')
      .select('user_id')
      .eq('session_id', session.id)

    const attendeeIds = [...new Set((attendance ?? []).map((a: any) => a.user_id as string))]

    if (attendeeIds.length > 0) {
      const { data: already } = await supabaseAdmin
        .from('nps_responses')
        .select('user_id')
        .eq('live_session_id', session.id)
        .eq('trigger', 'post_sesion')
        .in('user_id', attendeeIds)

      const answeredSet = new Set((already ?? []).map((r: any) => r.user_id as string))
      const pendingIds = attendeeIds.filter(id => !answeredSet.has(id))

      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name')
        .in('id', pendingIds)
      const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name as string]))

      for (const userId of pendingIds) {
        try {
          const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(userId)
          const email = userRes?.user?.email
          if (!email) continue

          await sendNpsEmail({
            transporter,
            from: fromAddress,
            to: email,
            name: nameById.get(userId) ?? '',
            sessionTitle: session.title,
            link: `${SITE_URL}/nps/${session.nps_token}`,
          })
          emailsSent++
        } catch (e) {
          emailsFailed++
          errors.push({ session: session.title, error: e instanceof Error ? e.message : String(e) })
        }
      }
    }

    await supabaseAdmin
      .from('live_sessions')
      .update({ nps_email_sent_at: new Date().toISOString() })
      .eq('id', session.id)
    sessionsProcessed++
  }

  return { ok: emailsFailed === 0, configured: true, sessionsProcessed, emailsSent, emailsFailed, errors: errors.slice(0, 20) }
}
