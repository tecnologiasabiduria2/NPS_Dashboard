import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

interface Props {
  params: Promise<{ id: string }>
}

// GET /api/sessions/[id]/join
// Registra la asistencia (idempotente) y SIEMPRE redirige al Zoom de la sesión.
export async function GET(req: NextRequest, { params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // 1. Obtener la sesión (service role: 404 sólo si realmente no existe).
  const { data: session } = await supabaseAdmin
    .from('live_sessions')
    .select('id, zoom_url')
    .eq('id', id)
    .single()

  if (!session) {
    return NextResponse.redirect(new URL('/dashboard?error=session_not_found', req.url))
  }

  // 2. Registrar asistencia con ON CONFLICT (user_id, session_id) DO NOTHING.
  //    Se usa el cliente del usuario para que auth.uid() y la RLS apliquen.
  //    Cualquier fallo (duplicado o de permisos) se ignora: la redirección manda.
  try {
    await supabase
      .from('live_session_attendance')
      .upsert(
        { user_id: user.id, session_id: session.id },
        { onConflict: 'user_id,session_id', ignoreDuplicates: true }
      )
  } catch {
    // no-op: igual redirigimos a Zoom
  }

  // 3. Redirección nativa a Zoom (siempre, aunque el insert haya fallado/existido).
  return Response.redirect(session.zoom_url, 302)
}
