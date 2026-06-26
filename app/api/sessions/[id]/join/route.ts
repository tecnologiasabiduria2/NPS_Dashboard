import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

interface Props {
  params: Promise<{ id: string }>
}

// Ventana de asistencia válida (margen alrededor del horario de la sesión).
// Fáciles de ajustar: muy probablemente Sebastián/Diana querrán afinarlos.
const ATTENDANCE_MARGIN_BEFORE_MIN = 10 // se puede registrar desde 10 min antes de empezar
const ATTENDANCE_MARGIN_AFTER_MIN = 0   // solo hasta que termine la sesión (ends_at exacto)

// GET /api/sessions/[id]/join
// SIEMPRE redirige al Zoom de la sesión (no se bloquea el acceso a la sala).
// La asistencia SOLO se registra si el clic cae dentro de la ventana válida,
// para que el dato de asistencia sea honesto (no cuenta clics un día antes o
// mucho después de que terminó).
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
    .select('id, zoom_url, starts_at, ends_at')
    .eq('id', id)
    .single()

  if (!session) {
    return NextResponse.redirect(new URL('/dashboard?error=session_not_found', req.url))
  }

  // 2. ¿El clic cae dentro de la ventana de asistencia?
  const now = Date.now()
  const windowStart = new Date(session.starts_at).getTime() - ATTENDANCE_MARGIN_BEFORE_MIN * 60_000
  const windowEnd = new Date(session.ends_at).getTime() + ATTENDANCE_MARGIN_AFTER_MIN * 60_000
  const withinWindow = now >= windowStart && now <= windowEnd

  // 3. Registrar asistencia SOLO dentro de la ventana (idempotente, ON CONFLICT DO NOTHING).
  //    Fuera de la ventana NO se registra, pero igual se redirige a Zoom (sin fricción).
  if (withinWindow) {
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
  }

  // 4. Redirección nativa a Zoom (siempre, dentro o fuera de la ventana).
  return Response.redirect(session.zoom_url, 302)
}
