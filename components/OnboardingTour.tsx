'use client'

import { useEffect, useState } from 'react'
import { Joyride, STATUS, type Step, type EventData } from 'react-joyride'
import { RESTART_TOUR_EVENT, TOUR_SEEN_STORAGE_KEY } from '@/lib/onboardingTour'

// Tour de bienvenida (2026-07-15, sugerencias post-portal): recorrido corto
// sobre las pestañas ya existentes de CommunityShell.tsx, marcadas con
// data-tour="tour-*". Solo corre en desktop (lg+): en mobile esas pestañas
// viven en un drawer oculto por defecto, no en el DOM visible.
//
// Nota de versión: react-joyride v2 depende de react-floater, que llama
// ReactDOM.unmountComponentAtNode — removido del bundle interno de React que
// usa Next 15, rompiendo la compilación entera del dev server (no solo el
// tour). La v3 (rewrite) usa @floating-ui/react-dom en su lugar, sin esa
// dependencia — API distinta (export nombrado `Joyride`, `onEvent` en vez de
// `callback`, colores/tamaños van en `options` en vez de `styles.options`).
const steps: Step[] = [
  {
    target: '[data-tour="tour-inicio"]',
    title: 'Inicio',
    content: 'Tu resumen del día: próximas sesiones, anuncios y accesos rápidos a lo más importante.',
    skipBeacon: true,
  },
  {
    target: '[data-tour="tour-mi-ruta"]',
    title: 'Mi ruta',
    content: 'La hoja de ruta de tu proceso: en qué hiperfoco estás este mes y qué sigue después.',
  },
  {
    target: '[data-tour="tour-eventos"]',
    title: 'Eventos',
    content: 'Tu calendario de inmersiones, mentorías y sesiones en vivo con acceso directo al link.',
  },
  {
    target: '[data-tour="tour-mi-progreso"]',
    title: 'Mi progreso',
    content: 'Tus conquistas: módulos cursados, racha semanal, insignias y evolución de tu NPS.',
  },
  {
    target: '[data-tour="tour-miembros"]',
    title: 'Miembros',
    content: 'La comunidad de tu producto: conoce a los demás miembros y contáctalos.',
  },
]

export default function OnboardingTour() {
  const [run, setRun] = useState(false)

  useEffect(() => {
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches
    const seen = localStorage.getItem(TOUR_SEEN_STORAGE_KEY)
    if (isDesktop && !seen) setRun(true)

    function onRestart() {
      setRun(true)
    }
    window.addEventListener(RESTART_TOUR_EVENT, onRestart)
    return () => window.removeEventListener(RESTART_TOUR_EVENT, onRestart)
  }, [])

  function handleEvent(data: EventData) {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      setRun(false)
      localStorage.setItem(TOUR_SEEN_STORAGE_KEY, '1')
    }
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      locale={{ back: 'Atrás', close: 'Cerrar', last: 'Listo', next: 'Siguiente', nextWithProgress: 'Siguiente ({current} de {total})', skip: 'Saltar' }}
      options={{
        arrowColor: '#292232', // surface-850
        backgroundColor: '#292232', // surface-850
        overlayColor: 'rgba(32,25,41,0.75)', // surface-950 translúcido
        primaryColor: '#DA7D41', // accent
        textColor: '#F2E8D5', // cream
        zIndex: 10000,
        buttons: ['back', 'close', 'skip', 'primary'],
      }}
      onEvent={handleEvent}
    />
  )
}
