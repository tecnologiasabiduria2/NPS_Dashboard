import { Skeleton } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div>
      <div className="mb-8">
        <Skeleton className="h-8 w-36 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-11 w-full mb-5" />
      <div className="space-y-2.5">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
    </div>
  )
}
