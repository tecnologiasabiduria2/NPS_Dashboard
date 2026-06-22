import { createClient } from '@/lib/supabase/server'
import { formatDateOnly } from '@/lib/format'
import { notFound } from 'next/navigation'
import EditAccessForm from './EditAccessForm'
import AddNoteForm from './AddNoteForm'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: profile }, { data: access }, { data: notes }] = await Promise.all([
    supabase.from('profiles').select('full_name, phone, created_at').eq('id', id).single(),
    supabase.from('user_access').select('*, products(title, slug), modules(title)').eq('user_id', id).single(),
    supabase.from('coaching_notes').select('*, profiles!admin_id(full_name)').eq('user_id', id).order('session_date', { ascending: false }),
  ])

  if (!profile) notFound()

  // Progreso por módulo
  const { data: modules } = await supabase
    .from('modules')
    .select('id, title, order, lessons(id, type)')
    .eq('product_id', access?.product_id ?? '')
    .eq('is_published', true)
    .order('order')

  const moduleProgress: Record<string, { completed: number; total: number }> = {}
  for (const mod of modules ?? []) {
    // El progreso cuenta solo entregables (checklist), no videos ni documentos
    const lessonIds = (mod.lessons as any[]).filter((l: any) => l.type === 'checklist_item').map((l: any) => l.id)
    if (lessonIds.length === 0) { moduleProgress[mod.id] = { completed: 0, total: 0 }; continue }
    const { count } = await supabase
      .from('lesson_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', id)
      .eq('completed', true)
      .in('lesson_id', lessonIds)
    moduleProgress[mod.id] = { completed: count ?? 0, total: lessonIds.length }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">{profile.full_name}</h1>
        <p className="text-zinc-500 text-sm mt-1">{(access as any)?.products?.title ?? '—'}</p>
      </div>

      {/* Control de acceso */}
      <div className="card mb-6">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Control de acceso</p>
        <EditAccessForm
          userId={id}
          currentDate={access?.access_until ?? ''}
          ghlContactId={access?.ghl_contact_id ?? ''}
          status={access?.status ?? 'pending'}
        />
      </div>

      {/* Progreso */}
      <div className="card mb-6">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Progreso por módulo</p>
        <div className="space-y-3">
          {(modules ?? []).map((mod: any) => {
            const prog = moduleProgress[mod.id] ?? { completed: 0, total: 0 }
            const pct = prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0
            return (
              <div key={mod.id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-zinc-300">{mod.title}</span>
                  <span className="text-zinc-500 text-xs">{prog.completed}/{prog.total}</span>
                </div>
                <div className="w-full bg-surface-800 rounded-full h-1.5">
                  <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Notas de coaching */}
      <div className="card">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Notas de coaching</p>
        <AddNoteForm userId={id} />
        {notes && notes.length > 0 ? (
          <div className="space-y-3">
            {notes.map((note: any) => (
              <div key={note.id} className="bg-surface-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-500">
                    {formatDateOnly(note.session_date)}
                  </span>
                  <span className="text-xs text-zinc-600">{note.profiles?.full_name}</span>
                </div>
                <p className="text-sm text-zinc-300">{note.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-600">Sin notas de coaching aún.</p>
        )}
      </div>
    </div>
  )
}
