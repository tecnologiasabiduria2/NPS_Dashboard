import Link from 'next/link'
import { Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import NpsResults from './NpsResults'

export default async function NpsPage() {
  const supabase = await createClient()
  const { data: responses } = await supabase
    .from('nps_responses')
    .select('id, score, feedback, type, trigger, hiperfoco_id, created_at, profiles(full_name), hiperfocos(title, products(title))')
    .order('created_at', { ascending: false })
    .limit(500)

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-cream">Resultados NPS</h1>
        <Link href="/admin/nps/questions" className="btn-ghost flex items-center gap-2">
          <Settings size={16} />
          Configurar preguntas
        </Link>
      </div>
      <NpsResults responses={(responses ?? []) as any[]} />
    </div>
  )
}
