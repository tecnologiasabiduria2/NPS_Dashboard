import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import VideoPlayer from '@/components/VideoPlayer'
import VideoMark from '@/components/VideoMark'
import ChecklistSection from '@/components/ChecklistSection'
import { FileDown } from 'lucide-react'

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

  const lessons = (mod.lessons as any[]).sort((a: any, b: any) => a.order - b.order)
  const videos = lessons.filter((l: any) => l.type === 'video' && l.fathom_share_id)
  const documents = lessons.filter((l: any) => l.type === 'document' && l.storage_path)
  const checklistItems = lessons.filter((l: any) => l.type === 'checklist_item')

  // Progreso actual del usuario
  const lessonIds = lessons.map((l: any) => l.id)
  const { data: progress } = await supabase
    .from('lesson_progress')
    .select('lesson_id, completed')
    .eq('user_id', user.id)
    .in('lesson_id', lessonIds)

  const completedIds = new Set(
    (progress ?? []).filter((p: any) => p.completed).map((p: any) => p.lesson_id)
  )

  const completedCount = checklistItems.filter((l: any) => completedIds.has(l.id)).length

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Módulo {mod.order}</p>
        <h1 className="text-2xl font-bold text-zinc-100">{mod.title}</h1>
        {mod.description && <p className="text-zinc-400 mt-2">{mod.description}</p>}
        {checklistItems.length > 0 && (
          <p className="text-xs text-zinc-500 mt-2">
            {completedCount}/{checklistItems.length} entregables completados
          </p>
        )}
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
                  initialCompleted={completedIds.has(lesson.id)}
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

      {/* Checklist */}
      {checklistItems.length > 0 && (
        <ChecklistSection
          items={checklistItems}
          completedIds={Array.from(completedIds)}
          userId={user.id}
        />
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
