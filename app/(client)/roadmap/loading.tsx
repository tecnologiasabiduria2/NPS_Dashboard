import { Skeleton } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div>
      <div className="mb-8">
        <Skeleton className="h-3.5 w-24 mb-2.5" />
        <Skeleton className="h-8 w-56" />
      </div>
      <Skeleton className="h-64 w-full rounded-3xl mb-8" />
      <Skeleton className="h-3 w-20 mb-3" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
