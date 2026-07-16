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

// Bug reportado 2026-07-16: el tour arrancaba a la vez que el overlay de
// bienvenida (foto/bio), ambos con su propio fondo oscuro superpuestos —
// ilegible. El tour ahora espera este evento (disparado por cada overlay de
// ClientLayout al descartarse o guardar) antes de arrancar, si al montar ya
// había uno de esos overlays por mostrarse (ver `hasOverlay` en OnboardingTour).
export const OVERLAY_CLOSED_EVENT = 'app-onboarding-overlay-closed'

export function notifyOverlayClosed() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(OVERLAY_CLOSED_EVENT))
}
