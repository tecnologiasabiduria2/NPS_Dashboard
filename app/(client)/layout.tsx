import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import CommunityShell, { type ShellProduct } from '@/components/community/CommunityShell'
import OnboardingOverlay from '@/components/community/OnboardingOverlay'

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  // admin y owner (Diana) no son clientes → al panel admin.
  if (profile?.role === 'admin' || profile?.role === 'owner') redirect('/admin/dashboard')

  // Verificar acceso activo + productos a los que el cliente tiene acceso (para el riel).
  const { data: accesses } = await supabase
    .from('user_access')
    .select('product_id, products(title, slug)')
    .eq('user_id', user.id)
    .eq('status', 'active')

  if (!accesses || accesses.length === 0) redirect('/access-expired')

  const products: ShellProduct[] = accesses.map((a) => {
    const prod = Array.isArray(a.products) ? a.products[0] : a.products
    return {
      id: (a as { product_id: string }).product_id,
      title: (prod as { title?: string } | null)?.title ?? 'Producto',
      slug: (prod as { slug?: string } | null)?.slug ?? '',
    }
  })

  // Actualizar last_activity (fire and forget)
  supabaseAdmin
    .from('user_access')
    .update({ last_activity: new Date().toISOString() })
    .eq('user_id', user.id)
    .then(() => {})

  // Onboarding (5e): overlay de presentación si el cliente aún no tiene bio.
  // Consulta resiliente: si la columna no existe (migración pendiente), no bloquea.
  let needsOnboarding = false
  let avatarUrl: string | null = null
  const { data: bioRow } = await supabase.from('profiles').select('bio, avatar_url').eq('id', user.id).maybeSingle()
  if (bioRow) {
    const b = bioRow as { bio?: string | null; avatar_url?: string | null }
    if (!b.bio) needsOnboarding = true
    avatarUrl = b.avatar_url ?? null
  }

  const displayName = profile?.full_name ?? user.email ?? ''

  // NPS: ya NO se auto-muestra dentro de la plataforma (decisión reunión
  // 2026-06-30). Se califica vía link público por sesión (/nps/{token}).
  return (
    <>
      <CommunityShell userName={displayName} avatarUrl={avatarUrl} products={products}>
        {children}
      </CommunityShell>
      {needsOnboarding && <OnboardingOverlay userName={displayName} />}
    </>
  )
}
