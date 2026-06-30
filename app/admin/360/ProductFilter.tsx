'use client'

import { useRouter, usePathname } from 'next/navigation'

// Desplegable de producto de la Vista 360. Filtra (vía ?producto=slug) las
// secciones por hiperfoco. "" = todos los productos.
export default function ProductFilter({
  options,
  value,
}: {
  options: { slug: string; title: string }[]
  value: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  return (
    <select
      className="select w-auto"
      defaultValue={value}
      onChange={e => {
        const v = e.target.value
        router.push(v ? `${pathname}?producto=${encodeURIComponent(v)}` : pathname)
      }}
    >
      <option value="">Todos los productos</option>
      {options.map(o => (
        <option key={o.slug} value={o.slug}>{o.title}</option>
      ))}
    </select>
  )
}
