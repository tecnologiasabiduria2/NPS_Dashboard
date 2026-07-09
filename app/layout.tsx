import type { Metadata } from 'next'
import { headers } from 'next/headers'
import './globals.css'
import ToastContainer from '@/components/ToastContainer'

export const metadata: Metadata = {
  title: 'Sabiduría Empresarial',
  description: 'Plataforma de aprendizaje empresarial',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Leer el nonce (aunque no se use directo abajo) es lo que hace que Next.js
  // le ponga el nonce del middleware a sus propios scripts inline de hidratación
  // — y de paso obliga a renderizar dinámico en cada request, no una vez al
  // build. Sin esto, páginas sin datos dinámicos (ej. /login) quedaban
  // pre-renderizadas ESTÁTICAS con sus scripts inline sin nonce, mientras la
  // CSP exige uno nuevo en cada request → el navegador bloqueaba todo
  // (encontrado en producción 2026-07-09, tras pasar la CSP a bloqueante).
  await headers()

  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <ToastContainer />
      </body>
    </html>
  )
}
