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
        surface: {
          950: '#0f0e18',
          900: '#161520',
          850: '#1e1e28',
          800: '#252335',
          700: '#302e42',
          600: '#3e3b52',
          500: '#4e4a64',
        },
      },
      fontFamily: {
        sans: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
