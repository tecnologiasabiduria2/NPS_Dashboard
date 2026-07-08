'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, X } from 'lucide-react'
import { isValidPhoneWithPrefix } from '@/lib/phone'

// Overlay de bienvenida (Bloque 5e): al unirse, el miembro se presenta (bio) y
// sube foto de perfil. Se muestra mientras el cliente no tenga bio. "Ahora no"
// lo oculta en la sesión de navegador actual.
export default function OnboardingOverlay({ userName }: { userName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const [bio, setBio] = useState('')
  const [instagram, setInstagram] = useState('')
  const [website, setWebsite] = useState('')
  const [phone, setPhone] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('onboarding-dismissed')) setOpen(false)
  }, [])

  if (!open) return null

  function pick(f: File | null) {
    setFile(f)
    setPreview(f ? URL.createObjectURL(f) : null)
    setError(null)
  }

  function dismiss() {
    try { sessionStorage.setItem('onboarding-dismissed', '1') } catch {}
    setOpen(false)
  }

  async function submit() {
    if (!bio.trim() && !file) { setError('Escribe una presentación o sube una foto'); return }
    if (!isValidPhoneWithPrefix(phone)) { setError('El teléfono debe incluir el indicativo, ej: +57 300 1234567'); return }
    setSubmitting(true); setError(null)
    const fd = new FormData()
    fd.set('bio', bio)
    fd.set('instagram', instagram)
    fd.set('website', website)
    fd.set('phone', phone)
    if (file) fd.set('avatar', file)
    const res = await fetch('/api/profile/onboarding', { method: 'POST', body: fd })
    setSubmitting(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'No se pudo guardar')
      return
    }
    setOpen(false)
    router.refresh()
  }

  const initials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={dismiss} />
      <div className="relative w-full max-w-md card">
        <button onClick={dismiss} className="absolute top-4 right-4 text-cream-muted hover:text-cream" aria-label="Cerrar">
          <X size={18} />
        </button>

        <p className="text-xs uppercase tracking-widest text-accent font-medium mb-1">Te damos la bienvenida</p>
        <h2 className="text-xl font-semibold text-cream mb-1">Preséntate a la comunidad</h2>
        <p className="text-sm text-cream-muted mb-5">Sube tu foto y cuéntanos quién eres. Aparecerás en Miembros.</p>

        {/* Foto */}
        <div className="flex items-center gap-4 mb-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="relative w-20 h-20 rounded-full overflow-hidden bg-surface-800 border border-surface-600 flex items-center justify-center shrink-0 hover:border-accent transition-colors"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg font-semibold text-brand-300">{initials}</span>
            )}
            <span className="absolute bottom-0 inset-x-0 bg-black/50 py-0.5 flex justify-center">
              <Camera size={13} className="text-cream" />
            </span>
          </button>
          <div className="text-sm text-cream-muted">
            <p className="text-cream">Foto de perfil</p>
            <p className="text-xs">JPG/PNG, máx 5MB (opcional)</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => pick(e.target.files?.[0] ?? null)}
          />
        </div>

        <textarea
          value={bio}
          onChange={e => setBio(e.target.value)}
          placeholder="Ej: Soy [nombre], CEO de [empresa]. Me dedico a... y busco..."
          rows={4}
          className="input resize-none"
        />

        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="Teléfono (opcional) — si lo llenas, con indicativo: +57 300 1234567"
          className="input mt-3"
        />

        <div className="grid grid-cols-2 gap-3 mt-3">
          <input
            value={instagram}
            onChange={e => setInstagram(e.target.value)}
            placeholder="Instagram (opcional)"
            className="input"
          />
          <input
            value={website}
            onChange={e => setWebsite(e.target.value)}
            placeholder="Página web (opcional)"
            className="input"
          />
        </div>

        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}

        <div className="flex items-center justify-end gap-3 mt-5">
          <button onClick={dismiss} className="btn-ghost" disabled={submitting}>Ahora no</button>
          <button onClick={submit} disabled={submitting} className="btn-primary disabled:opacity-40">
            {submitting ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
