import Logo from '@/components/Logo'

// Página de acceso pausado / paywall (5c). También es el destino del "pop-up de
// ventas" cuando un inactivo intenta entrar a una sesión (?reason=session).
// El CTA "Renovar acceso" apunta a NEXT_PUBLIC_RENEW_URL (funnel de GHL / WhatsApp,
// configurable); si no está definido, se muestra solo el mensaje de contacto.
export default async function AccessExpiredPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  const fromSession = reason === 'session'
  const renewUrl = process.env.NEXT_PUBLIC_RENEW_URL

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <Logo size={48} />
        </div>
        <h1 className="text-2xl font-semibold text-cream mb-3">
          {fromSession ? 'Necesitas un plan activo' : 'Acceso pausado'}
        </h1>
        <p className="text-cream-muted mb-8 leading-relaxed">
          {fromSession
            ? 'Para entrar a esta sesión en vivo necesitas tener tu acceso activo a Sabiduría Empresarial.'
            : 'Tu acceso a la plataforma está pausado. Comunícate con el equipo de Sabiduría Empresarial para reactivar tu cuenta.'}
        </p>

        {renewUrl && (
          <a
            href={renewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full justify-center mb-4"
          >
            Renovar acceso
          </a>
        )}

        <div className="card text-left">
          <p className="section-label">¿Cómo reactivar?</p>
          <p className="text-cream-muted text-sm leading-relaxed">
            {renewUrl
              ? 'Renueva tu plan con el botón de arriba, o contacta a tu Business Coach. Una vez activo, el acceso se habilita automáticamente.'
              : 'Contacta a tu Business Coach o al equipo de soporte. Una vez renovado tu plan, el acceso se activará automáticamente.'}
          </p>
        </div>
      </div>
    </div>
  )
}
