import { createClient } from '@/lib/supabase/server'

export default async function NpsPage() {
  const supabase = await createClient()
  const { data: responses } = await supabase
    .from('nps_responses')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(50)

  const avg = responses && responses.length > 0
    ? Math.round((responses.reduce((s, r) => s + r.score, 0) / responses.length) * 10) / 10
    : null

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Resultados NPS</h1>
        {avg && (
          <div className="card py-2 px-4 text-center">
            <p className="text-2xl font-bold text-brand-400">{avg}</p>
            <p className="text-xs text-zinc-500">Promedio</p>
          </div>
        )}
      </div>
      <div className="space-y-3">
        {(responses ?? []).map(r => (
          <div key={r.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-200">{(r as any).profiles?.full_name ?? '—'}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {r.type === 'mejora_sesion' ? 'Mejora de sesión' : 'Interés de ascensión'}
                  {' · '}
                  {new Date(r.created_at).toLocaleDateString('es-CO')}
                </p>
              </div>
              <div className={`text-lg font-bold ${r.score >= 9 ? 'text-green-400' : r.score >= 7 ? 'text-amber-400' : 'text-red-400'}`}>
                {r.score}/10
              </div>
            </div>
            {r.feedback && (
              <p className="text-sm text-zinc-400 mt-3 bg-surface-800 rounded-lg px-3 py-2">"{r.feedback}"</p>
            )}
          </div>
        ))}
        {(!responses || responses.length === 0) && (
          <div className="card text-center text-zinc-500">Sin respuestas NPS aún</div>
        )}
      </div>
    </div>
  )
}
