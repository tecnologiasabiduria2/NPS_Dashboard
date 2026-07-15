// El logo real (/logo-icon.png, /logo-horizontal.png) SOLO representa a
// Sabiduría Empresarial de verdad — se conserva ahí. Para cualquier otro
// producto (Desafío, futuros) no hay logo propio subido, así que se usa el
// nombre completo / inicial en su lugar, en vez de mostrar el logo equivocado.
export function isSabiduria(title: string | null | undefined): boolean {
  const t = (title ?? '').toLowerCase()
  return t.includes('sabiduría') || t.includes('sabiduria')
}

// Nombre completo por producto — evita mostrar el logo de Sabiduría Empresarial
// en espacios que en realidad son de Desafío (no existe un logo propio de
// Desafío subido a la plataforma). Coincidencia por texto, igual que
// lib/hiperfocoVisual.ts — el título es la fuente de verdad compartida.
export function productFullName(title: string | null | undefined): string {
  const t = (title ?? '').toLowerCase()
  if (t.includes('sabiduría') || t.includes('sabiduria')) return 'Sabiduría Empresarial'
  if (t.includes('desafío') || t.includes('desafio')) return 'Desafío Empresa Autogerenciable'
  if (t.includes('impulso')) return 'Impulso Empresarial'
  return title || 'Comunidad'
}

// Inicial para el badge del riel de producto (círculo con una letra, en vez
// de un logo que no existe para todos los productos).
export function productInitial(title: string | null | undefined): string {
  return (title ?? '?').trim().charAt(0).toUpperCase() || '?'
}
