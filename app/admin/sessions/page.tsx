import { createClient } from '@/lib/supabase/server'
import SessionForm from './SessionForm'
import DeleteSessionButton from './DeleteSessionButton'
import { Calendar, Video } from 'lucide-react'
import { sessionTipoLabel } from '@/lib/sessionTypes'

export default async function AdminSessionsPage() {
  const supabase = await createClient()
  const { data: products } = await supabase
    .from('products')
    .select('id, title, slug, order, live_sessions(id, title, tipo, starts_at, ends_at, zoom_url, is_published)')
    .order('order')

  const productOptions: { id: string; label: string }[] = []
  const sessionsByProduct: Record<string, any[]> = {}
  for (const p of (products ?? []) as any[]) {
    productOptions.push({ id: p.id, label: p.title })
    sessionsByProduct[p.id] = [...(p.live_sessions ?? [])].sort(
      (a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    )
  }

  const now = Date.now()

  return (
    <div className="max-w-6xl">
      <div className="flex items-center gap-2 mb-8">
        <Calendar size={22} className="text-brand-400" />
        <h1 className="text-2xl font-bold text-cream">Sesiones en vivo</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Formulario */}
        <SessionForm products={productOptions} sessionsByProduct={sessionsByProduct} />

        {/* Listado por producto */}
        <div className="space-y-4">
          {(products ?? []).map((p: any) => {
            const sessions = sessionsByProduct[p.id] ?? []
            return (
              <div key={p.id} className="card">
                <h2 className="text-base font-semibold text-cream mb-3">{p.title}</h2>
                {sessions.length === 0 ? (
                  <p className="text-sm text-cream-muted text-center py-3">Sin sesiones programadas</p>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((s: any) => {
                      const ended = new Date(s.ends_at).getTime() < now
                      return (
                        <div key={s.id} className="flex items-center justify-between bg-surface-800 rounded-lg px-3 py-2.5 gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <Video size={13} className={`${ended ? 'text-cream-muted' : 'text-accent'} mt-0.5 shrink-0`} />
                            <div className="min-w-0">
                              <p className="text-sm text-cream truncate">{sessionTipoLabel(s.tipo)}</p>
                              <p className="text-xs text-cream-muted mt-0.5 truncate">
                                {new Date(s.starts_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                                {s.title ? ` · ${s.title}` : ''}
                                {ended ? ' · terminada' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={s.is_published ? 'badge-active' : 'badge-pending'}>
                              {s.is_published ? 'Pub.' : 'Borrador'}
                            </span>
                            <DeleteSessionButton sessionId={s.id} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
