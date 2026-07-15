// Monedas soportadas para la facturación del cliente (punto 9 Fase 2 — no todos
// los clientes son de Colombia). Se guarda el código ISO en user_metricas_mes.moneda
// y se formatea con Intl. Ampliable agregando entradas aquí.
export interface Moneda {
  code: string
  label: string
}

export const MONEDAS: Moneda[] = [
  { code: 'COP', label: 'Peso colombiano (COP)' },
  { code: 'USD', label: 'Dólar (USD)' },
  { code: 'MXN', label: 'Peso mexicano (MXN)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'PEN', label: 'Sol peruano (PEN)' },
  { code: 'CLP', label: 'Peso chileno (CLP)' },
  { code: 'ARS', label: 'Peso argentino (ARS)' },
  { code: 'BRL', label: 'Real brasileño (BRL)' },
]

export const MONEDA_CODES: string[] = MONEDAS.map(m => m.code)
export const MONEDA_DEFAULT = 'COP'

// Formatea un monto con su moneda (símbolo/agrupación según la divisa). Sin
// decimales (facturaciones suelen ser cifras redondas). Fallback defensivo si
// la divisa no es válida.
export function formatMoneda(n: number | string, moneda?: string | null): string {
  const code = moneda && MONEDA_CODES.includes(moneda) ? moneda : MONEDA_DEFAULT
  try {
    return new Intl.NumberFormat('es', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(Number(n))
  } catch {
    return '$' + Math.round(Number(n)).toLocaleString('es-CO')
  }
}
