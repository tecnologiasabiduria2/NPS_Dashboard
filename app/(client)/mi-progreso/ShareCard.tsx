'use client'

import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { Download, Loader2, Calendar, Layers, Video, Flame, GraduationCap, MessageSquare, CalendarCheck } from 'lucide-react'
import { isSabiduria } from '@/lib/productIdentity'

// Compartir progreso (2026-07-15, sugerencias post-portal): tarjeta oculta
// fuera de pantalla, capturada a PNG con html-to-image y descargada
// client-side. Cero requests al servidor, cero tabla nueva — reutiliza los
// mismos datos que ya calcula lib/conquistas.ts para "Mi progreso".
const ICONS: Record<string, typeof Flame> = {
  primer_modulo: GraduationCap,
  racha_4: Flame,
  diez_sesiones: Video,
  voz_escuchada: MessageSquare,
  meses_fiel: CalendarCheck,
}

export interface ShareInsignia {
  id: string
  label: string
  unlocked: boolean
}

interface Props {
  productoTitulo: string
  mesesActivo: number | null
  modulosVividos: number
  sesionesTotales: number
  rachaSemanas: number
  insignias: ShareInsignia[]
}

export default function ShareCard({ productoTitulo, mesesActivo, modulosVividos, sesionesTotales, rachaSemanas, insignias }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const unlocked = insignias.filter(i => i.unlocked)

  async function download() {
    if (!ref.current) return
    setLoading(true)
    try {
      const dataUrl = await toPng(ref.current, { pixelRatio: 2, cacheBust: true })
      const a = document.createElement('a')
      a.href = dataUrl
      // Nombre con fecha (2026-07-16, pedido de Juan): antes siempre se
      // descargaba como "mi-progreso.png", sin distinguir descargas de días
      // distintos.
      const today = new Date()
      const dd = String(today.getDate()).padStart(2, '0')
      const mm = String(today.getMonth() + 1).padStart(2, '0')
      a.download = `Mi progreso ${dd}-${mm}-${today.getFullYear()}.png`
      a.click()
    } catch {
      // silencioso: si falla la captura, el usuario sigue viendo sus datos en pantalla igual
    }
    setLoading(false)
  }

  const kpis = [
    { icon: Calendar, label: 'Meses activo', value: mesesActivo ?? '—' },
    { icon: Layers, label: 'Módulos cursados', value: modulosVividos },
    { icon: Video, label: 'Sesiones', value: sesionesTotales },
    { icon: Flame, label: 'Racha', value: `${rachaSemanas} sem.` },
  ]

  return (
    <>
      <button
        type="button"
        onClick={download}
        disabled={loading}
        className="btn-secondary flex items-center gap-2 text-xs disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        Descargar imagen
      </button>

      {/* Tarjeta fuera de pantalla, solo existe para la captura */}
      <div style={{ position: 'fixed', top: -99999, left: -99999, pointerEvents: 'none' }} aria-hidden="true">
        <div
          ref={ref}
          style={{
            width: 1080,
            height: 1350,
            padding: 80,
            background: 'linear-gradient(160deg, #3D160C 0%, #6B2818 55%, #7E301F 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          <div>
            {/* Logo real (2026-07-16, fix): solo representa a Sabiduría Empresarial
                — Desafío/Impulso no tienen logo propio subido, mismo criterio que
                ya usa CommunityShell.tsx (isSabiduria). Sin logo, no vacío: se
                omite entero en vez de mostrar el de otro producto. */}
            {isSabiduria(productoTitulo) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/logo-icon.png" alt="" width={64} height={64} />
            )}
            <p style={{ color: '#F2E8D5', fontSize: 26, marginTop: 28, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 2 }}>
              Mi progreso
            </p>
            <h1 style={{ color: '#F2E8D5', fontSize: 54, fontWeight: 700, marginTop: 8 }}>
              {productoTitulo}
            </h1>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {kpis.map(k => {
              const Icon = k.icon
              return (
                <div key={k.label} style={{ background: 'rgba(242,232,213,0.08)', borderRadius: 24, padding: 28 }}>
                  <Icon size={26} color="#DA7D41" />
                  <p style={{ color: '#F2E8D5', opacity: 0.7, fontSize: 20, marginTop: 12 }}>{k.label}</p>
                  <p style={{ color: '#F2E8D5', fontSize: 48, fontWeight: 700 }}>{k.value}</p>
                </div>
              )
            })}
          </div>

          {unlocked.length > 0 && (
            <div>
              <p style={{ color: '#F2E8D5', opacity: 0.7, fontSize: 22, marginBottom: 16 }}>Insignias desbloqueadas</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {unlocked.map(ins => {
                  const Icon = ICONS[ins.id] ?? Flame
                  return (
                    <div
                      key={ins.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: 'rgba(218,125,65,0.15)', border: '1px solid rgba(218,125,65,0.4)',
                        borderRadius: 999, padding: '10px 20px',
                      }}
                    >
                      <Icon size={22} color="#DA7D41" />
                      <span style={{ color: '#F2E8D5', fontSize: 20 }}>{ins.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
