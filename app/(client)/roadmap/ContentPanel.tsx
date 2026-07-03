'use client'

import { useState } from 'react'
import { X, ChevronLeft, Video, FileText, CheckCircle2, FileDown, Loader2, Download } from 'lucide-react'
import { clsx } from 'clsx'
import VideoPlayer from '@/components/VideoPlayer'
import VideoMark from '@/components/VideoMark'
import type { ContentCard, CardRecording } from './ContentCards'

interface Props {
  card: ContentCard
  userId: string
  onClose: () => void
}

// Panel a pantalla completa (dentro del área de contenido): lista de grabaciones
// a un costado + la seleccionada al lado. Reemplaza el despliegue debajo de la
// card, que no escala bien cuando un hiperfoco tiene muchos contenidos.
// Responsive: en pantallas chicas (<lg) el sidebar pasa a ser una fila horizontal
// desplazable arriba, y el contenido ocupa el ancho completo debajo.
export default function ContentPanel({ card, userId, onClose }: Props) {
  const firstPending = card.recordings.find(r => !r.completed) ?? card.recordings[0]
  const [selectedId, setSelectedId] = useState<string | undefined>(firstPending?.id)
  const selected: CardRecording | undefined = card.recordings.find(r => r.id === selectedId)

  const documentPaths = card.recordings
    .filter(r => r.type === 'document' && r.storage_path)
    .map(r => r.storage_path as string)
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
    <div className="fixed inset-0 z-40 bg-surface-950 flex flex-col">
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
          {documentPaths.length > 0 && (
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

      {/* Cuerpo: sidebar + contenido (columna en móvil, fila desde lg) */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Sidebar: fila horizontal desplazable en móvil, lista vertical desde lg */}
        <div className="w-full lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-surface-800 overflow-x-auto lg:overflow-y-auto flex lg:flex-col gap-2 lg:gap-0 lg:space-y-1 p-3">
          {card.recordings.map(rec => (
            <button
              key={rec.id}
              type="button"
              onClick={() => setSelectedId(rec.id)}
              className={clsx(
                'shrink-0 lg:w-full flex items-center gap-2 lg:gap-3 px-3 py-2.5 rounded-lg text-left transition-colors whitespace-nowrap lg:whitespace-normal',
                rec.id === selectedId
                  ? 'bg-brand-600/20 text-cream'
                  : 'text-cream-dim hover:text-cream hover:bg-surface-800'
              )}
            >
              <span className="shrink-0">
                {rec.type === 'video' ? <Video size={14} /> : <FileText size={14} />}
              </span>
              <span className="text-sm flex-1 min-w-0 truncate max-w-[160px] lg:max-w-none">{rec.title}</span>
              {rec.completed && <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />}
            </button>
          ))}
        </div>

        {/* Contenido seleccionado */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          {selected && (
            <div className="max-w-3xl mx-auto">
              <h3 className="text-xl font-semibold text-cream mb-4">{selected.title}</h3>

              {selected.type === 'video' && selected.fathom_share_id && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-cream-dim">Video</p>
                    <VideoMark
                      key={selected.id}
                      recordingId={selected.id}
                      userId={userId}
                      initialCompleted={selected.completed}
                    />
                  </div>
                  <VideoPlayer shareId={selected.fathom_share_id} />
                </div>
              )}

              {selected.type === 'document' && selected.storage_path && (
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-medium text-cream-dim">📎 Material</p>
                    <VideoMark
                      key={selected.id}
                      recordingId={selected.id}
                      userId={userId}
                      initialCompleted={selected.completed}
                    />
                  </div>
                  <a
                    href={`/api/download?path=${encodeURIComponent(selected.storage_path)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors group"
                  >
                    <FileDown size={16} className="text-cream-muted group-hover:text-brand-400 transition-colors" />
                    <span className="text-sm text-cream-dim group-hover:text-cream">{selected.title}</span>
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
