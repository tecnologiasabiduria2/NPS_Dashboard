'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface CarouselBanner {
  id: string
  titulo: string
  imageUrl: string
  imageUrlMobile: string | null
  link_url: string | null
}

// Slide bar de anuncios arriba de Inicio (2026-07-14, pedido de Diana: banner
// "determinante" como carrusel horizontal, ya no apilado en el riel derecho).
// Auto-avanza, con dots y swipe táctil. Cada banner puede traer una imagen
// mobile distinta (más vertical) vía <picture>; si no, usa la desktop.
const INTERVAL_MS = 6000

export default function BannerCarousel({ banners }: { banners: CarouselBanner[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const count = banners.length

  useEffect(() => {
    if (count <= 1 || paused) return
    const t = setInterval(() => setIndex(i => (i + 1) % count), INTERVAL_MS)
    return () => clearInterval(t)
  }, [count, paused])

  // Si cambia la cantidad de banners, no dejar el índice fuera de rango.
  useEffect(() => {
    if (index > count - 1) setIndex(0)
  }, [count, index])

  if (count === 0) return null

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 40) {
      setIndex(i => (dx < 0 ? (i + 1) % count : (i - 1 + count) % count))
    }
    touchStartX.current = null
  }

  return (
    <div
      className="relative rounded-2xl overflow-hidden mb-6 animate-fade-up bg-surface-850"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {banners.map(b => {
          const img = (
            <picture>
              {b.imageUrlMobile && <source media="(max-width: 640px)" srcSet={b.imageUrlMobile} />}
              {/* Altura fija responsive + object-contain (2026-07-15, fix): no
                  todas las imágenes que suben son horizontales — con
                  object-cover una imagen vertical quedaba recortada de forma
                  fea (se comía los lados). object-contain siempre muestra la
                  imagen completa, sin recorte; si no llena el ancho/alto deja
                  franjas del fondo de la tarjeta (bg-surface-850 del
                  contenedor), nunca corta contenido. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.imageUrl}
                alt={b.titulo}
                className="w-full h-44 sm:h-52 lg:h-60 object-contain object-center block select-none"
                draggable={false}
              />
            </picture>
          )
          return (
            <div key={b.id} className="w-full shrink-0 flex items-center justify-center bg-surface-850">
              {b.link_url ? (
                <Link href={b.link_url} target="_blank" rel="noopener noreferrer" className="block w-full">
                  {img}
                </Link>
              ) : (
                img
              )}
            </div>
          )
        })}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIndex(i => (i - 1 + count) % count)}
            aria-label="Anuncio anterior"
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-surface-950/50 hover:bg-surface-950/70 text-cream flex items-center justify-center transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => setIndex(i => (i + 1) % count)}
            aria-label="Siguiente anuncio"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-surface-950/50 hover:bg-surface-950/70 text-cream flex items-center justify-center transition-colors"
          >
            <ChevronRight size={18} />
          </button>

          <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ir al banner ${i + 1}`}
                className={
                  'h-1.5 rounded-full transition-all ' +
                  (i === index ? 'w-5 bg-cream' : 'w-1.5 bg-cream/40 hover:bg-cream/70')
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
