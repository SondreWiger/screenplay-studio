import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
          950: 'rgb(var(--brand-950) / <alpha-value>)',
        },
        surface: {
          50:  '#f4f4fc',
          100: '#eaeaf5',
          200: '#d4d4e8',
          300: '#b0b0cc',
          400: '#8888aa',
          500: '#5c5c7a',
          600: '#3a3a56',
          700: '#24243a',
          800: '#181828',
          900: '#0f0f1c',
          950: '#070710',
        },
      },
      fontFamily: {
        screenplay: ['Courier Prime', 'Courier New', 'Courier', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-left': 'slideLeft 0.3s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
        'pulse-subtle': 'pulseSubtle 2s infinite',
        'glow-pulse': 'glowPulse 2.5s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'gradient-x': 'gradientX 4s ease infinite',
        'spin-slow': 'spin 8s linear infinite',
        'scale-in': 'scaleIn 0.2s ease-out',
        'shimmer': 'shimmerX 1.6s infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideDown: { '0%': { transform: 'translateY(-10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideLeft: { '0%': { transform: 'translateX(10px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        slideRight: { '0%': { transform: 'translateX(-10px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        pulseSubtle: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.7' } },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 16px rgb(var(--brand-500) / 0.15)' },
          '50%': { boxShadow: '0 0 40px rgb(var(--brand-500) / 0.4), 0 0 80px rgb(var(--brand-500) / 0.15)' },
        },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-5px)' } },
        gradientX: { '0%, 100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        scaleIn: { '0%': { transform: 'scale(0.92)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        shimmerX: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
};

export default config;
