const GHL_BASE = 'https://services.leadconnectorhq.com'

const ghlHeaders = {
  Authorization: `Bearer ${process.env.GHL_API_KEY}`,
  'Content-Type': 'application/json',
  Version: '2021-07-28',
  Accept: 'application/json',
}

// ¿Hay credenciales mínimas de GHL? (key + locationId). Las funciones que listan
// usuarios/contactos requieren locationId; las de un contacto puntual solo la key.
export function ghlConfigured(): boolean {
  return Boolean(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID)
}

function requireLocationId(): string {
  const id = process.env.GHL_LOCATION_ID
  if (!id) {
    throw new Error(
      'GHL_LOCATION_ID no está configurado. Es el ID de la sub-cuenta de Sabiduría en GHL ' +
      '(Settings → Business Profile). Agrégalo en .env.local y en el .env del servidor.'
    )
  }
  return id
}

// Convierte { key: value } → formato v2: [{ key, field_value }]
function toCustomFields(fields: Record<string, string | number>) {
  return Object.entries(fields).map(([key, value]) => ({ key, field_value: String(value) }))
}

export async function updateContactFields(
  contactId: string,
  fields: Record<string, string | number>
) {
  const res = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
    method: 'PUT',
    headers: ghlHeaders,
    body: JSON.stringify({ customFields: toCustomFields(fields) }),
  })
  if (!res.ok) throw new Error(`GHL error: ${res.status} ${await res.text().catch(() => '')}`)
  return res.json()
}

export async function getContact(contactId: string) {
  const res = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
    headers: ghlHeaders,
  })
  if (!res.ok) throw new Error(`GHL error: ${res.status}`)
  return res.json()
}

// ----------------------------------------------------------------------------
// Bloque 4 — usuarios (comerciales/CS) y contactos (empresarios) de GHL.
// GHL es la fuente de verdad: la plataforma LEE estos datos, no los modifica acá.
// ----------------------------------------------------------------------------

export interface GhlUser {
  id: string
  name: string
  email?: string
  role?: string
}

export interface GhlContact {
  id: string
  name?: string
  email?: string
  assignedTo?: string | null   // id del usuario GHL responsable del contacto
}

// Lista los usuarios de la sub-cuenta (comerciales = CS: Mateo/David/Carolina/...).
// GET /users/?locationId={id}
export async function listUsers(): Promise<GhlUser[]> {
  const locationId = requireLocationId()
  const res = await fetch(`${GHL_BASE}/users/?locationId=${encodeURIComponent(locationId)}`, {
    headers: ghlHeaders,
  })
  if (!res.ok) throw new Error(`GHL listUsers error: ${res.status} ${await res.text().catch(() => '')}`)
  const data = await res.json()
  const arr = (data?.users ?? []) as any[]
  return arr.map((u) => ({
    id: String(u.id),
    name: [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.name || u.email || '—',
    email: u.email,
    role: u.roles?.role ?? u.role,
  }))
}

// Lista contactos (empresarios) de la sub-cuenta. Una página (beta).
// GET /contacts/?locationId={id}&limit={limit}
export async function listContacts(limit = 100): Promise<GhlContact[]> {
  const locationId = requireLocationId()
  const url = `${GHL_BASE}/contacts/?locationId=${encodeURIComponent(locationId)}&limit=${limit}`
  const res = await fetch(url, { headers: ghlHeaders })
  if (!res.ok) throw new Error(`GHL listContacts error: ${res.status} ${await res.text().catch(() => '')}`)
  const data = await res.json()
  const arr = (data?.contacts ?? []) as any[]
  return arr.map((c) => ({
    id: String(c.id),
    name: c.contactName || [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || c.email || '—',
    email: c.email,
    assignedTo: c.assignedTo ?? null,
  }))
}
