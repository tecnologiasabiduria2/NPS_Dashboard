import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import VideoPlayer from '@/components/VideoPlayer'
import VideoMark from '@/components/VideoMark'
import { FileDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { contentTipoLabel } from '@/lib/sessionTypes'

interface Props {
  params: Promise<{ id: string }>
}

// Grabaciones de estos tipos son transversales: visibles para todos los clientes del producto,
// sin importar qué hiperfoco tienen asignado.
const TRANSVERSAL_TIPOS = ['sala_gerencia', 'entrenamiento_comercial']

export default async function RecordingPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [recRes, accessRes, historialRes] = await Promise.all([
    supabase
      .from('recordings')
      .select('*, hiperfocos(id, title, product_id)')
      .eq('id', id)
      .eq('is_published', true)
      .single(),
    supabase
      .from('user_access')
      .select('product_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1),
    supabase
      .from('user_hiperfoco_mes')
      .select('hiperfoco_id')
      .eq('user_id', user.id)
      .not('hiperfoco_id', 'is', null),
  ])

  const rec = recRes.data as any
  const access = (accessRes.data as any[] | null)?.[0]

  if (!rec || !access) notFound()

  const hf = rec.hiperfocos as any
  if (!hf) notFound()

  // Verificar que el contenido es del producto activo del usuario
  if (hf.product_id !== access.product_id) notFound()

  // B12: verificar acceso al hiperfoco (tipos SG/EC son transversales: siempre accesibles)
  const isTransversal = TRANSVERSAL_TIPOS.includes(rec.tipo)
  if (!isTransversal) {
    const accessible = new Set((historialRes.data ?? []).map((h: any) => h.hiperfoco_id as string))
    if (!accessible.has(rec.hiperfoco_id)) redirect('/roadmap')
  }

  // Grabaciones hermanas (mismo hiperfoco + tipo) para navegación prev/next
  const { data: siblings } = await supabase
    .from('recordings')
    .select('id, title, order')
    .eq('hiperfoco_id', rec.hiperfoco_id)
    .eq('tipo', rec.tipo)
    .eq('is_published', true)
    .order('order')

  const siblingList = (siblings ?? []) as Array<{ id: string; title: string; order: number }>
  const idx = siblingList.findIndex(s => s.id === id)
  const prevRec = idx > 0 ? siblingList[idx - 1] : null
  const nextRec = idx >= 0 && idx < siblingList.length - 1 ? siblingList[idx + 1] : null

  // Progreso (video y documento — cualquier contenido se puede marcar como visto)
  const { data: progress } = await supabase
    .from('recording_progress')
    .select('completed')
    .eq('user_id', user.id)
    .eq('recording_id', id)
    .maybeSingle()
  const initialCompleted = progress?.completed ?? false

  const tipoLabel = contentTipoLabel(rec.tipo)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <p className="text-xs text-cream-muted uppercase tracking-wider mb-1">
          {hf.title} · {tipoLabel}
        </p>
        <h1 className="text-2xl font-bold text-cream">{rec.title}</h1>
      </div>

      {/* Video */}
      {rec.type === 'video' && rec.fathom_share_id && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-cream-dim">Video</p>
            <VideoMark
              recordingId={id}
              userId={user.id}
              initialCompleted={initialCompleted}
            />
          </div>
          <VideoPlayer shareId={rec.fathom_share_id} />
        </div>
      )}

      {/* Documento */}
      {rec.type === 'document' && rec.storage_path && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-cream-dim">📎 Material</p>
            <VideoMark
              recordingId={id}
              userId={user.id}
              initialCompleted={initialCompleted}
            />
          </div>
          <a
            href={`/api/download?path=${encodeURIComponent(rec.storage_path)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors group"
          >
            <FileDown size={16} className="text-cream-muted group-hover:text-brand-400 transition-colors" />
            <span className="text-sm text-cream-dim group-hover:text-cream">{rec.title}</span>
          </a>
        </div>
      )}

      {/* Navegación prev/next */}
      {(prevRec || nextRec) && (
        <div className="flex items-center justify-between gap-4 mt-8 pt-6 border-t border-surface-700">
          {prevRec ? (
            <Link
              href={`/recording/${prevRec.id}`}
              className="flex items-center gap-2 px-4 py-2.5 bg-surface-800 hover:bg-surface-700 rounded-lg text-sm text-cream-dim hover:text-cream transition-colors group min-w-0 flex-1"
            >
              <ChevronLeft size={16} className="shrink-0 text-zinc-500 group-hover:text-cream-dim" />
              <span className="truncate">{prevRec.title}</span>
            </Link>
          ) : (
            <div />
          )}
          {nextRec && (
            <Link
              href={`/recording/${nextRec.id}`}
              className="flex items-center gap-2 px-4 py-2.5 bg-surface-800 hover:bg-surface-700 rounded-lg text-sm text-cream-dim hover:text-cream transition-colors group min-w-0 flex-1 justify-end"
            >
              <span className="truncate">{nextRec.title}</span>
              <ChevronRight size={16} className="shrink-0 text-zinc-500 group-hover:text-cream-dim" />
            </Link>
          )}
        </div>
      )}

      <div className="mt-8">
        <Link href="/roadmap" className="text-sm text-cream-muted hover:text-cream transition-colors">
          ← Mi contenido
        </Link>
      </div>
    </div>
  )
}
