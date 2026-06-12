import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        aura: {
          bg: '#070A0F',
          surface: '#0D1218',
          raised: '#131A23',
          border: '#1E2936',
          accent: '#39D2C0',
          'accent-dim': '#1E7A71',
          warn: '#E8B339',
          danger: '#E85D5D',
          text: '#E6EDF3',
          muted: '#8B98A5',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        breathe: 'breathe 2.4s ease-in-out infinite',
        'orb-listen': 'orbListen 1.2s ease-in-out infinite',
        'orb-think': 'orbThink 1.6s linear infinite',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.06)' },
        },
        orbListen: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(57, 210, 192, 0.45)' },
          '50%': { boxShadow: '0 0 0 14px rgba(57, 210, 192, 0)' },
        },
        orbThink: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
