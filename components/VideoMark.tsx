'use client'

import { useState } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  recordingId: string
  userId: string
  initialCompleted: boolean
}

export default function VideoMark({ recordingId, userId, initialCompleted }: Props) {
  const [done, setDone] = useState(initialCompleted)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('recording_progress').upsert({
      user_id: userId,
      recording_id: recordingId,
      completed: !done,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,recording_id' })
    setDone(!done)
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        done
          ? 'bg-emerald-500/15 text-emerald-400'
          : 'bg-surface-800 text-cream-dim hover:text-cream hover:bg-surface-700'
      }`}
    >
      {done
        ? <><CheckCircle2 size={14} /> Visto</>
        : <><Circle size={14} /> Marcar como visto</>
      }
    </button>
  )
}
