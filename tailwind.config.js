/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#0a0a0c',
          900: '#121316',
          850: '#18191f',
          800: '#20222a',
          700: '#2d313d',
          600: '#404554',
        },
        brand: {
          DEFAULT: '#3b82f6', // Electric blue / athletic tone
          light: '#60a5fa',
          dark: '#2563eb',
          neon: '#10b981', // Accent green / energy
          orange: '#f97316'
        }
      }
    },
  },
  plugins: [],
}
