'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Layers, CheckCircle2 } from 'lucide-react'

interface Module {
  id: string
  title: string
  order: number
  hiperfoco_id: string | null
  is_published: boolean
  product_id: string
}

interface Props {
  products: { id: string; title: string }[]
  hiperfocos: { id: string; title: string; product_id: string }[]
  modules: Module[]
}

export default function ModuleForm({ products, hiperfocos, modules }: Props) {
  const router = useRouter()
  const [moduleId, setModuleId] = useState('')
  const [productId, setProductId] = useState('')
  const [title, setTitle] = useState('')
  const [hiperfocoId, setHiperfocoId] = useState('')
  const [order, setOrder] = useState('')
  const [isPublished, setIsPublished] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isEditing = !!moduleId

  function pickModule(id: string) {
    setSuccess('')
    setError('')
    if (!id) {
      setModuleId('')
      setTitle('')
      setHiperfocoId('')
      setOrder('')
      setIsPublished(false)
      return
    }
    const m = modules.find(x => x.id === id)
    if (!m) return
    setModuleId(m.id)
    setProductId(m.product_id)
    setTitle(m.title)
    setHiperfocoId(m.hiperfoco_id ?? '')
    setOrder(`${m.order}`)
    setIsPublished(m.is_published)
  }

  function changeProduct(id: string) {
    setProductId(id)
    setModuleId('')
    setTitle('')
    setHiperfocoId('')
    setOrder('')
    setIsPublished(false)
    setSuccess('')
    setError('')
  }

  const filteredModules = modules.filter(m => m.product_id === productId)
  const filteredHiperfocos = hiperfocos.filter(h => h.product_id === productId)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const res = await fetch('/api/admin/modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: moduleId || undefined,
        product_id: productId,
        title,
        hiperfoco_id: hiperfocoId || null,
        order: order || undefined,
        is_published: isPublished,
      }),
    })

    let data: any = {}
    try { data = await res.json() } catch {}
    setLoading(false)

    if (!res.ok) {
      const msg = typeof data?.error === 'string' && data.error
        ? data.error
        : `Error del servidor (${res.status}).`
      setError(msg)
      return
    }

    setSuccess(isEditing ? 'Módulo actualizado.' : 'Módulo creado.')
    if (!isEditing) {
      setTitle('')
      setHiperfocoId('')
      setOrder('')
      setIsPublished(false)
    }
    router.refresh()
  }

  return (
    <div className="card mb-8">
      <div className="flex items-center gap-2 mb-1">
        <Layers size={18} className="text-brand-400" />
        <h2 className="text-lg font-semibold text-cream">Crear / editar módulo</h2>
      </div>
      <p className="text-sm text-cream-muted mb-5">
        Los módulos agrupan las lecciones. Cada módulo puede asociarse a un hiperfoco.
      </p>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Producto *</label>
          <select className="select" value={productId} onChange={e => changeProduct(e.target.value)} required>
            <option value="">— Selecciona un producto —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>

        {productId && (
          <div>
            <label className="label">Módulo</label>
            <select className="select" value={moduleId} onChange={e => pickModule(e.target.value)}>
              <option value="">— Nuevo módulo —</option>
              {filteredModules.map(m => (
                <option key={m.id} value={m.id}>{m.order}. {m.title}</option>
              ))}
            </select>
            {isEditing && <p className="text-xs text-accent mt-1.5">Editando un módulo existente</p>}
          </div>
        )}

        <div>
          <label className="label">Título *</label>
          <input type="text" className="input" placeholder="Ej. Fundamentos del Flujo de Caja"
            value={title} onChange={e => { setTitle(e.target.value); setSuccess(''); setError('') }}
            required disabled={!productId} />
        </div>

        <div>
          <label className="label">Hiperfoco asociado</label>
          <select className="select" value={hiperfocoId} onChange={e => { setHiperfocoId(e.target.value); setSuccess(''); setError('') }}
            disabled={!productId}>
            <option value="">— Ninguno —</option>
            {filteredHiperfocos.map(h => (
              <option key={h.id} value={h.id}>{h.title}</option>
            ))}
          </select>
          <p className="text-xs text-cream-muted mt-1.5">Opcional. Asocia este módulo a un hiperfoco del producto.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Orden</label>
            <input type="number" className="input" placeholder="Auto (al final)"
              value={order} onChange={e => { setOrder(e.target.value); setSuccess(''); setError('') }}
              disabled={!productId} />
          </div>
          <label className="flex items-end gap-2 pb-2.5 cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4 accent-brand-600"
              checked={isPublished} onChange={e => { setIsPublished(e.target.checked); setSuccess(''); setError('') }}
              disabled={!productId} />
            <span className="text-sm text-cream-dim">Publicado (visible al cliente)</span>
          </label>
        </div>

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

        <button type="submit" disabled={loading || !productId || !title.trim()} className="btn-primary w-full justify-center py-3 disabled:opacity-40 disabled:cursor-not-allowed">
          {loading ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear módulo'}
        </button>
      </form>
    </div>
  )
}
