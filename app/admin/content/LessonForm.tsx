'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FilePlus2, Video, FileText, Trash2 } from 'lucide-react'
import { CONTENT_TIPOS } from '@/lib/sessionTypes'
import { toast } from '@/lib/toast'

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
  transversal: { tipo: string; recordings: Recording[] }[]
}

// Sentinels para las 2 opciones "transversales" dentro del mismo desplegable
// de hiperfoco — no son hiperfocos reales, comparten los 3 productos (Sala de
// Gerencia/Entrenamiento Comercial), así que no deberían depender de elegir
// un Producto primero (pedido de Juan, 2026-07-09: "dentro del desplegable de
// los hiperfocos podría ser una opción que salgan esos 2").
const TRANSVERSAL_OPTIONS = [
  { value: 'sala_gerencia', label: 'Sala de Gerencia (todos los productos)' },
  { value: 'entrenamiento_comercial', label: 'Entrenamiento Comercial (todos los productos)' },
] as const
const TRANSVERSAL_VALUES: string[] = TRANSVERSAL_OPTIONS.map(o => o.value)

const EMPTY = {
  recordingId: '',
  title: '',
  type: 'video' as LessonType,
  fathom_share_id: '',
  storage_path: '', // documento: link de Google Drive
  order: '',
  is_published: false,
}

export default function LessonForm({ products, hiperfocos, transversal }: Props) {
  const router = useRouter()
  const [productId, setProductId] = useState('')
  const [hiperfocoId, setHiperfocoId] = useState('')
  const [tipo, setTipo] = useState('')  // value: 'inmersion', 'mentoria', etc.
  const [f, setF] = useState({ ...EMPTY })
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  const isTransversal = TRANSVERSAL_VALUES.includes(hiperfocoId)

  const filteredHiperfocos = useMemo(
    () => hiperfocos.filter(h => h.product_id === productId),
    [productId, hiperfocos]
  )

  const tipoData = useMemo(() => {
    if (isTransversal) return transversal.find(t => t.tipo === hiperfocoId) ?? null
    const h = hiperfocos.find(h => h.id === hiperfocoId)
    return h?.tipos.find(t => t.tipo === tipo) ?? null
  }, [hiperfocoId, tipo, hiperfocos, isTransversal, transversal])

  function reset() { setF({ ...EMPTY }); setError(''); setConfirmDelete(false) }

  function set<K extends keyof typeof f>(key: K, value: (typeof f)[K]) {
    setF(prev => ({ ...prev, [key]: value }))
    setError('')
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
    setError('')
  }

  function changeProduct(id: string) { setProductId(id); setHiperfocoId(''); setTipo(''); reset() }
  function changeHiperfoco(id: string) {
    setHiperfocoId(id)
    // Las 2 opciones transversales ya traen su tipo implícito (Sala de Gerencia
    // = tipo 'sala_gerencia') — no hace falta el paso extra de elegir tipo.
    setTipo(TRANSVERSAL_VALUES.includes(id) ? id : '')
    reset()
  }
  function changeTipo(t: string) { setTipo(t); reset() }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (f.type === 'document' && !f.storage_path.trim()) {
      setError('Pega el link de Drive del documento'); return
    }
    setLoading(true); setError('')

    // La FK recordings.hiperfoco_id sigue exigiendo un hiperfoco real — para
    // las 2 opciones transversales no importa cuál (ya no restringe
    // visibilidad, corregido 2026-07-09), así que se resuelve a cualquiera
    // existente (el primero de la lista completa) en vez de pedirle al admin
    // que elija uno sin sentido.
    const realHiperfocoId = isTransversal ? (hiperfocos[0]?.id ?? '') : hiperfocoId

    const res = await fetch('/api/admin/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: f.recordingId || undefined,
        hiperfoco_id: realHiperfocoId,
        tipo,
        title: f.title,
        type: f.type,
        fathom_share_id: f.fathom_share_id,
        drive_url: f.storage_path,
        order: f.order,
        is_published: f.is_published,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)

    if (!res.ok) { setError(data.error ?? 'No se pudo guardar'); toast.error(data.error ?? 'No se pudo guardar la grabación'); return }
    toast.success(f.recordingId ? 'Grabación actualizada.' : 'Grabación guardada.')
    reset()
    router.refresh()
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true); setError('')
    const res = await fetch(`/api/admin/lessons?id=${f.recordingId}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    setDeleting(false)
    if (!res.ok) { setError(data.error ?? 'No se pudo eliminar'); setConfirmDelete(false); toast.error(data.error ?? 'No se pudo eliminar la grabación'); return }
    toast.success('Grabación eliminada.')
    reset()
    router.refresh()
  }

  // Producto solo hace falta para un hiperfoco real — las 2 opciones
  // transversales no dependen de ningún producto en particular.
  const canSubmit = (isTransversal || !!productId) && !!hiperfocoId && !!tipo && !!f.title.trim()

  return (
    <div className="card mb-8">
      <div className="flex items-center gap-2 mb-1">
        <FilePlus2 size={18} className="text-brand-400" />
        <h2 className="text-lg font-semibold text-cream">Cargar grabación</h2>
      </div>
      <p className="text-sm text-cream-muted mb-5">
        Elige producto → hiperfoco → tipo de sesión y agrega las grabaciones — o directamente
        Sala de Gerencia/Entrenamiento Comercial en el desplegable de hiperfoco (son de los 3
        productos, no hace falta elegir uno).
      </p>

      <form onSubmit={submit} className="space-y-4">
        {/* Producto */}
        <div>
          <label className="label">Producto {!isTransversal && '*'}</label>
          <select className="select" value={productId} onChange={e => changeProduct(e.target.value)} required={!isTransversal}>
            <option value="">— Selecciona un producto —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>

        {/* Hiperfoco — siempre visible: las 2 opciones transversales no
            dependen de elegir producto primero, los hiperfocos reales sí. */}
        <div>
          <label className="label">Hiperfoco *</label>
          <select className="select" value={hiperfocoId} onChange={e => changeHiperfoco(e.target.value)} required>
            <option value="">— Selecciona —</option>
            <optgroup label="Transversal (todos los productos)">
              {TRANSVERSAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </optgroup>
            {productId && (
              <optgroup label="Hiperfocos">
                {filteredHiperfocos.map(h => <option key={h.id} value={h.id}>{h.title}</option>)}
              </optgroup>
            )}
          </select>
        </div>

        {/* Tipo de sesión — no aplica a las 2 opciones transversales (su tipo
            ya queda implícito al elegirlas arriba); tampoco se ofrecen acá
            Sala de Gerencia/Entrenamiento Comercial para no duplicar la vía
            de crearlas (ahora es solo desde el desplegable de hiperfoco). */}
        {hiperfocoId && !isTransversal && (
          <div>
            <label className="label">Tipo de sesión *</label>
            <div className="grid grid-cols-2 gap-2">
              {CONTENT_TIPOS.filter(t => !TRANSVERSAL_VALUES.includes(t.value)).map(t => (
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
                <label className="label">Link de Google Drive *</label>
                <input
                  type="url"
                  className="input"
                  placeholder="https://drive.google.com/file/d/..."
                  value={f.storage_path}
                  onChange={e => set('storage_path', e.target.value)}
                />
                <p className="text-xs text-cream-muted mt-1.5">Pega el link para compartir del archivo en Drive (con permiso de acceso general habilitado).</p>
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
