import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, created_at')
    .eq('id', user.id)
    .single()

  const { data: access } = await supabase
    .from('user_access')
    .select('status, access_until, access_started, products(title)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-zinc-100 mb-8">Mi perfil</h1>

      <div className="card mb-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Información personal</p>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-zinc-500">Nombre</p>
            <p className="text-zinc-100">{profile?.full_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Email</p>
            <p className="text-zinc-100">{user.email}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Teléfono</p>
            <p className="text-zinc-100">{profile?.phone ?? '—'}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Mi suscripción</p>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-zinc-500">Programa</p>
            <p className="text-zinc-100">{(access as any)?.products?.title ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Estado</p>
            <span className="badge-active">Activo</span>
          </div>
          {access?.access_until && (
            <div>
              <p className="text-xs text-zinc-500">Acceso hasta</p>
              <p className="text-zinc-100">
                {new Date(access.access_until).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
