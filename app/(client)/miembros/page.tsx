import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import MembersList, { type Member } from './MembersList'

export const dynamic = 'force-dynamic'

export default async function MiembrosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Productos del viewer → sus compañeros de comunidad (mismo producto activo).
  const { data: myAccess } = await supabase
    .from('user_access').select('product_id').eq('user_id', user.id).eq('status', 'active')
  const productIds = ((myAccess ?? []) as { product_id: string }[]).map(a => a.product_id)

  const byId = new Map<string, Member>()

  if (productIds.length) {
    // service role → puede leer los perfiles de los demás miembros (sin tocar RLS).
    const { data: rows } = await supabaseAdmin
      .from('user_access')
      .select('access_started, profiles(id, full_name, role)')
      .in('product_id', productIds)
      .eq('status', 'active')
    for (const r of (rows ?? []) as any[]) {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
      if (!p) continue
      if (!byId.has(p.id)) {
        byId.set(p.id, { id: p.id, name: p.full_name || 'Miembro', role: p.role || 'client', joined: r.access_started ?? null, bio: null, avatarUrl: null })
      }
    }
  }

  // Equipo (admin/owner) — siempre visible en el directorio.
  const { data: team } = await supabaseAdmin
    .from('profiles').select('id, full_name, role, created_at').in('role', ['admin', 'owner'])
  for (const p of (team ?? []) as any[]) {
    if (!byId.has(p.id)) {
      byId.set(p.id, { id: p.id, name: p.full_name || 'Equipo', role: p.role, joined: p.created_at ?? null, bio: null, avatarUrl: null })
    }
  }

  // bio + avatar (consulta aparte, resiliente si la migración de 5e no corrió).
  const ids = [...byId.keys()]
  if (ids.length) {
    const { data: extra } = await supabaseAdmin.from('profiles').select('id, bio, avatar_url').in('id', ids)
    for (const e of (extra ?? []) as any[]) {
      const m = byId.get(e.id)
      if (m) { m.bio = e.bio ?? null; m.avatarUrl = e.avatar_url ?? null }
    }
  }

  const members = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="max-w-4xl">
      <h1 className="page-title">Miembros</h1>
      <p className="page-subtitle mb-6">La comunidad de Sabiduría Empresarial</p>
      <MembersList members={members} />
    </div>
  )
}
