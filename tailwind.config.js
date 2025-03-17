/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-overused-grotesk)', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        tomato: '#EF6351',
        salmon: '#F38375',
        'eerie-black': '#1D1D1D',
        jet: '#312D2D',
        'misty-rose': '#FFECEA',
      },
    },
  },
  plugins: [],
}; 