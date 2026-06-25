import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import VideoPlayer from '@/components/VideoPlayer'
import VideoMark from '@/components/VideoMark'
import { FileDown, ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ModulePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: mod }, { data: access }] = await Promise.all([
    supabase
      .from('modules')
      .select('*, lessons(*)')
      .eq('id', id)
      .eq('is_published', true)
      .single(),
    supabase
      .from('user_access')
      .select('product_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single(),
  ])

  if (!mod || !access) notFound()

  // Verificar que el módulo pertenece al producto del usuario
  if (mod.product_id !== access.product_id) notFound()

  // Módulos hermanos (mismo hiperfoco si lo tiene, o mismo producto) para prev/next
  const siblingsQuery = mod.hiperfoco_id
    ? supabase
        .from('modules')
        .select('id, title, order')
        .eq('product_id', mod.product_id)
        .eq('hiperfoco_id', mod.hiperfoco_id)
        .eq('is_published', true)
        .order('order')
    : supabase
        .from('modules')
        .select('id, title, order')
        .eq('product_id', mod.product_id)
        .eq('is_published', true)
        .order('order')

  const { data: siblings } = await siblingsQuery
  const siblingList = (siblings ?? []) as Array<{ id: string; title: string; order: number }>
  const currentIndex = siblingList.findIndex(m => m.id === id)
  const prevModule = currentIndex > 0 ? siblingList[currentIndex - 1] : null
  const nextModule = currentIndex >= 0 && currentIndex < siblingList.length - 1 ? siblingList[currentIndex + 1] : null

  const lessons = (mod.lessons as any[]).sort((a: any, b: any) => a.order - b.order)
  const videos = lessons.filter((l: any) => l.type === 'video' && l.fathom_share_id)
  const documents = lessons.filter((l: any) => l.type === 'document' && l.storage_path)

  // Progreso de videos ("marca como visto")
  const videoIds = videos.map((l: any) => l.id)
  const completedVideoIds = new Set<string>()
  if (videoIds.length > 0) {
    const { data: progress } = await supabase
      .from('lesson_progress')
      .select('lesson_id, completed')
      .eq('user_id', user.id)
      .in('lesson_id', videoIds)
    for (const p of progress ?? []) {
      if (p.completed) completedVideoIds.add(p.lesson_id)
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Módulo {mod.order}</p>
        <h1 className="text-2xl font-bold text-zinc-100">{mod.title}</h1>
        {mod.description && <p className="text-zinc-400 mt-2">{mod.description}</p>}
      </div>

      {/* Videos */}
      {videos.length > 0 && (
        <div className="mb-8 space-y-4">
          {videos.map((lesson: any) => (
            <div key={lesson.id}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-zinc-400">{lesson.title}</p>
                <VideoMark
                  lessonId={lesson.id}
                  userId={user.id}
                  initialCompleted={completedVideoIds.has(lesson.id)}
                />
              </div>
              <VideoPlayer shareId={lesson.fathom_share_id} />
            </div>
          ))}
        </div>
      )}

      {/* Documentos */}
      {documents.length > 0 && (
        <div className="card mb-6">
          <p className="text-sm font-medium text-zinc-300 mb-4">📎 Materiales descargables</p>
          <div className="space-y-2">
            {documents.map((lesson: any) => (
              <DownloadButton key={lesson.id} lesson={lesson} />
            ))}
          </div>
        </div>
      )}

      {/* Navegación entre módulos */}
      {(prevModule || nextModule) && (
        <div className="flex items-center justify-between gap-4 mt-8 pt-6 border-t border-surface-700">
          {prevModule ? (
            <Link
              href={`/module/${prevModule.id}`}
              className="flex items-center gap-2 px-4 py-2.5 bg-surface-800 hover:bg-surface-700 rounded-lg text-sm text-zinc-300 hover:text-zinc-100 transition-colors group min-w-0"
            >
              <ChevronLeft size={16} className="shrink-0 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
              <span className="truncate">{prevModule.title}</span>
            </Link>
          ) : (
            <div />
          )}
          {nextModule && (
            <Link
              href={`/module/${nextModule.id}`}
              className="flex items-center gap-2 px-4 py-2.5 bg-surface-800 hover:bg-surface-700 rounded-lg text-sm text-zinc-300 hover:text-zinc-100 transition-colors group min-w-0"
            >
              <span className="truncate">{nextModule.title}</span>
              <ChevronRight size={16} className="shrink-0 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
            </Link>
          )}
        </div>
      )}

    </div>
  )
}

function DownloadButton({ lesson }: { lesson: any }) {
  return (
    <a
      href={`/api/download?path=${encodeURIComponent(lesson.storage_path)}`}
      className="flex items-center gap-3 px-4 py-3 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors group"
      target="_blank"
    >
      <FileDown size={16} className="text-zinc-400 group-hover:text-brand-400 transition-colors" />
      <span className="text-sm text-zinc-300 group-hover:text-zinc-100">{lesson.title}</span>
    </a>
  )
}
