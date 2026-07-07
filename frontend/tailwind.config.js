/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Override blue → brand green so every existing text-blue-*/bg-blue-* becomes green
        blue: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // Navy palette for sidebar
        navy: {
          950: '#080e1a',
          900: '#0b1220',
          800: '#0d1524',
          700: '#111c2e',
          600: '#1a2744',
          500: '#243355',
          400: '#2e4068',
        },
        // Keep a named brand alias
        brand: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
};
