import { Skeleton } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div>
      <div className="mb-8">
        <Skeleton className="h-3.5 w-24 mb-2.5" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="w-full lg:w-72 shrink-0 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
        <Skeleton className="flex-1 w-full h-[520px]" />
      </div>
    </div>
  )
}
