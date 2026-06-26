const GHL_BASE = 'https://services.leadconnectorhq.com'

const ghlHeaders = {
  Authorization: `Bearer ${process.env.GHL_API_KEY}`,
  'Content-Type': 'application/json',
  Version: '2021-07-28',
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
  if (!res.ok) throw new Error(`GHL error: ${res.status}`)
  return res.json()
}

export async function getContact(contactId: string) {
  const res = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
    headers: ghlHeaders,
  })
  if (!res.ok) throw new Error(`GHL error: ${res.status}`)
  return res.json()
}
