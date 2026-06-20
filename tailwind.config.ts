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
        brand: {
          50:  '#fdf2f2',
          100: '#fce4e4',
          200: '#f9c0c0',
          300: '#f28f8f',
          400: '#e85a5a',
          500: '#C4503F',
          600: '#9B2C2C',
          700: '#7A1F1F',
          800: '#5C1515',
          900: '#3D0D0D',
          950: '#220808',
        },
        cream: {
          DEFAULT: '#F2E8D5',
          dim:     '#C0AA90',
          muted:   '#7A6A60',
        },
        surface: {
          950: '#0A0608',
          900: '#120D10',
          850: '#1A1215',
          800: '#221820',
          700: '#2E2028',
          600: '#3A2A32',
          500: '#4A3840',
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
