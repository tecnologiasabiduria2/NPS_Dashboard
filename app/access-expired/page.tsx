import Logo from '@/components/Logo'

export default function AccessExpiredPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <Logo size={48} />
        </div>
        <h1 className="text-2xl font-semibold text-cream mb-3">Acceso pausado</h1>
        <p className="text-cream-muted mb-8 leading-relaxed">
          Tu acceso a la plataforma está pausado. Comunícate con el equipo de
          Sabiduría Empresarial para reactivar tu cuenta.
        </p>
        <div className="card text-left">
          <p className="section-label">¿Cómo reactivar?</p>
          <p className="text-cream-muted text-sm leading-relaxed">
            Contacta directamente a tu Business Coach o escribe al equipo de soporte.
            Una vez renovado tu plan, el acceso se activará automáticamente.
          </p>
        </div>
      </div>
    </div>
  )
}
