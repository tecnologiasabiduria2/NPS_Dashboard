import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

  const { data, error } = await supabaseAdmin.storage
    .from('content')
    .createSignedUrl(path, 60)

  if (error || !data) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  return NextResponse.redirect(data.signedUrl)
}
