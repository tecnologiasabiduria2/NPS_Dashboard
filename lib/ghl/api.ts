const GHL_BASE = 'https://rest.gohighlevel.com/v1'

export async function updateContactFields(
  contactId: string,
  fields: Record<string, string | number>
) {
  const res = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${process.env.GHL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ customField: fields }),
  })
  if (!res.ok) throw new Error(`GHL error: ${res.status}`)
  return res.json()
}
