'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Pencil } from 'lucide-react'
import { isValidPhoneWithPrefix } from '@/lib/phone'

interface Props {
  email: string
  fullName: string
  phone: string
  bio: string
  instagram: string
  website: string
  avatarUrl: string | null
}

// /profile era de solo lectura (2026-07-09: "no hay algo como para editar la
// info... no puedo asignar foto de perfil tampoco"). Reusa el mismo endpoint
// del onboarding (/api/profile/onboarding, ya soportaba bio/redes/foto — solo
// le faltaba full_name) en vez de crear uno nuevo.
export default function ProfileForm({ email, fullName, phone, bio, instagram, website, avatarUrl }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(fullName)
  const [ph, setPh] = useState(phone)
  const [b, setB] = useState(bio)
  const [ig, setIg] = useState(instagram)
  const [web, setWeb] = useState(website)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const initials = (fullName || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const shownAvatar = preview ?? avatarUrl

  function pick(f: File | null) {
    setFile(f)
    setPreview(f ? URL.createObjectURL(f) : null)
  }

  function cancel() {
    setName(fullName); setPh(phone); setB(bio); setIg(instagram); setWeb(website)
    setFile(null); setPreview(null); setError('')
    setEditing(false)
  }

  async function save() {
    if (!name.trim()) { setError('El nombre no puede quedar vacío'); return }
    if (!isValidPhoneWithPrefix(ph)) { setError('El teléfono debe incluir el indicativo, ej: +57 300 1234567'); return }
    setSaving(true); setError('')
    const fd = new FormData()
    fd.set('full_name', name.trim())
    fd.set('bio', b)
    fd.set('instagram', ig)
    fd.set('website', web)
    fd.set('phone', ph)
    if (file) fd.set('avatar', file)
    const res = await fetch('/api/profile/onboarding', { method: 'POST', body: fd })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'No se pudo guardar')
      return
    }
    setFile(null); setPreview(null)
    setEditing(false)
    router.refresh()
  }

  if (!editing) {
    return (
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="section-label !mb-0">Información personal</p>
          <button onClick={() => setEditing(true)} className="btn-ghost text-xs py-1.5 px-2.5 inline-flex items-center gap-1.5">
            <Pencil size={12} /> Editar
          </button>
        </div>
        <div className="flex items-center gap-4 mb-4">
          <span className="w-16 h-16 rounded-full overflow-hidden bg-surface-800 border border-surface-600 flex items-center justify-center shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-base font-semibold text-brand-300">{initials}</span>
            )}
          </span>
          <div className="min-w-0">
            <p className="text-cream font-medium truncate">{fullName || '—'}</p>
            {bio && <p className="text-xs text-cream-muted mt-0.5 line-clamp-2">{bio}</p>}
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-cream-muted">Email</p>
            <p className="text-cream">{email}</p>
          </div>
          <div>
            <p className="text-xs text-cream-muted">Teléfono</p>
            <p className="text-cream">{phone || '—'}</p>
          </div>
          {(instagram || website) && (
            <div className="flex gap-6">
              {instagram && (
                <div>
                  <p className="text-xs text-cream-muted">Instagram</p>
                  <p className="text-cream">{instagram}</p>
                </div>
              )}
              {website && (
                <div>
                  <p className="text-xs text-cream-muted">Página web</p>
                  <p className="text-cream">{website}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="card mb-4">
      <p className="section-label mb-4">Editar información personal</p>

      <div className="flex items-center gap-4 mb-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="relative w-16 h-16 rounded-full overflow-hidden bg-surface-800 border border-surface-600 flex items-center justify-center shrink-0 hover:border-accent transition-colors"
        >
          {shownAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shownAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-base font-semibold text-brand-300">{initials}</span>
          )}
          <span className="absolute bottom-0 inset-x-0 bg-black/50 py-0.5 flex justify-center">
            <Camera size={12} className="text-cream" />
          </span>
        </button>
        <div className="text-sm text-cream-muted">
          <p className="text-cream">Foto de perfil</p>
          <p className="text-xs">JPG/PNG, máx 5MB</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => pick(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs text-cream-muted mb-1">Email</p>
          <p className="text-cream text-sm">{email}</p>
        </div>
        <div>
          <label className="label">Nombre</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Teléfono</label>
          <input
            className="input"
            value={ph}
            onChange={e => setPh(e.target.value)}
            placeholder="+57 300 1234567"
          />
        </div>
        <div>
          <label className="label">Presentación</label>
          <textarea className="input resize-none" rows={3} value={b} onChange={e => setB(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Instagram</label>
            <input className="input" value={ig} onChange={e => setIg(e.target.value)} />
          </div>
          <div>
            <label className="label">Página web</label>
            <input className="input" value={web} onChange={e => setWeb(e.target.value)} />
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-400 mt-3">{error}</p>}

      <div className="flex items-center justify-end gap-3 mt-5">
        <button onClick={cancel} className="btn-ghost" disabled={saving}>Cancelar</button>
        <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-40">
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}
