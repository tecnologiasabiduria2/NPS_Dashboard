import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import MembersList, { type Member } from './MembersList'
import { productFullName } from '@/lib/productIdentity'

export const dynamic = 'force-dynamic'

export default async function MiembrosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Productos del viewer → sus compañeros de comunidad (mismo producto activo).
  const { data: myAccess } = await supabase
    .from('user_access').select('product_id, products(title)').eq('user_id', user.id).eq('status', 'active')
  const productIds = ((myAccess ?? []) as { product_id: string }[]).map(a => a.product_id)

  // Nombre de la comunidad = producto activo del viewer (nombre completo del
  // brandbook), en vez de "Sabiduría Empresarial" hardcodeado (2026-07-14).
  const firstAccess = (myAccess ?? [])[0] as any
  const rawTitle = Array.isArray(firstAccess?.products) ? firstAccess.products[0]?.title : firstAccess?.products?.title
  const comunidadNombre = rawTitle ? productFullName(rawTitle) : 'Sabiduría Empresarial'

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
        byId.set(p.id, { id: p.id, name: p.full_name || 'Miembro', role: p.role || 'client', joined: r.access_started ?? null, bio: null, avatarUrl: null, phone: null, instagram: null, website: null, sector: null, productoServicio: null })
      }
    }
  }

  // Equipo (admin/owner) — siempre visible en el directorio.
  const { data: team } = await supabaseAdmin
    .from('profiles').select('id, full_name, role, created_at').in('role', ['admin', 'owner'])
  for (const p of (team ?? []) as any[]) {
    if (!byId.has(p.id)) {
      byId.set(p.id, { id: p.id, name: p.full_name || 'Equipo', role: p.role, joined: p.created_at ?? null, bio: null, avatarUrl: null, phone: null, instagram: null, website: null, sector: null, productoServicio: null })
    }
  }

  // bio + avatar + telefono + redes (consulta aparte, resiliente si alguna migración no corrió).
  const ids = [...byId.keys()]
  if (ids.length) {
    const { data: extra } = await supabaseAdmin.from('profiles').select('id, bio, avatar_url, phone, instagram, website, sector, producto_servicio').in('id', ids)
    for (const e of (extra ?? []) as any[]) {
      const m = byId.get(e.id)
      if (m) {
        m.bio = e.bio ?? null
        m.avatarUrl = e.avatar_url ?? null
        m.phone = e.phone ?? null
        m.instagram = e.instagram ?? null
        m.website = e.website ?? null
        m.sector = e.sector ?? null
        m.productoServicio = e.producto_servicio ?? null
      }
    }
  }

  const members = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div>
      <h1 className="page-title">Miembros</h1>
      <p className="page-subtitle mb-6">La comunidad de {comunidadNombre}</p>
      <MembersList members={members} />
    </div>
  )
}
