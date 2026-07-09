import nodemailer from 'nodemailer'

// Aviso por correo cuando un cliente YA REGISTRADO recibe acceso a un producto
// nuevo (alta manual desde admin/clients/create) — no aplica a altas
// totalmente nuevas (reciben su propia invitación) ni a renovaciones del
// mismo producto. Mismo asunto/copy que ya usa el Edge Function `ghl-webhook`
// para el mismo caso vía GHL (`sendProductAddedEmail`, Deno + API HTTP de
// Resend); esta es la versión Node/nodemailer para cuando el alta se hace
// manualmente desde el admin (asimetría encontrada 2026-07-10).
export async function sendProductAddedEmail(to: string, name: string, productTitle: string): Promise<void> {
  const smtpHost = process.env.SMTP_HOST
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM
  if (!smtpHost || !smtpUser || !smtpPass || !from) {
    console.error('sendProductAddedEmail: faltan variables SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM')
    return
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
  })

  try {
    await transporter.sendMail({
      from,
      to,
      subject: `Ya tienes acceso a ${productTitle}`,
      html: `
        <div style="font-family: -apple-system, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
          <p>Hola ${name || ''},</p>
          <p>Ya tienes acceso a <strong>${productTitle}</strong> con tu cuenta de siempre en Sabiduría Empresarial — no necesitas registrarte de nuevo.</p>
          <p style="margin: 24px 0;">
            <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vip.sabiduriaempresarial.com'}/login" style="background:#7E301F;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
              Entrar a la plataforma
            </a>
          </p>
        </div>
      `,
    })
    console.log('sendProductAddedEmail: correo enviado OK a', to)
  } catch (e) {
    console.error('sendProductAddedEmail: excepción al enviar', e instanceof Error ? e.message : String(e))
  }
}
