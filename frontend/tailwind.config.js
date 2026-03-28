/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#1b1757',
        },
        sidebar: '#0d1117',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
      },
      boxShadow: {
        card:   '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        glow:   '0 0 20px rgba(99,102,241,0.35)',
        'glow-sm': '0 0 10px rgba(99,102,241,0.25)',
      },
      animation: {
        'fade-in-up':   'fadeInUp 0.4s ease forwards',
        'fade-in':      'fadeIn 0.3s ease forwards',
        'shimmer':      'shimmer 1.6s infinite',
        'pulse-dot':    'pulseDot 2s ease-in-out infinite',
        'pulse-glow':   'pulseGlow 2s ease-in-out infinite',
        'scale-in':     'scaleIn 0.25s ease forwards',
        'slide-in':     'slideIn 0.3s ease forwards',
        'count-up':     'countUp 0.6s ease forwards',
        'spin-slow':    'spin 2s linear infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(16,185,129,0.5)' },
          '50%':      { opacity: '0.85', transform: 'scale(1.15)', boxShadow: '0 0 0 6px rgba(16,185,129,0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(99,102,241,0)' },
          '50%':      { boxShadow: '0 0 16px 4px rgba(99,102,241,0.12)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
