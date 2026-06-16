/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        background: '#0A0A0F',
        surface: '#12121A',
        border: '#1E1E2E',
        accent: '#6C63FF',
        'accent-dim': '#6C63FF22',
        success: '#22D3A5',
        warning: '#F59E0B',
        danger: '#F43F5E',
        muted: '#4A4A6A',
        text: '#E2E2F0',
        'text-dim': '#8888AA',
      },
    },
  },
  plugins: [],
}
