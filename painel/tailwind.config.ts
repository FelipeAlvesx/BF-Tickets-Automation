import type { Config } from 'tailwindcss'

// Cores = tokens em index.css (HSL sem o hsl()), trocados em runtime pela marca da clínica
// (src/lib/brand.ts). Um conjunto só para claro e escuro.
const hsl = (name: string) => `hsl(var(--${name}) / <alpha-value>)`

export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: hsl('background'),
        surface: { DEFAULT: hsl('surface'), 2: hsl('surface-2'), 3: hsl('surface-3') },
        foreground: hsl('foreground'),
        muted: hsl('muted'),
        faint: hsl('faint'),
        border: hsl('border'),
        ring: hsl('ring'),
        brand: { DEFAULT: hsl('brand'), foreground: hsl('brand-foreground'), soft: hsl('brand-soft'), ink: hsl('brand-ink') },
        brand2: hsl('brand-2'),
        amber: hsl('amber'),
        blue: hsl('blue'),
        green: hsl('green'),
        red: hsl('red'),
        violet: hsl('violet'),
        slate: hsl('slate'),
        chart: { 1: hsl('chart-1'), 2: hsl('chart-2'), 3: hsl('chart-3'), 4: hsl('chart-4'), 5: hsl('chart-5') },
      },
      fontFamily: {
        sans: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      fontSize: {
        // Nada que carregue informação abaixo de 0,95rem; o 'micro' é só para rótulo de seção.
        micro: ['0.78rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
        sm: ['0.95rem', { lineHeight: '1.4rem' }],
        base: ['1rem', { lineHeight: '1.55rem' }],
      },
      borderRadius: { xl: '14px', '2xl': '18px', '3xl': '24px' },
      boxShadow: {
        hair: '0 0 0 1px hsl(var(--border))',
        lift: '0 1px 2px hsl(var(--shadow) / 0.05), 0 12px 32px -16px hsl(var(--shadow) / 0.22)',
        float: '0 2px 6px hsl(var(--shadow) / 0.06), 0 24px 60px -20px hsl(var(--shadow) / 0.35)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
        drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        breathe: { '0%,100%': { transform: 'scale(1)', opacity: '0.9' }, '50%': { transform: 'scale(1.06)', opacity: '1' } },
        ring: { '0%': { transform: 'scale(0.9)', opacity: '0.55' }, '100%': { transform: 'scale(1.9)', opacity: '0' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        drift: { '0%,100%': { transform: 'translate3d(0,0,0) rotate(0deg)' }, '50%': { transform: 'translate3d(2%,-3%,0) rotate(8deg)' } },
        beam: { '100%': { 'offset-distance': '100%' } },
      },
      animation: {
        breathe: 'breathe 4.2s cubic-bezier(0.77, 0, 0.175, 1) infinite',
        ring: 'ring 1.8s cubic-bezier(0.23, 1, 0.32, 1) infinite',
        shimmer: 'shimmer 1.4s linear infinite',
        drift: 'drift 18s cubic-bezier(0.77, 0, 0.175, 1) infinite',
        beam: 'beam 6s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
