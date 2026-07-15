import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import BannerCrud from './BannerCrud'

// Banners de anuncios (2026-07-09) — admin+owner, ver plan de la sesión.
// Desde 2026-07-14 se muestran como carrusel arriba de Inicio
// (components/community/BannersTop.tsx → BannerCarousel.tsx).
export default async function BannersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin' && me?.role !== 'owner') redirect('/admin/dashboard')

  const { data: bannersRaw } = await supabaseAdmin
    .from('banners')
    .select('id, titulo, image_path, image_path_mobile, link_url, is_active, starts_at, ends_at')
    .order('created_at', { ascending: false })

  const banners = ((bannersRaw as any[]) ?? []).map(b => ({
    ...b,
    imageUrl: supabaseAdmin.storage.from('banners').getPublicUrl(b.image_path).data.publicUrl,
    imageUrlMobile: b.image_path_mobile
      ? supabaseAdmin.storage.from('banners').getPublicUrl(b.image_path_mobile).data.publicUrl
      : null,
  }))

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="page-title">Banners</h1>
        <p className="page-subtitle">Anuncios de eventos, campañas y alianzas — se muestran en Inicio, bajo la tarjeta de Comunidad</p>
      </div>
      <BannerCrud banners={banners} />
    </div>
  )
}
