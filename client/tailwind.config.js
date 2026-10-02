/** @type {import('tailwindcss').Config} */
const timber = (step) => `rgb(var(--timber-${step}) / <alpha-value>)`;

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
        // Neutral grey scale (kept as `timber` token, values in index.css)
        timber: {
          50: timber(50),
          100: timber(100),
          200: timber(200),
          300: timber(300),
          400: timber(400),
          500: timber(500),
          600: timber(600),
          700: timber(700),
          800: timber(800),
          900: timber(900),
          950: timber(950),
        },
        cream: '#ffffff',
        ink: '#0a0a0a',
        // Storefront surface + accent tokens (monochrome brand palette)
        bone: '#fafafa',
        sand: '#f4f4f5',
        blush: '#e4e4e7',
        nude: '#a1a1aa',
        clay: '#52525b',
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
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Manrope"', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        brand: '0.35em',
        brandwide: '0.45em',
      },
      transitionTimingFunction: {
        ff: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      maxWidth: {
        site: '1440px',
      },
    },
  },
  plugins: [],
};
