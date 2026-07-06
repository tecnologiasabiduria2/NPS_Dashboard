'use client'

import { useEffect, useState } from 'react'

// Barra de progreso que se rellena animada al montar (en vez de aparecer ya
// llena) — doble rAF para garantizar que el navegador pinte el 0% antes de
// animar al valor real, si no la transición CSS no tiene "desde dónde" partir.
export default function ProgressBar({ percent, color }: { percent: number; color: string }) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setWidth(percent)))
    return () => cancelAnimationFrame(id)
  }, [percent])

  return (
    <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  )
}
