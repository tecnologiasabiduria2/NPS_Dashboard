import { Skeleton } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-72 mb-6" />
      <Skeleton className="h-40" />
    </div>
  )
}
