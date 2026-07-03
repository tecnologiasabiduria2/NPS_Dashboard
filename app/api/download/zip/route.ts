import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ZipArchive } from 'archiver'

// Descarga masiva: "todos los documentos" de un hiperfoco en un solo .zip
// (pedido de Diana, reunión 2026-07-03 — no incluye videos, solo material
// descargable tipo PDF/Word/etc). Misma validación de acceso que /api/download,
// archivo por archivo — nunca confiar en que el cliente solo pidió lo que puede ver.
const TRANSVERSAL_TIPOS = ['sala_gerencia', 'entrenamiento_comercial']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const paths: string[] = Array.isArray(body?.paths)
    ? body.paths.filter((p: unknown): p is string => typeof p === 'string')
    : []
  if (paths.length === 0) return NextResponse.json({ error: 'Sin archivos' }, { status: 400 })

  const allowed: { path: string; title: string }[] = []
  for (const path of paths) {
    const { data: rec } = await supabaseAdmin
      .from('recordings')
      .select('title, tipo, hiperfoco_id, is_published, hiperfocos(product_id)')
      .eq('storage_path', path)
      .eq('is_published', true)
      .single()

    const hf = (rec as any)?.hiperfocos
    if (!rec || !hf) continue

    const { data: access } = await supabaseAdmin
      .from('user_access')
      .select('product_id')
      .eq('user_id', user.id)
      .eq('product_id', hf.product_id)
      .eq('status', 'active')
      .maybeSingle()
    if (!access) continue

    if (!TRANSVERSAL_TIPOS.includes((rec as any).tipo)) {
      const { data: uhm } = await supabaseAdmin
        .from('user_hiperfoco_mes')
        .select('id')
        .eq('user_id', user.id)
        .eq('hiperfoco_id', (rec as any).hiperfoco_id)
        .maybeSingle()
      if (!uhm) continue
    }

    allowed.push({ path, title: (rec as any).title as string })
  }

  if (allowed.length === 0) return NextResponse.json({ error: 'Sin archivos accesibles' }, { status: 403 })

  const archive = new ZipArchive({ zlib: { level: 9 } })
  const chunks: Buffer[] = []
  archive.on('data', (chunk: Buffer) => chunks.push(chunk))
  archive.on('warning', () => {})

  const usedNames = new Set<string>()
  for (const item of allowed) {
    const { data: fileData, error } = await supabaseAdmin.storage.from('content').download(item.path)
    if (error || !fileData) continue
    const buf = Buffer.from(await fileData.arrayBuffer())
    const ext = item.path.split('.').pop() || 'pdf'
    const safeTitle = item.title.replace(/[\\/:*?"<>|]/g, '').trim() || 'documento'
    let name = `${safeTitle}.${ext}`
    let i = 2
    while (usedNames.has(name)) { name = `${safeTitle}-${i}.${ext}`; i++ }
    usedNames.add(name)
    archive.append(buf, { name })
  }

  await archive.finalize()
  const zipBuffer = Buffer.concat(chunks)

  return new NextResponse(zipBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="materiales.zip"',
    },
  })
}
