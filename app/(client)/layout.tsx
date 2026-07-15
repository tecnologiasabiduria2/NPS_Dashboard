import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import CommunityShell, { type ShellProduct } from '@/components/community/CommunityShell'
import OnboardingOverlay from '@/components/community/OnboardingOverlay'
import MetricasOverlay from '@/components/community/MetricasOverlay'
import RetosOverlay from '@/components/community/RetosOverlay'
import { fetchRetoPreguntas } from '@/lib/retosPreguntas'

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

  // Métricas de negocio (punto 9 Fase 2): mostrar el overlay privado si el
  // cliente aún no registró facturación/objetivo del mes ACTUAL. Resiliente: si
  // la migración no corrió, la query falla y no se muestra (no bloquea).
  let needsMetricas = false
  {
    const now = new Date()
    const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const { data: metRow, error: metErr } = await supabase
      .from('user_metricas_mes').select('id').eq('user_id', user.id).eq('periodo', periodo).maybeSingle()
    if (!metErr && !metRow) needsMetricas = true
  }

  // Retos por módulo (punto 9 Fase 2): si el cliente tiene un hiperfoco en_curso
  // este mes y aún no respondió sus preguntas de inicio, mostrar el pop-up.
  // Resiliente si las migraciones no corrieron.
  let retoHiperfoco: { id: string; title: string } | null = null
  {
    const now = new Date()
    const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const { data: hfRow, error: hfErr } = await supabase
      .from('user_hiperfoco_mes')
      .select('hiperfoco_id, hiperfocos(title)')
      .eq('user_id', user.id)
      .eq('periodo', periodo)
      .eq('estado', 'en_curso')
      .not('hiperfoco_id', 'is', null)
      .maybeSingle()
    if (!hfErr && (hfRow as any)?.hiperfoco_id) {
      const hfId = (hfRow as any).hiperfoco_id as string
      const { data: retoRow, error: retoErr } = await supabase
        .from('user_reto_hiperfoco').select('id')
        .eq('user_id', user.id).eq('hiperfoco_id', hfId).eq('periodo', periodo).maybeSingle()
      if (!retoErr && !retoRow) {
        const hfData = (hfRow as any).hiperfocos
        const title = Array.isArray(hfData) ? hfData[0]?.title : hfData?.title
        retoHiperfoco = { id: hfId, title: title ?? 'este módulo' }
      }
    }
  }
  const retoPreguntas = retoHiperfoco ? await fetchRetoPreguntas(supabase) : null

  const displayName = profile?.full_name ?? user.email ?? ''

  // NPS: ya NO se auto-muestra dentro de la plataforma (decisión reunión
  // 2026-06-30). Se califica vía link público por sesión (/nps/{token}).
  return (
    <>
      <CommunityShell userName={displayName} avatarUrl={avatarUrl} products={products}>
        {children}
      </CommunityShell>
      {/* Un solo overlay a la vez, por prioridad: bienvenida a la comunidad →
          métricas de negocio → retos del módulo nuevo. Cada uno se descarta con
          "Ahora no" (sessionStorage) y no bloquea el guardado de datos. */}
      {needsOnboarding ? (
        <OnboardingOverlay userName={displayName} />
      ) : needsMetricas ? (
        <MetricasOverlay />
      ) : retoHiperfoco && retoPreguntas ? (
        <RetosOverlay hiperfocoId={retoHiperfoco.id} hiperfocoTitulo={retoHiperfoco.title} preguntas={retoPreguntas} />
      ) : null}
    </>
  )
}
