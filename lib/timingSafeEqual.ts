// Compara dos strings sin filtrar por timing cuanto coinciden (evita side-channel
// en comparaciones de secretos). Portable (no depende de node:crypto) para poder
// reusarse tanto en rutas de Next.js como en el Edge Function de Deno.
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
