'use client'

import { useState } from 'react'
import { X, ChevronLeft, FileText, CheckCircle2, FileDown, Loader2, Download } from 'lucide-react'
import VideoPlayer from '@/components/VideoPlayer'
import VideoMark from '@/components/VideoMark'
import type { ContentCard, CardRecording } from './ContentCards'

interface Props {
  card: ContentCard
  userId: string
  onClose: () => void
}

// Panel a pantalla completa: una sola columna, siempre (pedido explícito de
// Diana, reunión 2026-07-03 — rechazó el selector horizontal/lateral porque
// "esta gente no es tecnológica" y "no se mueva hacia los lados"). Orden fijo:
// video arriba → material de apoyo (documentos) justo debajo → si hay más de
// un video, un desplegable para cambiar de contenido, hacia abajo, no al costado.
export default function ContentPanel({ card, userId, onClose }: Props) {
  const videos = card.recordings.filter(r => r.type === 'video')
  const documents = card.recordings.filter(r => r.type === 'document')

  const firstPendingVideo = videos.find(r => !r.completed) ?? videos[0]
  const [selectedVideoId, setSelectedVideoId] = useState<string | undefined>(firstPendingVideo?.id)
  const selectedVideo: CardRecording | undefined = videos.find(r => r.id === selectedVideoId)

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

      {/* Cuerpo: una sola columna vertical, siempre */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-3xl mx-auto">

          {/* Video (el seleccionado, o el primero pendiente) */}
          {selectedVideo?.fathom_share_id && (
            <div className="mb-6">
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

          {/* Material de apoyo — siempre debajo del video, nunca en una pestaña aparte */}
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

          {/* Si no hay ningún video (solo documentos), avisar en vez de dejar vacío */}
          {videos.length === 0 && documents.length === 0 && (
            <p className="text-sm text-cream-muted">Sin contenido disponible.</p>
          )}

          {/* Otro contenido — desplegable hacia abajo, solo si hay más de un video */}
          {videos.length > 1 && (
            <div>
              <label className="label">Otro contenido de {card.title}</label>
              <select
                className="select"
                value={selectedVideoId}
                onChange={e => setSelectedVideoId(e.target.value)}
              >
                {videos.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.title}{v.completed ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
