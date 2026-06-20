'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Credenciales incorrectas. Verifica tu email y contraseña.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold text-cream mb-2">Bienvenido</h1>
      <p className="text-cream-muted text-sm mb-8">Accede a tu plataforma de aprendizaje</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" placeholder="tu@empresa.com"
            value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label">Contraseña</label>
          <input type="password" className="input" placeholder="••••••••"
            value={password} onChange={e => setPassword(e.target.value)} required />
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
              Ingresando...
            </span>
          ) : 'Ingresar'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link href="/forgot-password" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
    </div>
  )
}
