'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

interface Props {
  href?: string
  label?: string
}

export default function BackLink({ href, label = 'Volver' }: Props) {
  const router = useRouter()

  function handleClick() {
    if (href) router.push(href)
    else router.back()
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 text-sm text-cream-muted hover:text-cream transition-colors mb-6"
    >
      <ChevronLeft size={15} />
      {label}
    </button>
  )
}
