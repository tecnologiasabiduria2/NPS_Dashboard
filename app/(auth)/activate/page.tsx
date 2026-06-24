'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function ActivateForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [expired, setExpired] = useState(false)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current

    // Extraer tokens del hash fragment EXPLÍCITAMENTE. No confiar en auto-detección
    // de createBrowserClient, porque si el usuario ya tiene sesión abierta (ej. admin),
    // getSession() devuelve ESA sesión vieja antes de que el hash se procese, y
    // updateUser correría sobre el usuario equivocado.
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (!accessToken || !refreshToken) {
      setExpired(true)
      return
    }

    // Limpiar el hash de la URL (no exponer tokens en la barra de direcciones).
    window.history.replaceState(null, '', window.location.pathname)

    // Establecer la sesión del invite EXPLÍCITAMENTE, reemplazando cualquier
    // sesión preexistente (ej. admin logueado en el mismo navegador).
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ data, error: sessionError }) => {
        if (sessionError || !data.session) {
          setExpired(true)
          return
        }
        setSessionReady(true)
        const meta = data.session.user.user_metadata
        if (meta?.full_name) setName(meta.full_name)
      })
  }, [])

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
        <h2 className="text-xl font-semibold text-zinc-100 mb-2">Enlace inválido o expirado</h2>
        <p className="text-zinc-500 text-sm mb-4">
          Este enlace de activación ya fue usado o expiró. Contacta a tu administrador para recibir uno nuevo.
        </p>
        <a href="/login" className="btn-primary inline-flex">Ir al login</a>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-zinc-100 mb-2">Activar cuenta</h2>
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
