import { supabaseAdmin } from '@/lib/supabase/admin'
import BannerCarousel, { type CarouselBanner } from './BannerCarousel'

// Wrapper server component: resuelve los banners vigentes (misma query que antes
// vivía en BannersRail) y los pasa al carrusel cliente. Se monta arriba de
// Inicio. Si no hay ninguno vigente, no renderiza nada (sin espacio vacío).
export default async function BannersTop() {
  const today = new Date().toISOString().split('T')[0]

  const { data: bannersRaw } = await supabaseAdmin
    .from('banners')
    .select('id, titulo, image_path, image_path_mobile, link_url')
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${today}`)
    .or(`ends_at.is.null,ends_at.gte.${today}`)
    .order('created_at', { ascending: false })

  const banners: CarouselBanner[] = ((bannersRaw as any[]) ?? []).map(b => ({
    id: b.id,
    titulo: b.titulo,
    link_url: b.link_url ?? null,
    imageUrl: supabaseAdmin.storage.from('banners').getPublicUrl(b.image_path).data.publicUrl,
    imageUrlMobile: b.image_path_mobile
      ? supabaseAdmin.storage.from('banners').getPublicUrl(b.image_path_mobile).data.publicUrl
      : null,
  }))

  if (banners.length === 0) return null

  return <BannerCarousel banners={banners} />
}
