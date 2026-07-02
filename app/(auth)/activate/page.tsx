'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

function ActivateForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [expired, setExpired] = useState(false)
  const supabaseRef = useRef(createClient())
  const verifyStarted = useRef(false)

  useEffect(() => {
    // Guarda contra doble ejecución del efecto (React Strict Mode en dev monta
    // dos veces a propósito; verifyOtp es de un solo uso, así que una segunda
    // llamada con el mismo token_hash fallaría y pisaría el estado a "expirado"
    // aunque la primera sí hubiera funcionado). Sin esto se ve "expirado" en dev
    // incluso cuando el token es válido.
    if (verifyStarted.current) return
    verifyStarted.current = true

    const supabase = supabaseRef.current

    // Verificamos el token NOSOTROS (verifyOtp, client-side) en vez de dejar que
    // el correo apunte directo al endpoint /auth/v1/verify de Supabase: ese
    // endpoint consume el token con un simple GET, sin JS, así que cualquier
    // escáner de enlaces del correo (Gmail/Outlook) lo quema antes de que la
    // persona haga clic de verdad. Al verificar aquí, el consumo solo ocurre si
    // se ejecuta este JS (un escáner normal no lo hace). Ver PENDIENTES.md.
    const tokenHash = searchParams.get('token_hash')
    const type = searchParams.get('type') as EmailOtpType | null

    if (!tokenHash || !type) {
      setExpired(true)
      return
    }

    // Limpiar los params de la URL (no dejar el token expuesto en la barra).
    window.history.replaceState(null, '', window.location.pathname)

    supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      .then(({ data, error: verifyError }) => {
        if (verifyError || !data.session) {
          setExpired(true)
          return
        }
        setSessionReady(true)
        const meta = data.session.user.user_metadata
        if (meta?.full_name) setName(meta.full_name)
      })
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 8) { setError('Mínimo 8 caracteres'); return }

    setLoading(true)
    setError('')

    const supabase = supabaseRef.current
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { full_name: name },
    })

    if (updateError) {
      console.error('[activate] updateUser failed:', updateError)
      setError('Error al activar la cuenta. El enlace puede haber expirado.')
      setLoading(false)
      return
    }

    // Actualizar full_name en profiles (el trigger de auth no siempre lo sincroniza).
    const { data: { user } } = await supabase.auth.getUser()
    if (user && name.trim()) {
      await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', user.id)
    }

    router.push('/dashboard')
  }

  if (expired) {
    return (
      <div className="card text-center py-8">
        <h2 className="text-xl font-semibold text-cream mb-2">Enlace inválido o expirado</h2>
        <p className="text-zinc-500 text-sm mb-4">
          Este enlace de activación ya fue usado o expiró. Contacta a tu administrador para recibir uno nuevo.
        </p>
        <a href="/login" className="btn-primary inline-flex">Ir al login</a>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-cream mb-2">Activar cuenta</h2>
      <p className="text-zinc-500 text-sm mb-6">Completa tu perfil para acceder a la plataforma</p>

      {!sessionReady ? (
        <div className="text-center py-6">
          <svg className="animate-spin h-6 w-6 mx-auto mb-3 text-brand-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <p className="text-sm text-zinc-400">Verificando tu invitación…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nombre completo</label>
            <input
              type="text"
              className="input"
              placeholder="Tu nombre"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input
              type="password"
              className="input"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Confirmar contraseña</label>
            <input
              type="password"
              className="input"
              placeholder="Repite la contraseña"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Activando...' : 'Activar cuenta'}
          </button>
        </form>
      )}
    </div>
  )
}

export default function ActivatePage() {
  return (
    <Suspense fallback={<div className="card text-zinc-400">Cargando...</div>}>
      <ActivateForm />
    </Suspense>
  )
}
