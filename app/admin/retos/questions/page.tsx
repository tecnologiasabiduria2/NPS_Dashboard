import { createClient } from '@/lib/supabase/server'
import { DEFAULT_RETO_PREGUNTAS } from '@/lib/retosPreguntas'
import BackLink from '@/components/BackLink'
import RetoPreguntaForm from './RetoPreguntaForm'

export default async function RetoQuestionsPage() {
  const supabase = await createClient()
  const { data: rows } = await supabase.from('reto_preguntas').select('id, texto')

  const textoById = new Map((rows ?? []).map((r: any) => [r.id as string, r.texto as string]))
  const textoFor = (id: string) =>
    textoById.get(id) ?? DEFAULT_RETO_PREGUNTAS.find(p => p.id === id)?.texto ?? ''

  return (
    <div className="max-w-2xl">
      <BackLink href="/admin/clients" label="Volver a clientes" />
      <h1 className="page-title mt-2 mb-2">Preguntas de retos</h1>
      <p className="text-sm text-cream-muted mb-8">
        Estas son las preguntas que ve el cliente al iniciar un nuevo hiperfoco/módulo, para medir
        su punto de partida (claridad, confianza y tamaño del reto).
      </p>

      <div className="space-y-8">
        <RetoPreguntaForm id="claridad" label="Claridad de objetivos" initialTexto={textoFor('claridad')} />
        <RetoPreguntaForm id="confianza" label="Confianza para aplicar" initialTexto={textoFor('confianza')} />
        <RetoPreguntaForm id="reto" label="Tamaño del reto" initialTexto={textoFor('reto')} />
      </div>
    </div>
  )
}
