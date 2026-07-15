'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { toast } from '@/lib/toast'
import { formatDateOnly } from '@/lib/format'
import DateField from '@/components/DateField'

interface Banner {
  id: string
  titulo: string
  image_path: string
  imageUrl: string
  imageUrlMobile: string | null
  link_url: string | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
}

type FormState = {
  id?: string
  titulo: string
  link_url: string
  is_active: boolean
  starts_at: string
  ends_at: string
  file: File | null
  fileMobile: File | null
}

const EMPTY_FORM: FormState = { titulo: '', link_url: '', is_active: true, starts_at: '', ends_at: '', file: null, fileMobile: null }

export default function BannerCrud({ banners }: { banners: Banner[] }) {
  const router = useRouter()
  const [panel, setPanel] = useState<'new' | string | null>(null) // 'new' o el id en edición
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function openNew() {
    setForm(EMPTY_FORM)
    setPanel('new')
  }

  function openEdit(b: Banner) {
    setForm({
      id: b.id,
      titulo: b.titulo,
      link_url: b.link_url ?? '',
      is_active: b.is_active,
      starts_at: b.starts_at ?? '',
      ends_at: b.ends_at ?? '',
      file: null,
      fileMobile: null,
    })
    setPanel(b.id)
  }

  function closePanel() {
    setPanel(null)
    setForm(EMPTY_FORM)
  }

  async function submit() {
    if (!form.titulo.trim()) {
      toast.error('El título es obligatorio')
      return
    }
    if (!form.id && !form.file) {
      toast.error('Sube una imagen para el banner nuevo')
      return
    }
    setSaving(true)
    const body = new FormData()
    if (form.id) body.set('id', form.id)
    body.set('titulo', form.titulo.trim())
    body.set('link_url', form.link_url.trim())
    body.set('is_active', String(form.is_active))
    body.set('starts_at', form.starts_at)
    body.set('ends_at', form.ends_at)
    if (form.file) body.set('image', form.file)
    if (form.fileMobile) body.set('image_mobile', form.fileMobile)

    const res = await fetch('/api/admin/banners', { method: 'POST', body })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast.error(j.error ?? 'No se pudo guardar')
      return
    }
    toast.success(form.id ? 'Banner actualizado.' : 'Banner creado.')
    closePanel()
    router.refresh()
  }

  async function toggleActivo(b: Banner) {
    const body = new FormData()
    body.set('id', b.id)
    body.set('titulo', b.titulo)
    body.set('link_url', b.link_url ?? '')
    body.set('is_active', String(!b.is_active))
    body.set('starts_at', b.starts_at ?? '')
    body.set('ends_at', b.ends_at ?? '')
    const res = await fetch('/api/admin/banners', { method: 'POST', body })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast.error(j.error ?? 'No se pudo actualizar')
      return
    }
    router.refresh()
  }

  async function remove(id: string) {
    setDeletingId(id)
    const res = await fetch('/api/admin/banners', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setDeletingId(null)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast.error(j.error ?? 'No se pudo borrar')
      return
    }
    toast.success('Banner borrado.')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-cream-muted">{banners.length} banner{banners.length !== 1 ? 's' : ''} cargado{banners.length !== 1 ? 's' : ''}</p>
        {panel === null && (
          <button onClick={openNew} className="btn-secondary">
            <Plus size={14} /> Nuevo banner
          </button>
        )}
      </div>

      {panel === 'new' && (
        <BannerForm form={form} setForm={setForm} saving={saving} onSave={submit} onCancel={closePanel} isNew />
      )}

      {banners.length === 0 && panel === null ? (
        <p className="text-sm text-cream-muted">Sin banners creados todavía.</p>
      ) : (
        <div className="space-y-3">
          {banners.map(b => (
            <div key={b.id} className="card">
              {panel === b.id ? (
                <BannerForm form={form} setForm={setForm} saving={saving} onSave={submit} onCancel={closePanel} />
              ) : (
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.imageUrl} alt={b.titulo} className="w-20 h-20 rounded-xl object-cover shrink-0 bg-surface-800" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${b.is_active ? 'text-cream' : 'text-cream-muted line-through'}`}>{b.titulo}</p>
                    <p className="text-xs text-cream-muted mt-0.5">
                      {b.starts_at ? formatDateOnly(b.starts_at) : 'Sin inicio'} — {b.ends_at ? formatDateOnly(b.ends_at) : 'Sin fin'}
                      {b.link_url && ' · con link'}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleActivo(b)}
                    className={`text-xs px-2.5 py-1 rounded-lg shrink-0 ${b.is_active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-cream-muted hover:bg-surface-700'}`}
                  >
                    {b.is_active ? 'Activo' : 'Inactivo'}
                  </button>
                  <button onClick={() => openEdit(b)} className="p-2 rounded-lg text-cream-muted hover:text-cream hover:bg-surface-800 shrink-0" aria-label="Editar">
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => remove(b.id)}
                    disabled={deletingId === b.id}
                    className="p-2 rounded-lg text-cream-muted hover:text-red-400 hover:bg-red-500/10 shrink-0"
                    aria-label="Borrar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BannerForm({
  form, setForm, saving, onSave, onCancel, isNew,
}: {
  form: FormState
  setForm: (f: FormState) => void
  saving: boolean
  onSave: () => void
  onCancel: () => void
  isNew?: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-cream">{isNew ? 'Nuevo banner' : 'Editar banner'}</p>
        <button onClick={onCancel} className="p-1.5 rounded-lg text-cream-muted hover:bg-surface-700" aria-label="Cancelar">
          <X size={16} />
        </button>
      </div>
      <div>
        <label className="label">Título (interno, no se muestra sobre la imagen)</label>
        <input type="text" className="input" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ej. Evento networking julio" />
      </div>
      <div>
        <label className="label">Imagen desktop (horizontal, ancha){isNew ? '' : ' — dejar vacío para conservar la actual'}</label>
        <input
          type="file" accept="image/*" className="input"
          onChange={e => setForm({ ...form, file: e.target.files?.[0] ?? null })}
        />
      </div>
      <div>
        <label className="label">Imagen mobile (opcional, más vertical){isNew ? '' : ' — dejar vacío para conservar la actual'}</label>
        <input
          type="file" accept="image/*" className="input"
          onChange={e => setForm({ ...form, fileMobile: e.target.files?.[0] ?? null })}
        />
        <p className="text-xs text-cream-muted mt-1">Si no la subes, en celular se usa la imagen desktop.</p>
      </div>
      <div>
        <label className="label">Link al hacer clic (opcional)</label>
        <input type="url" className="input" value={form.link_url} onChange={e => setForm({ ...form, link_url: e.target.value })} placeholder="https://..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Vigente desde (opcional)</label>
          <DateField value={form.starts_at} onChange={v => setForm({ ...form, starts_at: v })} placeholder="Sin definir" />
        </div>
        <div>
          <label className="label">Vigente hasta (opcional)</label>
          <DateField value={form.ends_at} onChange={v => setForm({ ...form, ends_at: v })} placeholder="Sin definir" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-cream-muted">
        <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
        Activo
      </label>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-secondary text-sm">Cancelar</button>
        <button onClick={onSave} disabled={saving} className="btn-primary text-sm">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
