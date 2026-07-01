import Image from 'next/image'

// Textura de constelación (nodos + líneas) en la paleta de marca. Sutil, decorativa.
function Constellation() {
  const nodes = [
    [40, 80], [120, 40], [90, 160], [30, 240], [160, 210], [70, 330],
    [180, 360], [40, 430], [140, 470], [90, 540], [200, 520], [30, 560],
  ]
  const links: [number, number][] = [
    [0, 1], [0, 2], [1, 2], [2, 3], [2, 4], [3, 5], [4, 6], [5, 7],
    [5, 8], [6, 8], [7, 9], [8, 10], [9, 11], [9, 10],
  ]
  return (
    <svg
      className="absolute inset-y-0 left-0 h-full w-2/3 pointer-events-none"
      viewBox="0 0 240 600"
      fill="none"
      preserveAspectRatio="xMinYMid slice"
      aria-hidden
    >
      <g stroke="#DA7D41" strokeWidth="0.5" opacity="0.18">
        {links.map(([a, b], i) => (
          <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} />
        ))}
      </g>
      <g fill="#EAAD74" opacity="0.4">
        {nodes.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.8 : 1.1} />
        ))}
      </g>
    </svg>
  )
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-screen overflow-hidden flex items-center justify-center px-4 py-10"
      style={{ background: 'radial-gradient(1100px 750px at 18% 30%, #3D1010 0%, #1A0808 46%, #08050A 100%)' }}
    >
      <Constellation />
      {/* Glow de marca */}
      <div
        className="pointer-events-none absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(circle, #7E301F 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #DA7D41 0%, transparent 70%)' }}
      />

      <div className="relative z-10 w-full max-w-5xl grid lg:grid-cols-2 gap-12 items-center">
        {/* Marca (desktop) */}
        <div className="hidden lg:flex flex-col items-start">
          <Image
            src="/logo-horizontal.png"
            alt="Sabiduría Empresarial"
            width={300}
            height={80}
            className="object-contain mb-8"
            priority
          />
          <blockquote className="text-cream/80 text-xl font-light leading-relaxed italic max-w-sm">
            "El crecimiento sin control es solo movimiento. Con Sabiduría, es dirección."
          </blockquote>
          <div className="w-14 h-px bg-accent/70 mt-6" />
          <p className="text-cream-muted text-xs mt-10">© 2026 Sabiduría Empresarial</p>
        </div>

        {/* Tarjeta de login */}
        <div className="w-full max-w-md mx-auto lg:mx-0">
          {/* Marca (mobile) */}
          <div className="flex items-center justify-center gap-3 mb-8 lg:hidden">
            <Image src="/logo-icon.png" alt="" width={30} height={30} className="object-contain" priority />
            <p className="text-cream font-semibold tracking-wide">SABIDURÍA EMPRESARIAL</p>
          </div>

          <div className="rounded-3xl border border-surface-700/80 bg-surface-900/75 backdrop-blur-xl shadow-2xl shadow-black/40 p-8 relative overflow-hidden">
            {/* Hairline dorada superior */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
