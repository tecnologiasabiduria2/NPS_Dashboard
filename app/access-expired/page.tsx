import Image from 'next/image'
import { ArrowRight, Sparkles } from 'lucide-react'
import LogoutButton from './LogoutButton'

// Pantalla de acceso pausado / paywall (5c). Destino del gating cuando un
// inactivo entra a la plataforma (layout) o intenta unirse a una sesión
// (?reason=session). El CTA lleva al subdominio de pagos (NEXT_PUBLIC_RENEW_URL),
// que sirve tanto para renovar como para inscribirse. Si la variable está vacía,
// se muestra solo el mensaje de contacto (degrada sin romper).
export default async function AccessExpiredPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  const fromSession = reason === 'session'
  const renewUrl = process.env.NEXT_PUBLIC_RENEW_URL

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 py-10 overflow-hidden"
      style={{ background: 'radial-gradient(1000px 700px at 50% 15%, #2A0C0C 0%, #160707 48%, #08050A 100%)' }}
    >
      <div
        className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 w-[560px] h-[420px] rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #7E301F 0%, transparent 70%)' }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-3xl border border-surface-700/80 bg-surface-900/80 backdrop-blur-xl shadow-2xl shadow-black/40 p-8 text-center relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />

          <div className="flex justify-center mb-6">
            <span className="w-16 h-16 rounded-2xl bg-brand-600/15 border border-brand-600/25 flex items-center justify-center">
              <Sparkles size={26} className="text-accent" />
            </span>
          </div>

          <h1 className="text-2xl font-semibold text-cream mb-3">
            {fromSession ? 'Necesitas un plan activo' : 'Tu acceso está pausado'}
          </h1>
          <p className="text-cream-muted mb-8 leading-relaxed">
            {fromSession
              ? 'Para entrar a esta sesión en vivo necesitas tu acceso activo a Sabiduría Empresarial. Renueva tu plan y sigue justo donde lo dejaste.'
              : 'Tu acceso a la plataforma está pausado. Renueva tu plan para volver a tus clases, eventos y tu ruta de aprendizaje.'}
          </p>

          {renewUrl && (
            <a
              href={renewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full justify-center py-3 text-base group mb-3"
            >
              Renovar mi acceso
              <ArrowRight size={17} className="ml-1.5 transition-transform group-hover:translate-x-0.5" />
            </a>
          )}

          <p className="text-xs text-cream-muted leading-relaxed">
            {renewUrl
              ? 'Al renovar, tu acceso se reactiva automáticamente. ¿Dudas? Escribe a tu Business Coach.'
              : 'Contacta a tu Business Coach para renovar. Una vez activo, el acceso se habilita automáticamente.'}
          </p>

          <div className="mt-8 pt-5 border-t border-surface-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image src="/logo-icon.png" alt="" width={18} height={18} className="object-contain opacity-70" />
              <span className="text-xs text-cream-muted">Sabiduría Empresarial</span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </div>
    </div>
  )
}
