import { createClient } from '@/lib/supabase/server'
import { DEFAULT_NPS_COPY, type NpsCopy } from '@/lib/nps'
import type { NpsTrigger } from '@/types'
import BackLink from '@/components/BackLink'
import NpsQuestionsForm from './NpsQuestionsForm'

export default async function NpsQuestionsPage() {
  const supabase = await createClient()
  const { data: rows } = await supabase
    .from('nps_questions')
    .select('trigger, eyebrow, title, question')

  // Mezcla lo guardado con los textos por defecto (por si la tabla está incompleta).
  const byTrigger = new Map<string, NpsCopy>()
  for (const r of rows ?? []) {
    byTrigger.set(r.trigger, { eyebrow: r.eyebrow, title: r.title, question: r.question })
  }
  const copyFor = (t: NpsTrigger): NpsCopy => byTrigger.get(t) ?? DEFAULT_NPS_COPY[t]

  return (
    <div className="max-w-2xl">
      <BackLink href="/admin/nps" label="Volver a NPS" />
      <h1 className="text-2xl font-bold text-cream mt-2 mb-2">Preguntas del NPS</h1>
      <p className="text-sm text-zinc-500 mb-8">
        Estos son los textos que ve el cliente en la encuesta. En el título de post-sesión,
        el token <code className="text-accent">{'{sesion}'}</code> se reemplaza por el nombre de la sesión.
      </p>

      <div className="space-y-8">
        <NpsQuestionsForm
          trigger="post_sesion"
          label="Post-sesión (al terminar una sesión en vivo)"
          initial={copyFor('post_sesion')}
        />
      </div>
    </div>
  )
}
