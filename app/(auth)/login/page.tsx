'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      <div className="mb-8">
        <span className="inline-flex items-center rounded-full bg-brand-600/10 border border-brand-600/20 px-3 py-1 text-xs font-medium text-brand-300 mb-4">
          Plataforma privada
        </span>
        <h1 className="text-3xl font-semibold text-cream mb-2">Bienvenido de nuevo</h1>
        <p className="text-cream-muted text-sm">Ingresa a tu comunidad de aprendizaje.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="label">Email</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cream-muted pointer-events-none" />
            <input
              type="email"
              className="input pl-10"
              placeholder="tu@empresa.com"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className="label">Contraseña</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cream-muted pointer-events-none" />
            <input
              type={showPassword ? 'text' : 'password'}
              className="input pl-10 pr-11"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-cream-muted hover:text-cream hover:bg-surface-800 transition-colors"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="flex justify-end mt-2">
            <Link href="/forgot-password" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base group">
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Ingresando...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Ingresar
              <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          )}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-surface-800 text-center">
        <p className="text-xs text-cream-muted">
          ¿Problemas para entrar? Escribe a tu Business Coach o revisa tu correo de invitación.
        </p>
      </div>
    </div>
  )
}
