'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [expired, setExpired] = useState(false)
  const supabaseRef = useRef(createClient())
  const verifyStarted = useRef(false)

  useEffect(() => {
    // Guarda contra doble ejecución del efecto (React Strict Mode en dev, u
    // otro re-render). verifyOtp es de un solo uso — una segunda llamada con el
    // mismo token fallaría y pisaría el estado a "expirado" sin motivo real.
    if (verifyStarted.current) return
    verifyStarted.current = true

    const supabase = supabaseRef.current

    // Mismo fix que /activate: verificamos el token_hash nosotros (client-side)
    // en vez de que el correo apunte al endpoint de Supabase que lo consume con
    // un simple GET (vulnerable a escáneres de enlaces del correo).
    const tokenHash = searchParams.get('token_hash')
    const type = searchParams.get('type') as EmailOtpType | null

    if (!tokenHash || !type) {
      setExpired(true)
      return
    }

    window.history.replaceState(null, '', window.location.pathname)

    supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      .then(({ data, error: verifyError }) => {
        if (verifyError || !data.session) {
          setExpired(true)
          return
        }
        setSessionReady(true)
      })
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 8) { setError('Mínimo 8 caracteres'); return }

    setLoading(true)
    setError('')

    const supabase = supabaseRef.current
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError('El enlace expiró. Solicita uno nuevo.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  if (expired) {
    return (
      <div className="card text-center py-8">
        <h2 className="text-xl font-semibold text-cream mb-2">Enlace inválido o expirado</h2>
        <p className="text-zinc-500 text-sm mb-4">
          Este enlace ya fue usado o expiró. Solicita uno nuevo.
        </p>
        <a href="/forgot-password" className="btn-primary inline-flex">Solicitar enlace nuevo</a>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-cream mb-6">Nueva contraseña</h2>
      {!sessionReady ? (
        <div className="text-center py-6">
          <svg className="animate-spin h-6 w-6 mx-auto mb-3 text-brand-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <p className="text-sm text-zinc-400">Verificando el enlace…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nueva contraseña</label>
            <input type="password" className="input" placeholder="Mínimo 8 caracteres"
              value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <div>
            <label className="label">Confirmar contraseña</label>
            <input type="password" className="input" placeholder="Repite la contraseña"
              value={confirm} onChange={e => setConfirm(e.target.value)} required />
          </div>
          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </form>
      )}
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="card text-zinc-400">Cargando...</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
