'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FilePlus2, CheckCircle2, Video, FileText, ListChecks } from 'lucide-react'

type LessonType = 'video' | 'document' | 'checklist_item'

interface Lesson {
  id: string
  title: string
  type: LessonType
  fathom_share_id: string | null
  storage_path: string | null
  order: number
  is_published: boolean
}

interface Props {
  modules: { id: string; label: string }[]
  lessonsByModule: Record<string, Lesson[]>
}

const EMPTY = {
  lessonId: '',
  title: '',
  type: 'video' as LessonType,
  fathom_share_id: '',
  storage_path: '',
  order: '',
  is_published: false,
}

export default function LessonForm({ modules, lessonsByModule }: Props) {
  const router = useRouter()
  const [moduleId, setModuleId] = useState('')
  const [f, setF] = useState({ ...EMPTY })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const moduleLessons = useMemo(
    () => (moduleId ? lessonsByModule[moduleId] ?? [] : []),
    [moduleId, lessonsByModule]
  )

  function set<K extends keyof typeof f>(key: K, value: (typeof f)[K]) {
    setF(prev => ({ ...prev, [key]: value }))
    setSuccess('')
    setError('')
  }

  // Al elegir una lección existente, carga sus valores (modo edición)
  function pickLesson(lessonId: string) {
    if (!lessonId) { setF({ ...EMPTY }); return }
    const l = moduleLessons.find(x => x.id === lessonId)
    if (!l) return
    setF({
      lessonId: l.id,
      title: l.title,
      type: l.type,
      fathom_share_id: l.fathom_share_id ?? '',
      storage_path: l.storage_path ?? '',
      order: `${l.order}`,
      is_published: l.is_published,
    })
    setSuccess(''); setError('')
  }

  function changeModule(id: string) {
    setModuleId(id)
    setF({ ...EMPTY })
    setSuccess(''); setError('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')

    const res = await fetch('/api/admin/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: f.lessonId || undefined,
        module_id: moduleId,
        title: f.title,
        type: f.type,
        fathom_share_id: f.fathom_share_id,
        storage_path: f.storage_path,
        order: f.order,
        is_published: f.is_published,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)

    if (!res.ok) { setError(data.error ?? 'No se pudo guardar la lección'); return }

    setSuccess(f.lessonId ? 'Lección actualizada.' : 'Lección creada.')
    setF({ ...EMPTY })
    router.refresh()
  }

  return (
    <div className="card mb-8">
      <div className="flex items-center gap-2 mb-1">
        <FilePlus2 size={18} className="text-brand-400" />
        <h2 className="text-lg font-semibold text-cream">Cargar / editar lección</h2>
      </div>
      <p className="text-sm text-cream-muted mb-5">
        El contenido se guarda desde aquí — sin tocar Supabase a mano. Los videos se
        validan contra el Worker antes de guardar.
      </p>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Módulo *</label>
          <select className="select" value={moduleId} onChange={e => changeModule(e.target.value)} required>
            <option value="">— Selecciona un módulo —</option>
            {modules.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>

        {moduleId && (
          <div>
            <label className="label">Lección</label>
            <select className="select" value={f.lessonId} onChange={e => pickLesson(e.target.value)}>
              <option value="">— Nueva lección —</option>
              {moduleLessons.map(l => (
                <option key={l.id} value={l.id}>{l.order}. {l.title} ({l.type})</option>
              ))}
            </select>
            {f.lessonId && <p className="text-xs text-accent mt-1.5">Editando una lección existente</p>}
          </div>
        )}

        <div>
          <label className="label">Título *</label>
          <input type="text" className="input" placeholder="Ej. Flujo de caja en 7 pasos"
            value={f.title} onChange={e => set('title', e.target.value)} required disabled={!moduleId} />
        </div>

        <div>
          <label className="label">Tipo *</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              ['video', 'Video', Video],
              ['document', 'Documento', FileText],
              ['checklist_item', 'Entregable', ListChecks],
            ] as [LessonType, string, any][]).map(([val, lbl, Icon]) => (
              <button key={val} type="button" disabled={!moduleId}
                onClick={() => set('type', val)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs transition-colors ${
                  f.type === val
                    ? 'border-brand-500 bg-brand-600/15 text-cream'
                    : 'border-surface-600 bg-surface-800 text-cream-dim hover:text-cream'
                }`}>
                <Icon size={16} /> {lbl}
              </button>
            ))}
          </div>
        </div>

        {f.type === 'video' && (
          <div>
            <label className="label">fathom_share_id *</label>
            <input type="text" className="input" placeholder="ID del video en GHL (Fathom)"
              value={f.fathom_share_id} onChange={e => set('fathom_share_id', e.target.value)} />
            <p className="text-xs text-cream-muted mt-1.5">Se valida contra el Worker; si no existe, no se guarda.</p>
          </div>
        )}

        {f.type === 'document' && (
          <div>
            <label className="label">storage_path</label>
            <input type="text" className="input" placeholder="Ej. module-1/plantilla-flujo-caja.pdf"
              value={f.storage_path} onChange={e => set('storage_path', e.target.value)} />
            <p className="text-xs text-cream-muted mt-1.5">Ruta dentro del bucket privado <code>content</code>.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Orden</label>
            <input type="number" className="input" placeholder="Auto (al final)"
              value={f.order} onChange={e => set('order', e.target.value)} disabled={!moduleId} />
          </div>
          <label className="flex items-end gap-2 pb-2.5 cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4 accent-brand-600"
              checked={f.is_published} onChange={e => set('is_published', e.target.checked)} disabled={!moduleId} />
            <span className="text-sm text-cream-dim">Publicada (visible al cliente)</span>
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

        <button type="submit" disabled={loading || !moduleId} className="btn-primary w-full justify-center py-3 disabled:opacity-40 disabled:cursor-not-allowed">
          {loading ? 'Guardando…' : f.lessonId ? 'Guardar cambios' : 'Crear lección'}
        </button>
      </form>
    </div>
  )
}
