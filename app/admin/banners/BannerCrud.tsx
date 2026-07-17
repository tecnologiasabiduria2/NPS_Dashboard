'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { toast } from '@/lib/toast'
import { formatDateOnly } from '@/lib/format'
import DateField from '@/components/DateField'
import ImageCropper from '@/components/ImageCropper'

// Proporciones fijas de recorte (2026-07-16): el carrusel ya no adivina en
// tiempo real qué hacer con imágenes de proporciones raras — se normalizan
// aquí, una sola vez, al subirlas. 3:1 para desktop (banda ancha), 4:5 para
// mobile ("más vertical", como ya decía el texto de ayuda de este campo).
const DESKTOP_RATIO = 3
const MOBILE_RATIO = 4 / 5

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
  // Recorte pendiente: qué slot ('file'/'fileMobile') está esperando que el
  // admin ajuste el encuadre antes de que el archivo entre al form real.
  const [cropTarget, setCropTarget] = useState<'file' | 'fileMobile' | null>(null)
  const [cropSource, setCropSource] = useState<File | null>(null)

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

  function pickFile(kind: 'file' | 'fileMobile', file: File | null) {
    if (!file) return
    setCropSource(file)
    setCropTarget(kind)
  }

  function handleCropped(blob: Blob, fileName: string) {
    const croppedFile = new File([blob], fileName, { type: 'image/jpeg' })
    setForm({ ...form, [cropTarget as 'file' | 'fileMobile']: croppedFile })
    setCropTarget(null)
    setCropSource(null)
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

      {cropTarget && cropSource && (
        <ImageCropper
          file={cropSource}
          aspectRatio={cropTarget === 'file' ? DESKTOP_RATIO : MOBILE_RATIO}
          onCancel={() => { setCropTarget(null); setCropSource(null) }}
          onCropped={handleCropped}
        />
      )}

      {panel === 'new' && (
        <BannerForm form={form} setForm={setForm} saving={saving} onSave={submit} onCancel={closePanel} onPickFile={pickFile} isNew />
      )}

      {banners.length === 0 && panel === null ? (
        <p className="text-sm text-cream-muted">Sin banners creados todavía.</p>
      ) : (
        <div className="space-y-3">
          {banners.map(b => (
            <div key={b.id} className="card">
              {panel === b.id ? (
                <BannerForm form={form} setForm={setForm} saving={saving} onSave={submit} onCancel={closePanel} onPickFile={pickFile} />
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
  form, setForm, saving, onSave, onCancel, onPickFile, isNew,
}: {
  form: FormState
  setForm: (f: FormState) => void
  saving: boolean
  onSave: () => void
  onCancel: () => void
  onPickFile: (kind: 'file' | 'fileMobile', file: File | null) => void
  isNew?: boolean
}) {
  // Vista previa (2026-07-16, fix de fuga de memoria): antes se llamaba
  // URL.createObjectURL(form.file) directo en el JSX — cada re-render del
  // formulario (ej. al escribir el título) creaba una URL de blob nueva sin
  // liberar la anterior. Ahora se crea una sola vez por archivo y se libera
  // al cambiar.
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)
  const [fileMobilePreviewUrl, setFileMobilePreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!form.file) { setFilePreviewUrl(null); return }
    const url = URL.createObjectURL(form.file)
    setFilePreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [form.file])

  useEffect(() => {
    if (!form.fileMobile) { setFileMobilePreviewUrl(null); return }
    const url = URL.createObjectURL(form.fileMobile)
    setFileMobilePreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [form.fileMobile])

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
        <label className="label">Imagen desktop (horizontal, ancha, 3:1){isNew ? '' : ' — dejar vacío para conservar la actual'}</label>
        <input
          key={form.file ? 'has-file' : 'no-file'}
          type="file" accept="image/*" className="input"
          onChange={e => { onPickFile('file', e.target.files?.[0] ?? null); e.target.value = '' }}
        />
        {/* Vista previa YA recortada (2026-07-16): confirma el encuadre elegido
            antes de guardar, sin tener que publicar primero para verlo. */}
        {filePreviewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={filePreviewUrl} alt="" className="mt-2 w-full max-w-xs rounded-lg border border-surface-700" style={{ aspectRatio: DESKTOP_RATIO }} />
        )}
      </div>
      <div>
        <label className="label">Imagen mobile (opcional, más vertical, 4:5){isNew ? '' : ' — dejar vacío para conservar la actual'}</label>
        <input
          key={form.fileMobile ? 'has-file' : 'no-file'}
          type="file" accept="image/*" className="input"
          onChange={e => { onPickFile('fileMobile', e.target.files?.[0] ?? null); e.target.value = '' }}
        />
        {fileMobilePreviewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileMobilePreviewUrl} alt="" className="mt-2 w-32 rounded-lg border border-surface-700" style={{ aspectRatio: MOBILE_RATIO }} />
        )}
        <p className="text-xs text-cream-muted mt-1">Si no la subes, en celular se usa la imagen desktop.</p>
      </div>
      <div>
        <label className="label">Link al hacer clic (opcional)</label>
        <input type="url" className="input" value={form.link_url} onChange={e => setForm({ ...form, link_url: e.target.value })} placeholder="https://..." />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
