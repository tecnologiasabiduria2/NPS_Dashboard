// Placeholders de carga (Next.js loading.tsx): la forma de la página final en
// gris, pulsando, en vez de spinner genérico o pantalla congelada mientras el
// Server Component hace sus consultas. `animate-pulse` es utilidad nativa de
// Tailwind, sin CSS nuevo.
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-800 rounded-xl ${className}`} />
}

export function SkeletonPage({
  hero = false,
  kpis = 0,
  donuts = 0,
  cards = 0,
}: {
  hero?: boolean
  kpis?: number
  donuts?: number
  cards?: number
}) {
  return (
    <div>
      <div className="mb-8">
        <Skeleton className="h-3.5 w-24 mb-2.5" />
        <Skeleton className="h-8 w-64" />
      </div>

      {hero && <Skeleton className="h-64 w-full rounded-3xl mb-6" />}

      {kpis > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: kpis }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}

      {donuts > 0 && (
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {Array.from({ length: donuts }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      )}

      {cards > 0 && (
        <div className="space-y-4">
          {Array.from({ length: cards }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}
    </div>
  )
}
