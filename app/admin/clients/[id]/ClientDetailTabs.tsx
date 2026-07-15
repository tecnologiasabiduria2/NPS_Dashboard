'use client'

import { useState } from 'react'
import { clsx } from 'clsx'

// Pestañas del detalle del cliente (2026-07-14): la ficha se hacía muy larga
// hacia abajo (y la Hoja de vida, que puede ser enorme, era lo primero). Ahora
// las secciones se agrupan en pestañas y se muestra una a la vez; por defecto
// "Resumen" (no la Hoja de vida). Las secciones se renderizan en el server y se
// pasan como props (patrón estándar: server component dentro de client).
const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'seguimiento', label: 'Seguimiento CS' },
  { id: 'sesiones', label: 'Sesiones 1:1' },
  { id: 'hoja', label: 'Hoja de vida' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function ClientDetailTabs({
  resumen,
  seguimiento,
  sesiones,
  hojaDeVida,
}: {
  resumen: React.ReactNode
  seguimiento: React.ReactNode
  sesiones: React.ReactNode
  hojaDeVida: React.ReactNode
}) {
  const [tab, setTab] = useState<TabId>('resumen')

  const content =
    tab === 'resumen' ? resumen
    : tab === 'seguimiento' ? seguimiento
    : tab === 'sesiones' ? sesiones
    : hojaDeVida

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b border-surface-700 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'px-3 h-10 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
              tab === t.id
                ? 'border-brand-500 text-cream'
                : 'border-transparent text-cream-muted hover:text-cream',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {content}
    </div>
  )
}
