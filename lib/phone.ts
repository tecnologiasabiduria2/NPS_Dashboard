// Teléfono + WhatsApp — reunión 2026-07-07, sugerencia de Garzón: usar
// api.whatsapp.com/send (no wa.me) para el link, y exigir el indicativo de
// país ("+") cuando se llena el teléfono, para que el link resuelva bien sin
// tener que adivinar el país.

// Si el teléfono se llena, DEBE llevar "+" al inicio (obligatorio, no solo
// recomendado). Vacío/undefined es válido (el campo es opcional).
export function isValidPhoneWithPrefix(phone: string | null | undefined): boolean {
  const trimmed = (phone ?? '').trim()
  if (!trimmed) return true
  return /^\+[1-9]\d{6,14}$/.test(trimmed)
}

// Link de WhatsApp (api.whatsapp.com/send, pedido explícito de Garzón, en vez
// de wa.me). Para números legacy guardados antes de exigir el "+" (decisión
// 2026-07-03), se mantiene el heurístico de Colombia como respaldo.
export function whatsappHref(phone: string): string {
  const trimmed = phone.trim()
  const hasCountryCode = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  const withCountry = !hasCountryCode && digits.length === 10 ? `57${digits}` : digits
  return `https://api.whatsapp.com/send?phone=${withCountry}`
}
