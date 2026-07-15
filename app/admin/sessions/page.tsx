import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import SessionForm from './SessionForm'
import SessionsList from './SessionsList'
import { Calendar } from 'lucide-react'

export default async function AdminSessionsPage() {
  const supabase = await createClient()

  // Pasadas: solo la última semana (2026-07-15, pedido de Juan — el histórico
  // completo ya no era útil de ver aquí día a día). No se borra nada de la
  // BD, solo se deja de traer/mostrar en este panel; el resto de la app
  // (asistencia, NPS, hoja de vida del cliente) sigue consultando la tabla
  // completa sin este recorte.
  const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: products }, { data: sessRows }] = await Promise.all([
    supabase.from('products').select('id, title, slug').order('order'),
    supabase
      .from('live_sessions')
      .select('id, title, tipo, starts_at, ends_at, zoom_url, is_published, product_id')
      .gte('ends_at', weekAgoIso)
      .order('starts_at', { ascending: true }),
  ])

  const prodTitle = new Map<string, string>(((products ?? []) as any[]).map(p => [p.id, p.title]))

  // Nombres de hiperfoco distintos (para el selector primario del form).
  const { data: hfList } = await supabase.from('hiperfocos').select('title').eq('is_active', true)
  const hiperfocoNames = Array.from(new Set(((hfList ?? []) as any[]).map(h => h.title as string))).sort()

  // Links recurrentes por tipo (platform_settings, key = zoom_link_<tipo>).
  // RLS sin policies → se lee con service role.
  const recurringLinks: Record<string, string> = {}
  const { data: rlRows } = await supabaseAdmin.from('platform_settings').select('key, value').like('key', 'zoom_link_%')
  for (const r of (rlRows ?? []) as { key: string; value: string }[]) {
    recurringLinks[r.key.replace('zoom_link_', '')] = r.value
  }

  // Campos opcionales en consultas aparte (resiliente si la migración no corrió).
  // Mismo recorte de fecha que arriba para no traer de vuelta todo el histórico.
  const descById: Record<string, string> = {}
  const { data: descRows } = await supabase.from('live_sessions').select('id, descripcion').gte('ends_at', weekAgoIso)
  for (const r of (descRows ?? []) as { id: string; descripcion?: string | null }[]) if (r.descripcion) descById[r.id] = r.descripcion

  const hfNombreById: Record<string, string> = {}
  const { data: hfNombreRows } = await supabase.from('live_sessions').select('id, hiperfoco_nombre').gte('ends_at', weekAgoIso)
  for (const r of (hfNombreRows ?? []) as { id: string; hiperfoco_nombre?: string | null }[]) if (r.hiperfoco_nombre) hfNombreById[r.id] = r.hiperfoco_nombre

  const npsTokenById: Record<string, string> = {}
  const { data: tokenRows } = await supabase.from('live_sessions').select('id, nps_token').gte('ends_at', weekAgoIso)
  for (const r of (tokenRows ?? []) as { id: string; nps_token?: string | null }[]) if (r.nps_token) npsTokenById[r.id] = r.nps_token

  const sessions = ((sessRows ?? []) as any[]).map(s => ({
    id: s.id,
    title: s.title,
    tipo: s.tipo,
    starts_at: s.starts_at,
    ends_at: s.ends_at,
    zoom_url: s.zoom_url,
    is_published: s.is_published,
    product_id: s.product_id ?? '',
    descripcion: descById[s.id] ?? null,
    hiperfoco_nombre: hfNombreById[s.id] ?? null,
  }))

  const productOptions = ((products ?? []) as any[]).map(p => ({ id: p.id, label: p.title }))

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar size={22} className="text-brand-400" />
          <h1 className="page-title">Sesiones en vivo</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Formulario */}
        <SessionForm products={productOptions} hiperfocoNames={hiperfocoNames} sessions={sessions} recurringLinks={recurringLinks} />

        {/* Listado separado: próximas / pasadas (hora Colombia), con buscador */}
        <SessionsList
          sessions={sessions}
          prodTitle={Object.fromEntries(prodTitle)}
          npsTokenById={npsTokenById}
        />
      </div>
    </div>
  )
}
