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

// Todos los hiperfocos usan la rampa naranja del BRANDBOOK (2026-07-14, pedido
// de Diana: "todos naranja", pero siguiendo la marca — no un naranja cualquiera).
// Fuente: tailwind.config.ts → Arena #EAAD74, Ámbar #DA7D41, Terracota #7E301F +
// rampa brand-300..600. Cada hiperfoco toma un escalón distinto de esa misma
// familia cálida (claro→oscuro), así se distinguen por color ADEMÁS del ícono,
// sin salirse de la paleta. from = tinte claro, to = sombra, solid = tono medio.
const PALETTE: Record<string, HiperfocoVisual> = {
  // Anclado en Ámbar #DA7D41 (el naranja real del brandbook) → Terracota #7E301F.
  // 2ª pasada (2026-07-14): la 1ª versión arrancaba en Arena #EAAD74, que se veía
  // amarillo pálido (sobre todo Finanzas). Ahora todos son naranjas saturados,
  // sin el arena claro; escalonados de naranja ámbar a terracota.
  finanzas:   { icon: Landmark,     from: '#EDA05A', to: '#C56C34', solid: '#DA7D41' },
  ventas:     { icon: Handshake,    from: '#E2914E', to: '#B85A30', solid: '#CE6E3C' },
  marketing:  { icon: Megaphone,    from: '#D67E3E', to: '#A54A24', solid: '#C0654A' },
  comercial:  { icon: Presentation, from: '#C56C34', to: '#8C3D22', solid: '#A94E2C' },
  procesos:   { icon: Workflow,     from: '#B85A3A', to: '#6B2818', solid: '#9B4030' },
  gerencia:   { icon: Building2,    from: '#A34B33', to: '#571F12', solid: '#7E301F' },
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
