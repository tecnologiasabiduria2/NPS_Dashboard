import {
  Landmark,
  Megaphone,
  Workflow,
  Handshake,
  Building2,
  Presentation,
  BookOpen,
  type LucideIcon,
} from 'lucide-react'

// Identidad visual por hiperfoco: ícono + color propio, para que un empresario
// reconozca el tema de un vistazo (sin depender de leer el texto). Reutilizable
// en cualquier panel que muestre hiperfocos (Aprendizaje, admin/360, admin/content).
// Coincidencia por texto (no por id) porque el nombre es la fuente de verdad
// compartida entre productos (ver decisión B9 — sesiones/hiperfoco "por nombre").
export interface HiperfocoVisual {
  icon: LucideIcon
  from: string
  to: string
  solid: string
}

const PALETTE: Record<string, HiperfocoVisual> = {
  ventas:     { icon: Handshake,    from: '#D98E72', to: '#7E301F', solid: '#C0654A' },
  procesos:   { icon: Workflow,     from: '#9A8C5E', to: '#615636', solid: '#7C7048' },
  finanzas:   { icon: Landmark,     from: '#D9A94E', to: '#8C6519', solid: '#B9862E' },
  // Vino intenso (2026-07-06): antes compartía casi el mismo tono que Finanzas
  // (ambos naranja-dorado, a 14° de diferencia de matiz) — difícil de distinguir
  // en barras finas. Se aleja a la familia rojo/vino, sigue cálido.
  marketing:  { icon: Megaphone,    from: '#C9748C', to: '#6E1F34', solid: '#A83250' },
  gerencia:   { icon: Building2,    from: '#A9855E', to: '#5E472E', solid: '#8C6A45' },
  comercial:  { icon: Presentation, from: '#B97A6C', to: '#6B342A', solid: '#9B5B4E' },
}

const DEFAULT: HiperfocoVisual = { icon: BookOpen, from: '#EAAD74', to: '#7E301F', solid: '#7E301F' }

export function getHiperfocoVisual(title: string | null | undefined): HiperfocoVisual {
  const t = (title ?? '').toLowerCase()
  if (t.includes('venta')) return PALETTE.ventas
  if (t.includes('proceso') || t.includes('equipo')) return PALETTE.procesos
  if (t.includes('finanza')) return PALETTE.finanzas
  if (t.includes('marketing')) return PALETTE.marketing
  if (t.includes('gerencia')) return PALETTE.gerencia
  if (t.includes('comercial') || t.includes('entrenamiento')) return PALETTE.comercial
  return DEFAULT
}
