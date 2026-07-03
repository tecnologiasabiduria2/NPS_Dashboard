'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Lock } from 'lucide-react'
import { clsx } from 'clsx'
import ContentPanel from './ContentPanel'

export interface CardRecording {
  id: string
  title: string
  type: string
  fathom_share_id: string | null
  storage_path: string | null
  completed: boolean
}

export interface ContentCard {
  key: string
  title: string
  badge?: string
  recordings: CardRecording[]
  completed: number
  total: number
  highlighted?: boolean
  // Hiperfoco aún no habilitado: se muestra pero no se puede abrir (se desbloquea
  // cuando el cliente termina el hiperfoco en curso / su Business Coach se lo asigna).
  locked?: boolean
}

// Grid de "clases" estilo comunidad GHL (Aprendizaje). Cada card tiene portada de
// marca + barra de progreso; ABRIR despliega un panel aparte (no expande la card)
// con la lista de contenidos a un costado y el contenido seleccionado al lado.
export default function ContentCards({ cards, userId }: { cards: ContentCard[]; userId: string }) {
  const [activeCard, setActiveCard] = useState<ContentCard | null>(null)

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
        {cards.map(card => {
          const pct = card.total > 0 ? Math.round((card.completed / card.total) * 100) : 0
          return (
            <div
              key={card.key}
              className={clsx(
                'rounded-2xl border bg-surface-850 overflow-hidden flex flex-col',
                card.highlighted ? 'border-brand-600/40' : 'border-surface-700'
              )}
            >
              {/* Portada */}
              <div className={clsx(
                'relative h-28 bg-gradient-to-br from-sand via-accent to-brand-600 flex items-center justify-center px-4',
                card.locked && 'grayscale opacity-60'
              )}>
                <Image
                  src="/logo-icon.png"
                  alt=""
                  width={26}
                  height={26}
                  className="absolute top-3 right-3 opacity-60"
                />
                {card.locked && (
                  <span className="absolute top-3 left-3 w-6 h-6 rounded-full bg-black/40 flex items-center justify-center">
                    <Lock size={13} className="text-white" />
                  </span>
                )}
                <p className="text-center text-lg font-semibold text-white leading-tight drop-shadow">
                  {card.title || '—'}
                </p>
              </div>

              {/* Cuerpo */}
              <div className="p-4 flex flex-col flex-1">
                {card.badge && (
                  <p className="text-[11px] text-brand-400 uppercase tracking-wide font-medium mb-2">{card.badge}</p>
                )}

                {/* Progreso */}
                <div className="mt-auto">
                  {card.locked ? (
                    <p className="flex items-center gap-1.5 text-xs text-cream-muted mb-1">
                      <Lock size={12} /> Termina tu hiperfoco actual para desbloquearlo
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-xs text-cream-muted mb-1">
                        <span>{card.total > 0 ? `${card.completed}/${card.total} vistas` : 'Sin contenido aún'}</span>
                        {card.total > 0 && <span>{pct}%</span>}
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
                        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveCard(card)}
                    disabled={card.locked || card.total === 0}
                    className={clsx(
                      'w-full justify-center mt-4',
                      card.locked || card.total === 0 ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary'
                    )}
                  >
                    {card.locked ? 'Bloqueado' : card.total === 0 ? 'Próximamente' : 'Abrir'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {activeCard && (
        <ContentPanel card={activeCard} userId={userId} onClose={() => setActiveCard(null)} />
      )}
    </>
  )
}
