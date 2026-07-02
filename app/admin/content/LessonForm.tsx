'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FilePlus2, CheckCircle2, Video, FileText, Trash2 } from 'lucide-react'
import { CONTENT_TIPOS } from '@/lib/sessionTypes'

type LessonType = 'video' | 'document'

interface Recording {
  id: string
  title: string
  type: LessonType
  fathom_share_id: string | null
  storage_path: string | null
  order: number
  is_published: boolean
}

export interface HiperfocoConTipos {
  id: string
  title: string
  product_id: string
  tipos: {
    tipo: string  // value: 'inmersion' | 'mentoria' | etc.
    recordings: Recording[]
  }[]
}

interface Props {
  products: { id: string; title: string }[]
  hiperfocos: HiperfocoConTipos[]
}

const EMPTY = {
  recordingId: '',
  title: '',
  type: 'video' as LessonType,
  fathom_share_id: '',
  storage_path: '', // documento existente (edición) — solo referencia, no editable a mano
  order: '',
  is_published: false,
}

function fileNameFromPath(path: string): string {
  return path.split('/').pop() ?? path
}

export default function LessonForm({ products, hiperfocos }: Props) {
  const router = useRouter()
  const [productId, setProductId] = useState('')
  const [hiperfocoId, setHiperfocoId] = useState('')
  const [tipo, setTipo] = useState('')  // value: 'inmersion', 'mentoria', etc.
  const [f, setF] = useState({ ...EMPTY })
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const filteredHiperfocos = useMemo(
    () => hiperfocos.filter(h => h.product_id === productId),
    [productId, hiperfocos]
  )

  const tipoData = useMemo(() => {
    const h = hiperfocos.find(h => h.id === hiperfocoId)
    return h?.tipos.find(t => t.tipo === tipo) ?? null
  }, [hiperfocoId, tipo, hiperfocos])

  function reset() { setF({ ...EMPTY }); setFile(null); setSuccess(''); setError(''); setConfirmDelete(false) }

  function set<K extends keyof typeof f>(key: K, value: (typeof f)[K]) {
    setF(prev => ({ ...prev, [key]: value }))
    setSuccess(''); setError('')
  }

  function pickRecording(recordingId: string) {
    setConfirmDelete(false)
    if (!recordingId) { reset(); return }
    const r = tipoData?.recordings.find(x => x.id === recordingId)
    if (!r) return
    setF({
      recordingId: r.id,
      title: r.title,
      type: r.type,
      fathom_share_id: r.fathom_share_id ?? '',
      storage_path: r.storage_path ?? '',
      order: `${r.order}`,
      is_published: r.is_published,
    })
    setSuccess(''); setError('')
  }

  function changeProduct(id: string) { setProductId(id); setHiperfocoId(''); setTipo(''); reset() }
  function changeHiperfoco(id: string) { setHiperfocoId(id); setTipo(''); reset() }
  function changeTipo(t: string) { setTipo(t); reset() }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (f.type === 'document' && !file && !f.storage_path) {
      setError('Sube un archivo para el documento'); return
    }
    setLoading(true); setError(''); setSuccess('')

    const body = new FormData()
    if (f.recordingId) body.set('id', f.recordingId)
    body.set('hiperfoco_id', hiperfocoId)
    body.set('tipo', tipo)
    body.set('title', f.title)
    body.set('type', f.type)
    body.set('fathom_share_id', f.fathom_share_id)
    body.set('existing_storage_path', f.storage_path)
    body.set('order', f.order)
    body.set('is_published', String(f.is_published))
    if (file) body.set('file', file)

    const res = await fetch('/api/admin/lessons', { method: 'POST', body })
    const data = await res.json().catch(() => ({}))
    setLoading(false)

    if (!res.ok) { setError(data.error ?? 'No se pudo guardar'); return }
    setSuccess(f.recordingId ? 'Grabación actualizada.' : 'Grabación guardada.')
    reset()
    router.refresh()
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true); setError('')
    const res = await fetch(`/api/admin/lessons?id=${f.recordingId}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    setDeleting(false)
    if (!res.ok) { setError(data.error ?? 'No se pudo eliminar'); setConfirmDelete(false); return }
    reset()
    router.refresh()
  }

  const canSubmit = !!productId && !!hiperfocoId && !!tipo && !!f.title.trim()

  return (
    <div className="card mb-8">
      <div className="flex items-center gap-2 mb-1">
        <FilePlus2 size={18} className="text-brand-400" />
        <h2 className="text-lg font-semibold text-cream">Cargar grabación</h2>
      </div>
      <p className="text-sm text-cream-muted mb-5">
        Elige producto → hiperfoco → tipo de sesión y agrega las grabaciones.
      </p>

      <form onSubmit={submit} className="space-y-4">
        {/* Producto */}
        <div>
          <label className="label">Producto *</label>
          <select className="select" value={productId} onChange={e => changeProduct(e.target.value)} required>
            <option value="">— Selecciona un producto —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>

        {/* Hiperfoco */}
        {productId && (
          <div>
            <label className="label">Hiperfoco *</label>
            <select className="select" value={hiperfocoId} onChange={e => changeHiperfoco(e.target.value)} required>
              <option value="">— Selecciona un hiperfoco —</option>
              {filteredHiperfocos.map(h => <option key={h.id} value={h.id}>{h.title}</option>)}
            </select>
          </div>
        )}

        {/* Tipo de sesión */}
        {hiperfocoId && (
          <div>
            <label className="label">Tipo de sesión *</label>
            <div className="grid grid-cols-2 gap-2">
              {CONTENT_TIPOS.map(t => (
                <button key={t.value} type="button" onClick={() => changeTipo(t.value)}
                  className={`px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                    tipo === t.value
                      ? 'border-brand-500 bg-brand-600/15 text-cream font-medium'
                      : 'border-surface-600 bg-surface-800 text-cream-dim hover:text-cream'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Grabación existente (edición) */}
        {tipo && tipoData && tipoData.recordings.length > 0 && (
          <div>
            <label className="label">Grabación</label>
            <select className="select" value={f.recordingId} onChange={e => pickRecording(e.target.value)}>
              <option value="">— Nueva grabación —</option>
              {tipoData.recordings.map(r => (
                <option key={r.id} value={r.id}>{r.title} ({r.type})</option>
              ))}
            </select>
            {f.recordingId && <p className="text-xs text-accent mt-1.5">Editando una grabación existente</p>}
          </div>
        )}

        {/* Campos de detalle */}
        {tipo && (
          <>
            <div>
              <label className="label">Título *</label>
              <input type="text" className="input" placeholder="Ej. Script de ventas — sesión 1"
                value={f.title} onChange={e => set('title', e.target.value)} required />
            </div>

            <div>
              <label className="label">Tipo de archivo *</label>
              <div className="grid grid-cols-2 gap-2">
                {([['video', 'Video', Video], ['document', 'Documento', FileText]] as [LessonType, string, any][]).map(([val, lbl, Icon]) => (
                  <button key={val} type="button" onClick={() => set('type', val)}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm transition-colors ${
                      f.type === val
                        ? 'border-brand-500 bg-brand-600/15 text-cream'
                        : 'border-surface-600 bg-surface-800 text-cream-dim hover:text-cream'
                    }`}>
                    <Icon size={15} /> {lbl}
                  </button>
                ))}
              </div>
            </div>

            {f.type === 'video' && (
              <div>
                <label className="label">fathom_share_id *</label>
                <input type="text" className="input" placeholder="ID del video en GHL (Fathom)"
                  value={f.fathom_share_id} onChange={e => set('fathom_share_id', e.target.value)} />
                <p className="text-xs text-cream-muted mt-1.5">Se valida contra el Worker; si el ID no existe, no se guarda.</p>
              </div>
            )}

            {f.type === 'document' && (
              <div>
                <label className="label">Archivo (PDF u otro documento) *</label>
                {f.storage_path && !file && (
                  <p className="text-xs text-cream-dim mb-1.5">
                    Actual: <span className="text-cream">{fileNameFromPath(f.storage_path)}</span> — elige uno nuevo para reemplazarlo.
                  </p>
                )}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                  className="input file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-brand-600/20 file:text-brand-300 file:text-sm"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-cream-muted mt-1.5">Se sube directo a la plataforma (bucket privado); el cliente lo descarga por un link temporal.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Orden</label>
                <input type="number" className="input" placeholder="Auto (al final)"
                  value={f.order} onChange={e => set('order', e.target.value)} />
              </div>
              <label className="flex items-end gap-2 pb-2.5 cursor-pointer select-none">
                <input type="checkbox" className="w-4 h-4 accent-brand-600"
                  checked={f.is_published} onChange={e => set('is_published', e.target.checked)} />
                <span className="text-sm text-cream-dim">Publicada (visible al cliente)</span>
              </label>
            </div>
          </>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <p className="text-emerald-300 text-sm">{success}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button type="submit" disabled={loading || !canSubmit}
            className="btn-primary flex-1 justify-center py-3 disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? 'Guardando…' : f.recordingId ? 'Guardar cambios' : 'Guardar grabación'}
          </button>

          {f.recordingId && (
            <button type="button" onClick={handleDelete} disabled={deleting}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                confirmDelete
                  ? 'bg-red-600 hover:bg-red-700 text-white border-red-600'
                  : 'bg-red-900/30 hover:bg-red-800/50 text-red-400 border-red-800/40'
              }`}>
              <Trash2 size={14} />
              {deleting ? 'Eliminando…' : confirmDelete ? 'Confirmar eliminar' : 'Eliminar'}
            </button>
          )}
        </div>

        {confirmDelete && (
          <p className="text-xs text-red-400 text-center -mt-1">
            Haz clic de nuevo para confirmar. Esta acción no se puede deshacer.
          </p>
        )}
      </form>
    </div>
  )
}
