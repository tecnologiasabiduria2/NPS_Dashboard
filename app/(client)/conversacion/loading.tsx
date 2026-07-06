import { Skeleton } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div className="flex gap-6 items-start">
      <div className="hidden md:block w-56 shrink-0 space-y-1.5">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9" />)}
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        <Skeleton className="h-28" />
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="hidden xl:block w-72 shrink-0">
        <Skeleton className="h-56" />
      </div>
    </div>
  )
}
