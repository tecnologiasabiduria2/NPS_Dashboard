'use client'

export type ToastKind = 'success' | 'error'
export interface ToastPayload {
  kind: ToastKind
  message: string
}

export const TOAST_EVENT = 'app-toast'

// Notificación desacoplada del árbol de React: cualquier componente cliente
// puede llamar toast.success(...)/toast.error(...) sin necesitar un Context
// Provider — un solo <ToastContainer/> montado en el layout raíz escucha el
// evento y muestra la notificación. Evita el bug de LessonForm/SessionForm
// donde el mensaje de éxito vivía en un estado local fácil de perder o de
// no notar dentro de un formulario largo.
function emit(message: string, kind: ToastKind) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: { kind, message } }))
}

export const toast = Object.assign(
  (message: string) => emit(message, 'success'),
  {
    success: (message: string) => emit(message, 'success'),
    error: (message: string) => emit(message, 'error'),
  }
)
