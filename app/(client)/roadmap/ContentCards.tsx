'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Lock, CheckCircle2, Circle, ArrowRight } from 'lucide-react'
import { clsx } from 'clsx'
import { getHiperfocoVisual } from '@/lib/hiperfocoVisual'
import ProgressBar from '@/components/ProgressBar'
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

interface Props {
  current: ContentCard | null
  historial: ContentCard[]
  transversal: ContentCard[]
  userId: string
}

// Aprendizaje en 3 niveles: el hiperfoco EN CURSO es la tesis de la página (hero
// propio, no una tarjeta más en la grilla) → Historial (grilla compacta) →
// Recursos de la comunidad (SG/EC, contenido compartido, no personal). Cada
// hiperfoco tiene ícono + color propio (lib/hiperfocoVisual) para reconocerse
// de un vistazo, reutilizable en cualquier otro panel que muestre hiperfocos.
export default function ContentCards({ current, historial, transversal, userId }: Props) {
  const [activeCard, setActiveCard] = useState<ContentCard | null>(null)

  return (
    <>
      <div className="space-y-10">
        {current && <HeroCard card={current} onOpen={() => setActiveCard(current)} />}

        {historial.length > 0 && (
          <section>
            <p className="section-label">Historial</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {historial.map((card, i) => (
                <CompactCard key={card.key} card={card} onOpen={() => setActiveCard(card)} delayMs={i * 60} />
              ))}
            </div>
          </section>
        )}

        {transversal.length > 0 && (
          <section>
            <p className="section-label">Recursos de la comunidad</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {transversal.map((card, i) => (
                <CompactCard key={card.key} card={card} onOpen={() => setActiveCard(card)} delayMs={i * 60} shared />
              ))}
            </div>
          </section>
        )}
      </div>

      {activeCard && (
        <ContentPanel card={activeCard} userId={userId} onClose={() => setActiveCard(null)} />
      )}
    </>
  )
}

// Único momento "de autor" de la página: como las tarjetas de abajo quedaron
// fieles a la marca (naranja uniforme, pedido explícito de Juan 2026-07-05),
// todo el riesgo visual se concentra aquí — color pleno (no lavado), ícono del
// hiperfoco como marca de agua grande, tipografía más grande.
function HeroCard({ card, onOpen }: { card: ContentCard; onOpen: () => void }) {
  const visual = getHiperfocoVisual(card.title)
  const Icon = visual.icon
  const hasContent = card.total > 0

  return (
    <section
      className="relative rounded-3xl overflow-hidden animate-fade-up"
      style={{ background: `linear-gradient(120deg, ${visual.to} 0%, ${visual.to} 35%, ${visual.from} 100%)` }}
    >
      <Icon size={220} strokeWidth={1} className="absolute -right-8 -bottom-10 text-white/10 pointer-events-none" />

      <div className="relative p-6 sm:p-10">
        <div className="mb-7">
          <p className="text-xs uppercase tracking-widest font-semibold mb-2 text-white/70">
            Tu enfoque de este mes{card.badge ? ` · ${card.badge}` : ''}
          </p>
          <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight drop-shadow-sm">{card.title || '—'}</h2>
        </div>

        {hasContent ? (
          <>
            <ul className="space-y-2 mb-7 max-w-xl">
              {card.recordings.map(rec => (
                <li key={rec.id} className="flex items-center gap-2.5 text-sm">
                  {rec.completed
                    ? <CheckCircle2 size={17} className="text-white shrink-0" />
                    : <Circle size={17} className="text-white/40 shrink-0" />}
                  <span className={rec.completed ? 'text-white/70 line-through decoration-white/30' : 'text-white font-medium'}>{rec.title}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={onOpen}
                className="bg-white hover:bg-cream text-brand-700 font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 text-sm inline-flex items-center gap-2"
              >
                {card.completed === card.total ? 'Repasar' : 'Continuar'}
                <ArrowRight size={15} />
              </button>
              <span className="text-xs text-white/70">{card.completed}/{card.total} completados</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-white/70">Aún no hay contenido cargado para este hiperfoco.</p>
        )}
      </div>
    </section>
  )
}

function CompactCard({ card, onOpen, shared, delayMs = 0 }: { card: ContentCard; onOpen: () => void; shared?: boolean; delayMs?: number }) {
  const pct = card.total > 0 ? Math.round((card.completed / card.total) * 100) : 0
  const disabled = card.locked || card.total === 0

  return (
    <div
      className={clsx(
        'rounded-2xl border overflow-hidden flex flex-col animate-fade-up',
        shared ? 'border-dashed border-surface-600 bg-surface-850/60' : 'border-surface-700 bg-surface-850'
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {/* Portada de marca (fiel a la guía de referencia panel_de_aprendizaje.png): mismo degradado
          naranja en todas las tarjetas, no un color por hiperfoco — esa identidad se reserva al hero. */}
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

      <div className="p-4 flex flex-col flex-1">
        {shared && <p className="text-[11px] text-cream-muted uppercase tracking-wide mb-2">Comunidad</p>}

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
              <ProgressBar percent={pct} color="#DA7D41" />
            </>
          )}

          <button
            type="button"
            onClick={onOpen}
            disabled={disabled}
            className={clsx('w-full justify-center mt-3', disabled ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary')}
          >
            {card.locked ? 'Bloqueado' : card.total === 0 ? 'Próximamente' : 'Abrir'}
          </button>
        </div>
      </div>
    </div>
  )
}
