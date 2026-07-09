'use client'

import { useMemo, useState } from 'react'
import { X, ChevronLeft, ChevronRight, FileText, CheckCircle2, FileDown, Loader2, Download } from 'lucide-react'
import { clsx } from 'clsx'
import VideoPlayer from '@/components/VideoPlayer'
import VideoMark from '@/components/VideoMark'
import { contentTipoLabel, CONTENT_TIPOS } from '@/lib/sessionTypes'
import type { ContentCard, CardRecording } from './ContentCards'

interface Props {
  card: ContentCard
  userId: string
  onClose: () => void
}

// Panel a pantalla completa. Layout responsive (2026-07-09, segunda pasada):
// la regla de Diana de "una sola columna" (reunión 2026-07-03) era por
// responsive (que no se rompiera en celular), no una prohibición de layout en
// 2 columnas en desktop — confirmado con Juan. Desde lg: video a la
// izquierda, lista de contenidos a la derecha; por debajo de lg: todo se
// apila (video → flechas → material → lista), igual que antes.
export default function ContentPanel({ card, userId, onClose }: Props) {
  const documents = card.recordings.filter(r => r.type === 'document')

  // Orden real: por tipo (Inmersión antes que Mentoría, mismo orden de
  // CONTENT_TIPOS) y luego por el orden ya traído de la base — sin esto,
  // grabaciones de tipos distintos con el mismo `order` (se reinicia por
  // hiperfoco+tipo) podían intercalarse al traerlas juntas, y "siguiente"
  // no avanzaba de forma predecible (hallazgo 2026-07-09).
  const videos = useMemo(() => {
    const tipoIndex = new Map<string, number>(CONTENT_TIPOS.map((t, i) => [t.value, i]))
    return card.recordings
      .filter(r => r.type === 'video')
      .slice()
      .sort((a, b) => (tipoIndex.get(a.tipo) ?? 99) - (tipoIndex.get(b.tipo) ?? 99))
  }, [card.recordings])

  const firstPendingVideo = videos.find(r => !r.completed) ?? videos[0]
  const [selectedVideoId, setSelectedVideoId] = useState<string | undefined>(firstPendingVideo?.id)
  const selectedIndex = videos.findIndex(r => r.id === selectedVideoId)
  const selectedVideo: CardRecording | undefined = videos[selectedIndex]

  const videoGroups = useMemo(() => {
    const map = new Map<string, CardRecording[]>()
    for (const v of videos) {
      if (!map.has(v.tipo)) map.set(v.tipo, [])
      map.get(v.tipo)!.push(v)
    }
    return [...map.entries()]
  }, [videos])

  // Documentos nuevos son links de Drive (storage_path = URL completa); solo
  // los legados (subidos al bucket antes del cambio, calibración 2026-07-06)
  // pasan por /api/download y entran al zip.
  const isDriveLink = (path: string) => /^https?:\/\//.test(path)
  const documentPaths = documents.map(r => r.storage_path as string).filter(p => p && !isDriveLink(p))
  const [zipping, setZipping] = useState(false)

  async function downloadAll() {
    setZipping(true)
    try {
      const res = await fetch('/api/download/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: documentPaths }),
      })
      if (!res.ok) throw new Error('No se pudo generar el zip')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${card.title || 'materiales'}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silencioso: si falla, el usuario igual puede descargar cada archivo por separado
    }
    setZipping(false)
  }

  return (
    <div className="fixed inset-0 z-40 bg-surface-950 flex flex-col animate-panel-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-8 py-4 border-b border-surface-800 shrink-0">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-sm text-cream-muted hover:text-cream transition-colors mb-1.5"
          >
            <ChevronLeft size={15} />
            Volver a Aprendizaje
          </button>
          <p className="text-xs text-cream-muted uppercase tracking-wider">{card.badge ?? 'Aprendizaje'}</p>
          <h2 className="text-lg font-semibold text-cream truncate">{card.title}</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {documentPaths.length > 1 && (
            <button
              type="button"
              onClick={downloadAll}
              disabled={zipping}
              className="btn-secondary flex items-center gap-2 py-1.5 px-3 text-xs disabled:opacity-50"
            >
              {zipping ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              <span className="hidden sm:inline">Descargar materiales</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-800 text-cream-muted hover:text-cream transition-colors"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Cuerpo: 2 columnas desde lg:, apilado antes de eso */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="lg:flex lg:gap-8">
          {/* Columna principal: video + flechas + material de apoyo — centrada
              dentro de SU propio espacio (no de toda la pantalla), para que la
              lista de la derecha quede pegada al borde real del panel en vez
              de que todo el bloque quede centrado dejando aire a los lados
              (hallazgo de Juan, 2026-07-09). */}
          <div className="lg:flex-1 max-w-3xl mx-auto min-w-0">

            {selectedVideo?.fathom_share_id && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-cream truncate pr-3">{selectedVideo.title}</h3>
                  <VideoMark
                    key={selectedVideo.id}
                    recordingId={selectedVideo.id}
                    userId={userId}
                    initialCompleted={selectedVideo.completed}
                  />
                </div>
                <VideoPlayer shareId={selectedVideo.fathom_share_id} />
              </div>
            )}

            {/* Sesión anterior / siguiente — mismo lenguaje visual que
                recording/[id]/page.tsx, pero cambia el video seleccionado en
                vez de navegar a otra URL (acá todo vive en un solo panel). */}
            {videos.length > 1 && (
              <div className="flex items-center justify-between gap-3 mb-6">
                {selectedIndex > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSelectedVideoId(videos[selectedIndex - 1].id)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-surface-800 hover:bg-surface-700 rounded-lg text-sm text-cream-dim hover:text-cream transition-colors min-w-0 flex-1"
                  >
                    <ChevronLeft size={16} className="shrink-0 text-cream-muted" />
                    <span className="truncate">{videos[selectedIndex - 1].title}</span>
                  </button>
                ) : <div className="flex-1" />}
                {selectedIndex >= 0 && selectedIndex < videos.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setSelectedVideoId(videos[selectedIndex + 1].id)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-surface-800 hover:bg-surface-700 rounded-lg text-sm text-cream-dim hover:text-cream transition-colors min-w-0 flex-1 justify-end"
                  >
                    <span className="truncate">{videos[selectedIndex + 1].title}</span>
                    <ChevronRight size={16} className="shrink-0 text-cream-muted" />
                  </button>
                ) : <div className="flex-1" />}
              </div>
            )}

            {/* Material de apoyo — siempre en la columna principal, nunca en la lista lateral */}
            {documents.length > 0 && (
              <div className="card mb-6">
                <p className="text-sm font-medium text-cream-dim mb-3">📎 Material de apoyo</p>
                <div className="space-y-2">
                  {documents.map(doc => (
                    <div key={doc.id} className="flex items-center gap-2">
                      <a
                        href={
                          doc.storage_path && isDriveLink(doc.storage_path)
                            ? doc.storage_path
                            : `/api/download?path=${encodeURIComponent(doc.storage_path ?? '')}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors group"
                      >
                        <FileDown size={16} className="text-cream-muted group-hover:text-brand-400 transition-colors shrink-0" />
                        <span className="text-sm text-cream-dim group-hover:text-cream truncate">{doc.title}</span>
                      </a>
                      {doc.completed && <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {videos.length === 0 && documents.length === 0 && (
              <p className="text-sm text-cream-muted">Sin contenido disponible.</p>
            )}
          </div>

          {/* Lista de contenidos — agrupada por tipo, clickeable. A la derecha
              desde lg:, debajo del resto en pantallas angostas. Reemplaza el
              <select> nativo (incómodo con 10+ opciones sin agrupar). */}
          {videos.length > 1 && (
            <div className="lg:w-80 shrink-0 mt-8 lg:mt-0 max-w-3xl mx-auto lg:max-w-none lg:mx-0">
              <div className="lg:sticky lg:top-0 space-y-5">
                {videoGroups.map(([tipo, items]) => (
                  <div key={tipo}>
                    <p className="section-label !mb-2">{contentTipoLabel(tipo)}</p>
                    <div className="space-y-1">
                      {items.map(v => {
                        const active = v.id === selectedVideoId
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setSelectedVideoId(v.id)}
                            className={clsx(
                              'w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-sm transition-colors',
                              active ? 'bg-brand-600/15 text-brand-300' : 'text-cream-dim hover:bg-surface-800 hover:text-cream'
                            )}
                          >
                            {v.completed
                              ? <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                              : <FileText size={15} className="text-cream-muted shrink-0" />}
                            <span className="truncate">{v.title}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
