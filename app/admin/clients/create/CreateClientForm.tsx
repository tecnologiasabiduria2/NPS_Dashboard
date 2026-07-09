'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, CheckCircle2 } from 'lucide-react'
import BackLink from '@/components/BackLink'
import DateField from '@/components/DateField'
import { isValidPhoneWithPrefix } from '@/lib/phone'

export default function CreateClientForm({ products }: { products: { slug: string; title: string }[] }) {
  const router = useRouter()
  const [form, setForm] = useState({
    email: '',
    full_name: '',
    phone: '',
    product_access: products[0]?.slug ?? '',
    access_until: '',
    ghl_contact_id: '',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [existingClient, setExistingClient] = useState(false)
  const [error, setError] = useState('')

  function handle(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!isValidPhoneWithPrefix(form.phone)) {
      setError('El teléfono debe incluir el indicativo, ej: +57 300 1234567')
      return
    }

    if (!form.access_until) {
      setError('Elige la fecha de acceso hasta.')
      return
    }

    setLoading(true)

    const res = await fetch('/api/admin/create-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    let data: any = {}
    try { data = await res.json() } catch { /* body no era JSON */ }

    if (!res.ok) {
      const msg = typeof data?.error === 'string' && data.error
        ? data.error
        : `Error del servidor (${res.status}). Revisa la terminal del servidor para más detalle.`
      setError(msg)
      setLoading(false)
      return
    }

    setExistingClient(Boolean(data?.existing))
    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="max-w-lg">
        <div className="card text-center py-12">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-emerald-400" />
          </div>
          <h2 className="text-xl font-semibold text-cream mb-2">{existingClient ? 'Acceso actualizado' : 'Cliente creado'}</h2>
          <p className="text-cream-muted text-sm mb-6">
            {existingClient ? (
              <>El correo <strong className="text-cream">{form.email}</strong> ya tenía cuenta. Se <strong className="text-cream">actualizó su acceso</strong> — no se envía una nueva invitación (ya puede iniciar sesión).</>
            ) : (
              <>Se envió el email de invitación a <strong className="text-cream">{form.email}</strong>. El cliente recibirá un enlace para activar su cuenta.</>
            )}
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setSuccess(false); setExistingClient(false); setForm({ email: '', full_name: '', phone: '', product_access: products[0]?.slug ?? '', access_until: '', ghl_contact_id: '' }) }}
              className="btn-secondary">
              Crear otro
            </button>
            <Link href="/admin/clients" className="btn-primary">
              Ver clientes
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <div className="mb-8">
        <BackLink />
        <h1 className="page-title flex items-center gap-2">
          <UserPlus size={22} className="text-brand-400" />
          Nuevo cliente
        </h1>
        <p className="page-subtitle">Se creará la cuenta y se enviará el email de invitación</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card space-y-5">
          <p className="section-label">Información personal</p>

          <div>
            <label className="label">Nombre completo *</label>
            <input type="text" className="input" placeholder="Juan García"
              value={form.full_name} onChange={e => handle('full_name', e.target.value)} required />
          </div>

          <div>
            <label className="label">Email *</label>
            <input type="email" className="input" placeholder="juan@empresa.com"
              value={form.email} onChange={e => handle('email', e.target.value)} required />
          </div>

          <div>
            <label className="label">Teléfono</label>
            <input type="tel" className="input" placeholder="+57 300 000 0000"
              value={form.phone} onChange={e => handle('phone', e.target.value)} />
            <p className="text-xs text-cream-muted mt-1">
              Opcional. Si lo llenas, debe llevar el indicativo del país con "+" (ej. +57 300 000 0000)
              para que el botón de WhatsApp funcione bien.
            </p>
          </div>
        </div>

        <div className="card space-y-5">
          <p className="section-label">Acceso y programa</p>

          <div>
            <label className="label">Programa *</label>
            <select className="select" value={form.product_access}
              onChange={e => handle('product_access', e.target.value)}>
              {products.map(p => (
                <option key={p.slug} value={p.slug}>{p.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Acceso hasta *</label>
            <DateField value={form.access_until} onChange={v => handle('access_until', v)} required />
          </div>

          <div>
            <label className="label">ID de contacto en GHL *</label>
            <input type="text" className="input" placeholder="ID del contacto en Go High Level"
              value={form.ghl_contact_id} onChange={e => handle('ghl_contact_id', e.target.value)} required />
            <p className="text-xs text-cream-muted mt-1.5">
              Obligatorio: vincula al cliente con su contacto en GHL para mantener la sincronización.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base">
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Creando cliente...
            </span>
          ) : (
            <><UserPlus size={16} /> Crear cliente y enviar invitación</>
          )}
        </button>
      </form>
    </div>
  )
}
