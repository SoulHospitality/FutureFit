/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Accent — solid black (kept as `wheat` token for existing class names)
        wheat: {
          DEFAULT: '#0a0a0a',
          50: '#f5f5f5',
          100: '#e8e8e8',
          200: '#d4d4d4',
          300: '#a3a3a3',
          400: '#525252',
          500: '#262626',
          600: '#171717',
        },
        // Neutral grey scale (kept as `timber` token)
        timber: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#a1a1aa',
          400: '#71717a',
          500: '#52525b',
          600: '#3f3f46',
          700: '#27272a',
          800: '#18181b',
          900: '#09090b',
        },
        cream: '#ffffff',
        ink: '#0a0a0a',
        primary: {
          50: '#fafafa',
          100: '#f4f4f5',
          500: '#52525b',
          600: '#3f3f46',
          700: '#27272a',
          800: '#18181b',
          900: '#09090b',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"Outfit"', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        brand: '0.35em',
        brandwide: '0.45em',
      },
    },
  },
  plugins: [],
};
