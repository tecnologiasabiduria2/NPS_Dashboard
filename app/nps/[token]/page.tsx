import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_NPS_COPY, type NpsCopy } from '@/lib/nps'
import { sessionTipoLabel } from '@/lib/sessionTypes'
import NpsLinkForm from '@/components/community/NpsLinkForm'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

export default async function NpsLinkPage({ params }: Props) {
  const { token } = await params

  // Sesión por token (service role → sin RLS, página pública sin login).
  const { data: session } = await supabaseAdmin
    .from('live_sessions')
    .select('id, title, tipo')
    .eq('nps_token', token)
    .maybeSingle()

  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-surface-950">
        <div className="w-full max-w-md card text-center py-10">
          <p className="text-cream font-medium">Link no válido</p>
          <p className="text-cream-muted text-sm mt-1">
            Este enlace de calificación no existe o ya no está disponible.
          </p>
        </div>
      </main>
    )
  }

  // Textos del overlay (configurables en /admin/nps/questions) con fallback.
  const { data: q } = await supabaseAdmin
    .from('nps_questions')
    .select('eyebrow, title, question')
    .eq('trigger', 'post_sesion')
    .maybeSingle()

  const def = DEFAULT_NPS_COPY.post_sesion
  const copy: NpsCopy = {
    eyebrow: q?.eyebrow ?? def.eyebrow,
    title: q?.title ?? def.title,
    question: q?.question ?? def.question,
  }

  const sessionTitle = session.title || sessionTipoLabel(session.tipo) || 'tu sesión'

  // Auto-atribución: si quien abre el link es un CLIENTE logueado, califica como
  // él (sin pedir correo, deriva su hiperfoco vía /api/nps). Admin/owner y
  // visitantes sin sesión usan el flujo anónimo con correo opcional.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let loggedInName: string | null = null
  if (user) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()
    if (prof?.role === 'client') loggedInName = prof.full_name || user.email || 'tu cuenta'
  }

  return (
    <NpsLinkForm
      token={token}
      sessionId={session.id}
      sessionTitle={sessionTitle}
      copy={copy}
      loggedInName={loggedInName}
    />
  )
}
