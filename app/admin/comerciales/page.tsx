import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AlertTriangle, Users } from 'lucide-react'
import { listUsers, listContacts, ghlConfigured, type GhlUser, type GhlContact } from '@/lib/ghl/api'
import LinkCsForm from './LinkCsForm'

// ============================================================================
// PANEL DE COMERCIALES — owner (Diana). Bloque 4.
// Lista los usuarios de GHL (comerciales = CS: Mateo/David/Carolina), cuántos
// empresarios tiene asignado cada uno (desde GHL) y permite VINCULAR cada usuario
// de GHL con un profile local (CS). GHL es la fuente de verdad; los perfiles son
// mutables (cambia el nombre, no el ID) → guardamos el ghl_user_id en el profile.
//
// Degrada con elegancia: si GHL no está conectado (falta GHL_LOCATION_ID o la API
// key no tiene permisos — ver A4), muestra el motivo y no rompe la página.
// ============================================================================

export default async function ComercialesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'owner') redirect('/admin/dashboard')

  // Profiles locales que pueden ser CS (admin/owner) + su mapeo actual a GHL.
  const { data: profilesRaw } = await supabase
    .from('profiles')
    .select('id, full_name, role, ghl_user_id')
    .in('role', ['admin', 'owner'])
    .order('full_name', { ascending: true })
  const localProfiles = (profilesRaw ?? []) as { id: string; full_name: string; role: string; ghl_user_id: string | null }[]
  const profileByGhlUser = new Map<string, { id: string; full_name: string }>()
  for (const p of localProfiles) {
    if (p.ghl_user_id) profileByGhlUser.set(p.ghl_user_id, { id: p.id, full_name: p.full_name })
  }

  // Datos de GHL (graceful).
  let ghlUsers: GhlUser[] = []
  let ghlContacts: GhlContact[] = []
  let ghlError: string | null = null
  if (!ghlConfigured()) {
    ghlError = 'GHL no está conectado: falta GHL_LOCATION_ID (y/o GHL_API_KEY) en el entorno. ' +
      'El Location ID está en GHL → Settings → Business Profile. Mientras tanto no se pueden ' +
      'listar comerciales ni sus empresarios asignados.'
  } else {
    try {
      ;[ghlUsers, ghlContacts] = await Promise.all([listUsers(), listContacts(100)])
    } catch (e) {
      ghlError = e instanceof Error ? e.message : 'Error consultando GHL.'
    }
  }

  // Empresarios asignados por usuario de GHL (desde los contactos traídos).
  const assignedCount = new Map<string, number>()
  for (const c of ghlContacts) {
    if (c.assignedTo) assignedCount.set(c.assignedTo, (assignedCount.get(c.assignedTo) ?? 0) + 1)
  }

  return (
    <div className="max-w-4xl">
      <h1 className="page-title">Business Coach</h1>
      <p className="page-subtitle mb-6">
        Business Coach de GHL (servicio al cliente) y sus empresarios asignados · vincula cada uno con su perfil en la plataforma
      </p>

      {ghlError && (
        <div className="card mb-4" style={{ borderColor: 'rgba(186,117,23,0.3)' }}>
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-400">GHL no conectado</p>
              <p className="text-xs text-cream-muted mt-1 leading-relaxed">{ghlError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Vínculos actuales (sirve aunque GHL no responda) */}
      <div className="card mb-4">
        <p className="text-sm font-medium text-cream mb-1">Vínculos actuales</p>
        <p className="text-xs text-cream-muted mb-3">Perfiles de la plataforma ya mapeados a un usuario de GHL</p>
        {localProfiles.filter(p => p.ghl_user_id).length === 0 ? (
          <p className="text-sm text-cream-muted">Ningún perfil está vinculado a un usuario de GHL todavía.</p>
        ) : (
          <div className="space-y-1.5 text-sm">
            {localProfiles.filter(p => p.ghl_user_id).map(p => (
              <div key={p.id} className="flex justify-between">
                <span className="text-cream">{p.full_name}{p.role === 'owner' ? ' (owner)' : ''}</span>
                <span className="text-xs text-cream-muted font-mono">GHL: {p.ghl_user_id}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabla de usuarios de GHL + mapeo */}
      {!ghlError && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Users size={15} className="text-brand-400" />
            <p className="text-sm font-medium text-cream">Business Coach (usuarios de GHL)</p>
            <span className="text-xs text-cream-dim">{ghlUsers.length}</span>
          </div>
          {ghlUsers.length === 0 ? (
            <p className="text-sm text-cream-muted">GHL no devolvió usuarios para esta sub-cuenta.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[640px] space-y-1.5">
                <div className="grid grid-cols-[1fr_120px_1fr] gap-3 text-xs text-cream-muted pb-2 border-b border-surface-700">
                  <span>Usuario GHL</span>
                  <span>Empresarios</span>
                  <span>Vinculado a (CS de la plataforma)</span>
                </div>
                {ghlUsers.map(u => (
                  <div key={u.id} className="grid grid-cols-[1fr_120px_1fr] gap-3 items-center text-sm py-1">
                    <div className="min-w-0">
                      <p className="text-cream truncate">{u.name}</p>
                      {u.email && <p className="text-xs text-cream-muted truncate">{u.email}</p>}
                    </div>
                    <span className="text-cream-muted">
                      {assignedCount.get(u.id) ?? 0} asignado{(assignedCount.get(u.id) ?? 0) !== 1 ? 's' : ''}
                    </span>
                    <LinkCsForm
                      ghlUserId={u.id}
                      profiles={localProfiles.map(p => ({ id: p.id, full_name: p.full_name, role: p.role }))}
                      currentProfileId={profileByGhlUser.get(u.id)?.id ?? ''}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-cream-dim mt-3">
            Empresarios asignados = contactos de GHL con ese Business Coach como responsable (muestra hasta 100 contactos · beta).
          </p>
        </div>
      )}
    </div>
  )
}
