import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Banners de anuncios (2026-07-09) — se muestran apilados debajo de la
// tarjeta de Comunidad/Membresía en el riel derecho de /dashboard. Imagen tal
// cual (ya viene diseñada), sin texto superpuesto. Si no hay ninguno vigente,
// no renderiza nada (sin espacio vacío).
export default async function BannersRail() {
  const today = new Date().toISOString().split('T')[0]

  const { data: bannersRaw } = await supabaseAdmin
    .from('banners')
    .select('id, titulo, image_path, link_url')
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${today}`)
    .or(`ends_at.is.null,ends_at.gte.${today}`)
    .order('created_at', { ascending: false })

  const banners = ((bannersRaw as any[]) ?? []).map(b => ({
    ...b,
    imageUrl: supabaseAdmin.storage.from('banners').getPublicUrl(b.image_path).data.publicUrl,
  }))

  if (banners.length === 0) return null

  return (
    <>
      {banners.map(b => {
        const img = (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.imageUrl} alt={b.titulo} className="w-full h-auto rounded-2xl" />
        )
        return b.link_url ? (
          <Link key={b.id} href={b.link_url} target="_blank" rel="noopener noreferrer" className="block">
            {img}
          </Link>
        ) : (
          <div key={b.id}>{img}</div>
        )
      })}
    </>
  )
}
