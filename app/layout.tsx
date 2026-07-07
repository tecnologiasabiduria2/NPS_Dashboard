import type { Metadata } from 'next'
import './globals.css'
import ToastContainer from '@/components/ToastContainer'

export const metadata: Metadata = {
  title: 'Sabiduría Empresarial',
  description: 'Plataforma de aprendizaje empresarial',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
