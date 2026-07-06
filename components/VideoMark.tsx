'use client'

import { useState } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  recordingId: string
  userId: string
  initialCompleted: boolean
}

const PARTICLE_COLORS = ['#DA7D41', '#EAAD74', '#7E301F', '#DA7D41', '#EAAD74', '#C0654A']

// Ráfaga de puntos en círculo alrededor del ícono — posiciones fijas (no random)
// para que el resultado sea el mismo en cada marcado, nada de parpadeo raro.
const PARTICLES = PARTICLE_COLORS.map((color, i) => {
  const angle = (i / PARTICLE_COLORS.length) * Math.PI * 2
  return { color, tx: Math.round(Math.cos(angle) * 22), ty: Math.round(Math.sin(angle) * 22) }
})

export default function VideoMark({ recordingId, userId, initialCompleted }: Props) {
  const [done, setDone] = useState(initialCompleted)
  const [loading, setLoading] = useState(false)
  const [celebrating, setCelebrating] = useState(false)

  async function toggle() {
    setLoading(true)
    const nextDone = !done
    const supabase = createClient()
    await supabase.from('recording_progress').upsert({
      user_id: userId,
      recording_id: recordingId,
      completed: nextDone,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,recording_id' })
    setDone(nextDone)
    setLoading(false)
    if (nextDone) {
      setCelebrating(true)
      setTimeout(() => setCelebrating(false), 650)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        done
          ? 'bg-emerald-500/15 text-emerald-400'
          : 'bg-surface-800 text-cream-dim hover:text-cream hover:bg-surface-700'
      }`}
    >
      {celebrating && PARTICLES.map((p, i) => (
        <span
          key={i}
          className="animate-celebrate-particle absolute left-3 top-1/2 w-1.5 h-1.5 rounded-full pointer-events-none"
          style={{ background: p.color, ['--tx' as string]: `${p.tx}px`, ['--ty' as string]: `${p.ty}px` }}
        />
      ))}
      {done
        ? <><CheckCircle2 size={14} className={celebrating ? 'animate-celebrate-pop' : ''} /> Visto</>
        : <><Circle size={14} /> Marcar como visto</>
      }
    </button>
  )
}
