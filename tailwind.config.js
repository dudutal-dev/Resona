/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Heebo"', '"Assistant"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Heebo"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        void: {
          950: '#05030e',
          900: '#0a0618',
          850: '#0f0a22',
          800: '#150e2e',
          700: '#1e1440',
        },
        aura: {
          50: '#f2f0ff',
          100: '#e4e0ff',
          200: '#cbc2ff',
          300: '#ab9bff',
          400: '#8b6dff',
          500: '#7043ff',
          600: '#5f21f7',
          700: '#5014dc',
          800: '#4213b1',
          900: '#37138c',
        },
        cyan: {
          glow: '#4de8ff',
        },
        rose: {
          glow: '#ff6ec7',
        },
        gold: {
          glow: '#ffd166',
        },
      },
      boxShadow: {
        glow: '0 0 24px -4px rgba(139,109,255,0.55)',
        'glow-lg': '0 0 60px -8px rgba(139,109,255,0.55)',
        'glow-cyan': '0 0 40px -6px rgba(77,232,255,0.5)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255,255,255,0.08)',
      },
      backdropBlur: { xs: '2px' },
      /**
       * Sharpened geometry.
       *
       * Every panel in the app was a 16-24px blob, which is the default shape of
       * a wellness card and reads as soft and conservative no matter what colour
       * is inside it. The orb these panels sit around is drawn from precise
       * concentric rings; the surfaces holding it should agree. Overriding the
       * scale here rather than editing 85 call sites also keeps the corner
       * language in one place, so it can be tuned as one decision.
       *
       * `full` is untouched — the play control and the orb are genuinely round.
       */
      borderRadius: {
        lg: '5px',
        xl: '6px',
        '2xl': '8px',
        '3xl': '12px',
      },
      keyframes: {
        'aurora-drift': {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '33%': { transform: 'translate3d(6%,-8%,0) scale(1.12)' },
          '66%': { transform: 'translate3d(-7%,5%,0) scale(0.94)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.85)', opacity: '0.7' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        breathe: {
          '0%,100%': { transform: 'scale(1)', opacity: '0.85' },
          '50%': { transform: 'scale(1.05)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        twinkle: {
          '0%,100%': { opacity: '0.15' },
          '50%': { opacity: '0.75' },
        },
      },
      animation: {
        'aurora-drift': 'aurora-drift 26s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 3.6s cubic-bezier(0.2,0.6,0.3,1) infinite',
        breathe: 'breathe 7s ease-in-out infinite',
        shimmer: 'shimmer 6s linear infinite',
        'fade-up': 'fade-up 0.45s cubic-bezier(0.16,1,0.3,1) both',
        'scale-in': 'scale-in 0.28s cubic-bezier(0.16,1,0.3,1) both',
        twinkle: 'twinkle 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
