'use client'

import { useEffect, useRef, useState } from 'react'
import { X, ZoomIn } from 'lucide-react'

// Recortador de imágenes (2026-07-16, alternativa elegida por Juan para
// banners: "normalizar al subir" en vez de adivinar en tiempo real cómo
// mostrar una imagen de proporción rara). Sin dependencias nuevas — arrastre
// + zoom + recorte a canvas, todo con APIs nativas del navegador. Genérico,
// no depende de banners; recibe el aspect ratio deseado.

interface Props {
  file: File
  aspectRatio: number // ancho / alto deseado
  outputWidth?: number // px de salida, por defecto 1200
  onCancel: () => void
  onCropped: (blob: Blob, fileName: string) => void
}

const BOX_WIDTH = 480

export default function ImageCropper({ file, aspectRatio, outputWidth = 1200, onCancel, onCropped }: Props) {
  const boxW = BOX_WIDTH
  const boxH = Math.round(BOX_WIDTH / aspectRatio)

  const imgRef = useRef<HTMLImageElement | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const coverScale = natural ? Math.max(boxW / natural.w, boxH / natural.h) : 1
  const scale = coverScale * zoom
  const dispW = natural ? natural.w * scale : 0
  const dispH = natural ? natural.h * scale : 0

  function clamp(offX: number, offY: number) {
    const minX = Math.min(0, boxW - dispW)
    const minY = Math.min(0, boxH - dispH)
    return { x: Math.min(0, Math.max(offX, minX)), y: Math.min(0, Math.max(offY, minY)) }
  }

  function onImgLoad() {
    const img = imgRef.current
    if (!img) return
    const w = img.naturalWidth
    const h = img.naturalHeight
    setNatural({ w, h })
    const cs = Math.max(boxW / w, boxH / h)
    const dw = w * cs
    const dh = h * cs
    setOffset({ x: (boxW - dw) / 2, y: (boxH - dh) / 2 })
  }

  function onPointerDown(e: React.PointerEvent) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setOffset(clamp(dragRef.current.origX + dx, dragRef.current.origY + dy))
  }
  function onPointerUp() {
    dragRef.current = null
  }

  function onZoomChange(v: number) {
    setZoom(v)
    // Re-clampea con la nueva escala para no dejar huecos al hacer zoom out.
    const cs = natural ? Math.max(boxW / natural.w, boxH / natural.h) : 1
    const s = cs * v
    const dw = (natural?.w ?? 0) * s
    const dh = (natural?.h ?? 0) * s
    const minX = Math.min(0, boxW - dw)
    const minY = Math.min(0, boxH - dh)
    setOffset(o => ({ x: Math.min(0, Math.max(o.x, minX)), y: Math.min(0, Math.max(o.y, minY)) }))
  }

  function confirm() {
    const img = imgRef.current
    if (!img || !natural) return
    // Para recortes en retrato (aspectRatio < 1), fijar el ALTO en vez del
    // ancho — si no, un 4:5 saldría en 1200x1500 (más grande de lo necesario).
    const outW = aspectRatio >= 1 ? outputWidth : Math.round(outputWidth * aspectRatio)
    const outH = aspectRatio >= 1 ? Math.round(outputWidth / aspectRatio) : outputWidth
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const sx = -offset.x / scale
    const sy = -offset.y / scale
    const sw = boxW / scale
    const sh = boxH / scale
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)

    canvas.toBlob(blob => {
      if (blob) onCropped(blob, file.name.replace(/\.[^.]+$/, '') + '-recortada.jpg')
    }, 'image/jpeg', 0.9)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative card max-w-full">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-cream">Ajusta el recorte ({aspectRatio >= 1 ? `${aspectRatio}:1` : `1:${Math.round(1 / aspectRatio * 10) / 10}`})</p>
          <button onClick={onCancel} className="p-1.5 rounded-lg text-cream-muted hover:bg-surface-700" aria-label="Cancelar">
            <X size={16} />
          </button>
        </div>

        <div
          className="relative overflow-hidden rounded-xl bg-surface-900 touch-none select-none"
          style={{ width: boxW, height: boxH, maxWidth: '100%', cursor: 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {objectUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={objectUrl}
              alt=""
              onLoad={onImgLoad}
              draggable={false}
              style={{
                position: 'absolute',
                left: offset.x,
                top: offset.y,
                width: dispW || undefined,
                height: dispH || undefined,
                maxWidth: 'none',
              }}
            />
          )}
        </div>

        <div className="flex items-center gap-3 mt-3">
          <ZoomIn size={15} className="text-cream-muted shrink-0" />
          <input
            type="range" min={1} max={3} step={0.01} value={zoom}
            onChange={e => onZoomChange(Number(e.target.value))}
            className="flex-1"
          />
        </div>
        <p className="text-xs text-cream-muted mt-2">Arrastra la imagen para reencuadrarla y usa el zoom para acercar.</p>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="btn-secondary text-sm">Cancelar</button>
          <button onClick={confirm} disabled={!natural} className="btn-primary text-sm">Usar esta imagen</button>
        </div>
      </div>
    </div>
  )
}
