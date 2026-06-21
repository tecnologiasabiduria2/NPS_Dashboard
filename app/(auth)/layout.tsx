import Logo from '@/components/Logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-surface-950">
      {/* Panel izquierdo — brand */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-10 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #3D1010 0%, #1A0808 50%, #0A0608 100%)',
        }}
      >
        {/* Textura sutil */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #7E301F 0%, transparent 70%)' }}
        />

        <div className="relative z-10 flex items-center gap-3">
          <Logo size={36} />
          <div>
            <p className="text-cream text-sm font-semibold tracking-widest uppercase">Sabiduría</p>
            <p className="text-cream-muted text-xs tracking-widest uppercase">Empresarial</p>
          </div>
        </div>

        <div className="relative z-10">
          <blockquote className="text-cream/80 text-lg font-light leading-relaxed italic mb-6">
            "El crecimiento sin control es solo movimiento. Con Sabiduría, es dirección."
          </blockquote>
          <div className="w-12 h-px bg-brand-600" />
        </div>

        <div className="relative z-10">
          <p className="text-cream-muted text-xs">© 2026 Sabiduría Empresarial</p>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <Logo size={28} />
            <p className="text-cream font-semibold tracking-wide">SABIDURÍA EMPRESARIAL</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
