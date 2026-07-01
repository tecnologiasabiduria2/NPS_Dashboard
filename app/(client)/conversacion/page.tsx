import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Foro, { type ForoPost, type CommunityInfo } from './Foro'

export const dynamic = 'force-dynamic'

export default async function ConversacionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: myAccess } = await supabase
    .from('user_access').select('product_id, products(title)').eq('user_id', user.id).eq('status', 'active')
  const accessRows = (myAccess ?? []) as any[]
  const productIds = accessRows.map(a => a.product_id)
  const firstProduct = accessRows[0] ? (Array.isArray(accessRows[0].products) ? accessRows[0].products[0] : accessRows[0].products) : null

  // Info de comunidad para el panel derecho (miembros del/los producto(s) del cliente).
  const community: CommunityInfo = { name: firstProduct?.title ?? 'Sabiduría Empresarial', memberCount: 0, avatars: [] }
  if (productIds.length) {
    const { data: mem } = await supabaseAdmin
      .from('user_access')
      .select('profiles(id, full_name, avatar_url)')
      .in('product_id', productIds)
      .eq('status', 'active')
    const memMap = new Map<string, { id: string; name: string; avatarUrl: string | null }>()
    for (const r of (mem ?? []) as any[]) {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
      if (p && !memMap.has(p.id)) memMap.set(p.id, { id: p.id, name: p.full_name || 'Miembro', avatarUrl: p.avatar_url ?? null })
    }
    community.memberCount = memMap.size
    community.avatars = [...memMap.values()].slice(0, 6)
  }

  let posts: ForoPost[] = []
  if (productIds.length) {
    const { data: rawPosts } = await supabaseAdmin
      .from('foro_posts')
      .select('id, user_id, category, body, created_at')
      .in('product_id', productIds)
      .order('created_at', { ascending: false })
      .limit(50)
    const pl = (rawPosts ?? []) as any[]
    const postIds = pl.map(p => p.id)
    const userIds = new Set<string>(pl.map(p => p.user_id))

    let comments: any[] = []
    let likes: any[] = []
    if (postIds.length) {
      const [{ data: c }, { data: l }] = await Promise.all([
        supabaseAdmin.from('foro_comments').select('id, post_id, user_id, body, created_at').in('post_id', postIds).order('created_at', { ascending: true }),
        supabaseAdmin.from('foro_likes').select('post_id, user_id').in('post_id', postIds),
      ])
      comments = c ?? []
      likes = l ?? []
      comments.forEach(cc => userIds.add(cc.user_id))
    }

    const { data: profs } = await supabaseAdmin.from('profiles').select('id, full_name, avatar_url').in('id', [...userIds])
    const profMap = new Map<string, any>(((profs ?? []) as any[]).map(p => [p.id, p]))
    const name = (id: string) => profMap.get(id)?.full_name || 'Miembro'
    const avatar = (id: string) => profMap.get(id)?.avatar_url ?? null

    posts = pl.map(p => ({
      id: p.id,
      author: name(p.user_id),
      authorAvatar: avatar(p.user_id),
      category: p.category,
      body: p.body,
      createdAt: p.created_at,
      likeCount: likes.filter(l => l.post_id === p.id).length,
      likedByMe: likes.some(l => l.post_id === p.id && l.user_id === user.id),
      comments: comments
        .filter(c => c.post_id === p.id)
        .map(c => ({ id: c.id, author: name(c.user_id), authorAvatar: avatar(c.user_id), body: c.body, createdAt: c.created_at })),
    }))
  }

  return (
    <div>
      <h1 className="page-title mb-1">Conversación</h1>
      <p className="page-subtitle mb-6">Comparte y conversa con la comunidad.</p>
      <Foro posts={posts} community={community} />
    </div>
  )
}
