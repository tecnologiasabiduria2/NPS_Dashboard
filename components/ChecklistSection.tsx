'use client'

import { useState } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { clsx } from 'clsx'

interface ChecklistSectionProps {
  items: Array<{ id: string; title: string }>
  completedIds: string[]
  userId: string
}

export default function ChecklistSection({ items, completedIds, userId }: ChecklistSectionProps) {
  const [completed, setCompleted] = useState<Set<string>>(new Set(completedIds))
  const [loading, setLoading] = useState<string | null>(null)

  async function toggle(lessonId: string) {
    setLoading(lessonId)
    const isCompleted = completed.has(lessonId)
    const supabase = createClient()

    await supabase.from('lesson_progress').upsert({
      user_id: userId,
      lesson_id: lessonId,
      completed: !isCompleted,
      completed_at: !isCompleted ? new Date().toISOString() : null,
    }, { onConflict: 'user_id,lesson_id' })

    setCompleted(prev => {
      const next = new Set(prev)
      if (isCompleted) next.delete(lessonId)
      else next.add(lessonId)
      return next
    })
    setLoading(null)
  }

  const doneCount = items.filter(i => completed.has(i.id)).length

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-zinc-300">✅ Entregables</p>
        <span className="text-xs text-zinc-500">{doneCount}/{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.map(item => {
          const done = completed.has(item.id)
          return (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              disabled={loading === item.id}
              className={clsx(
                'flex items-center gap-3 w-full px-3 py-3 rounded-lg text-left transition-colors',
                done ? 'bg-green-500/10' : 'bg-surface-800 hover:bg-surface-700'
              )}
            >
              {done
                ? <CheckCircle2 size={18} className="text-green-400 shrink-0" />
                : <Circle size={18} className="text-zinc-600 shrink-0" />
              }
              <span className={clsx('text-sm', done ? 'text-green-300 line-through' : 'text-zinc-300')}>
                {item.title}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
