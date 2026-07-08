// CSP en modo Report-Only (2026-07-09) — inventario completo de recursos externos
// hecho antes de escribirla (ver plan de la sesión): Google Fonts, el iframe del
// Worker de video (NEXT_PUBLIC_WORKER_URL) y Supabase (auth/REST + avatares del
// bucket público) son los únicos orígenes externos reales. Sin analytics, sin
// scripts de terceros, sin Realtime/WebSockets, sin <object>/<embed>/Workers.
// Solo REPORTA violaciones (no bloquea nada) hasta confirmar en consola de
// producción que no rompe nada — recién ahí se pasa a bloqueante de verdad.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

const csp = [
  `default-src 'self'`,
  `script-src 'self'`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' https://fonts.gstatic.com`,
  `img-src 'self' data: ${SUPABASE_URL}`,
  `connect-src 'self' ${SUPABASE_URL}`,
  `frame-src ${WORKER_URL}`,
  `object-src 'none'`,
  `worker-src 'none'`,
  `form-action 'self'`,
  `base-uri 'self'`,
  `frame-ancestors 'self'`,
].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    const securityHeaders = [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
    ]
    // Solo en producción — el modo dev de Next (webpack HMR) no siempre calza
    // con una CSP estricta, y esta protección solo importa en el dominio real.
    if (process.env.NODE_ENV === 'production') {
      securityHeaders.push({ key: 'Content-Security-Policy-Report-Only', value: csp })
    }
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
