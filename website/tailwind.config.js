/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{html,js}',
    './src/partials/**/*.html',
    './src/pages/**/*.html',
    './scripts/**/*.js'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: {
          50: 'var(--color-accent-50)',
          100: 'var(--color-accent-100)',
          200: 'var(--color-accent-200)',
          300: 'var(--color-accent-300)',
          400: 'var(--color-accent-400)',
          500: 'var(--color-accent-500)',
          600: 'var(--color-accent-600)',
          700: 'var(--color-accent-700)',
          800: 'var(--color-accent-800)',
          900: 'var(--color-accent-900)',
          950: 'var(--color-accent-950)',
          primary: 'var(--color-accent-primary)',
          hover: 'var(--color-accent-hover)',
          subtle: 'var(--color-accent-subtle)',
          border: 'var(--color-accent-border)'
        },
        surface: {
          base: 'var(--color-bg-base)',
          DEFAULT: 'var(--color-bg-surface)',
          elevated: 'var(--color-bg-surface-elevated)',
          glass: 'var(--color-bg-surface-glass)',
          code: 'var(--color-bg-code)'
        },
        border: {
          subtle: 'var(--color-border-subtle)',
          strong: 'var(--color-border-strong)'
        },
        txt: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          inverse: 'var(--color-text-inverse)'
        }
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        bangla: ['var(--font-bangla)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace']
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        elevated: 'var(--shadow-elevated)',
        glow: 'var(--shadow-glow)'
      }
    }
  },
  plugins: []
};
