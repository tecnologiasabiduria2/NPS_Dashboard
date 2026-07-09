import { createClient } from '@/lib/supabase/server'
import { formatDateOnly } from '@/lib/format'
import { redirect } from 'next/navigation'
import ProfileForm from './ProfileForm'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, created_at, bio, instagram, website, avatar_url')
    .eq('id', user.id)
    .single()

  const { data: accessRows } = await supabase
    .from('user_access')
    .select('status, access_until, access_started, products(title)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
  const access = accessRows?.[0]

  return (
    <div className="max-w-lg">
      <h1 className="page-title mb-8">Mi perfil</h1>

      <ProfileForm
        email={user.email ?? ''}
        fullName={profile?.full_name ?? ''}
        phone={profile?.phone ?? ''}
        bio={profile?.bio ?? ''}
        instagram={profile?.instagram ?? ''}
        website={profile?.website ?? ''}
        avatarUrl={profile?.avatar_url ?? null}
      />

      <div className="card">
        <p className="section-label">Mi suscripción</p>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-cream-muted">Programa</p>
            <p className="text-cream">{(access as any)?.products?.title ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-cream-muted">Estado</p>
            <span className="badge-active">Activo</span>
          </div>
          {access?.access_until && (
            <div>
              <p className="text-xs text-cream-muted">Acceso hasta</p>
              <p className="text-cream">
                {formatDateOnly(access.access_until, { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
