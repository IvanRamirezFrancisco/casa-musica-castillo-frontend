/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#FCF6F7',
          100: '#F8E9EC',
          200: '#F0D0D6',
          300: '#E1A8B2',
          400: '#C97B89',
          500: '#A64D5B',
          600: '#913F4D',
          700: '#722F37',
          800: '#5A252C',
          900: '#421A20',
        },
        secondary: {
          500: '#D4B066',
          600: '#C5A059',
          700: '#B8934F',
        },
        surface: {
          DEFAULT: '#FCFAF7', /* Fondo principal */
          crema: '#F5EFE8',  /* Superficie crema */
          card: '#FFFFFF',
          border: '#E7DED5',
        },
        texto: {
          main: '#292524', /* Texto carbón aproximado */
          muted: '#6B6560',
        }
      },
      fontFamily: {
        title: ['Montserrat', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        body: ['Roboto', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
