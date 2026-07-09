import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brandbook Sabiduría Empresarial — Deep Terracotta (#7E301F = brand-600)
        brand: {
          50:  '#FBF1EC',
          100: '#F3DDD3',
          200: '#E8C0B0',
          300: '#D98E72',
          400: '#C0654A',
          500: '#9B4030',
          600: '#7E301F',
          700: '#6B2818',
          800: '#571F12',
          900: '#3D160C',
          950: '#2A0E07',
        },
        // Brandbook — Warm Amber
        accent: {
          DEFAULT: '#DA7D41',
          hover:   '#C56C34',
        },
        // Brandbook — Sand Beige
        sand: {
          DEFAULT: '#EAAD74',
        },
        cream: {
          DEFAULT: '#F2E8D5',
          dim:     '#C0AA90',
          muted:   '#7A6A60',
        },
        // Especificación exacta de Juan (2026-07-08, v2 — "monocromático
        // puro"): TODO parte del mismo #261c21 (Charcoal Brown oficial), sin
        // ningún otro matiz café/terroso/gris. Los pasos "más claros" son el
        // mismo #261c21 con una capa blanca encima a baja opacidad (2/4/6/8/
        // 12/18%), nunca un hex de otra familia — así nada dentro de la
        // interfaz se ve "de otro color", solo más o menos iluminado.
        // Base actualizada 2026-07-09 (feedback de Sebastián, llamada 9 jul): el
        // café original (#261c21, hue 330°) se corrió a azul-violeta (#201929,
        // hue ~265°) — misma fórmula de siempre (capa blanca 2/4/6/8/12/18%
        // sobre el base), solo cambia el único valor de partida. Comparado
        // visualmente contra los colores de marca reales antes de aplicar
        // (candidato "Moderado" de 4, elegido por Juan).
        surface: {
          950: '#201929', // base pura, 0% — fondo de página
          900: '#241e2d', // ~2%
          850: '#292232', // ~4% — tarjetas
          800: '#2d2736', // ~6% — inputs/botones/hover
          700: '#322b3a', // ~8% — bordes/divisores (casi imperceptible)
          600: '#3b3543', // ~12%
          500: '#484250', // ~18%
        },
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
