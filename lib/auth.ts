import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Verificación compartida para API routes del panel admin.
// Permite 'admin' (incluye CS) y 'owner' (Diana) — coherente con is_admin() en la DB.
export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'owner') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}
