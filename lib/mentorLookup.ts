import { supabaseAdmin } from '@/lib/supabase/admin'

// El mentor que dicta un hiperfoco en un mes ES quien hace las 1:1 de los
// clientes en ese hiperfoco ese mes (calibración 2026-07-07, corrige el
// modelo anterior que trataba mentor-de-hiperfoco y cs_id como conceptos
// distintos). Si todavía no hay mentor asignado para ese hiperfoco+mes, cae
// al admin que está haciendo la acción (comportamiento previo, sin romper).
export async function resolveCsIdForHiperfoco(
  hiperfocoId: string | null,
  periodo: string,
  fallbackAdminId: string
): Promise<string> {
  if (!hiperfocoId) return fallbackAdminId
  const { data } = await supabaseAdmin
    .from('hiperfoco_mentor_mes')
    .select('mentor_id')
    .eq('hiperfoco_id', hiperfocoId)
    .eq('periodo', periodo)
    .maybeSingle()
  return (data as { mentor_id?: string } | null)?.mentor_id ?? fallbackAdminId
}
