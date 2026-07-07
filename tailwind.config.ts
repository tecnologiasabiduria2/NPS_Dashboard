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
        // Base oscura recalibrada al Charcoal Brown del brandbook (2026-07-07) —
        // antes era un morado-azulado genérico de dashboard SaaS, sin respaldo
        // en el brandbook. surface-850 = #261C21 exacto (Charcoal Brown); el
        // resto de la escala interpola en la misma familia cálida.
        surface: {
          950: '#14100f',
          900: '#1c1613',
          850: '#261c21',
          800: '#2f2621',
          700: '#3a2f28',
          600: '#493c32',
          500: '#5b4b3f',
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
