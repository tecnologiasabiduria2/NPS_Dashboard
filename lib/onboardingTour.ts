'use client'

// Reinicio del tour desacoplado del árbol de React (2026-07-15), mismo patrón
// que lib/toast.ts: el botón "¿Cómo funciona esto?" puede vivir en cualquier
// componente (ej. el menú de usuario de CommunityShell) sin necesitar prop
// drilling hasta OnboardingTour.
export const RESTART_TOUR_EVENT = 'app-restart-tour'
export const TOUR_SEEN_STORAGE_KEY = 'ventra_onboarding_tour_seen_v1'

export function restartTour() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(RESTART_TOUR_EVENT))
}
