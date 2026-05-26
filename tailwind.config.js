/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        shiftsys: {
          dark: '#000000',
          orange: '#A855F7'
        }
      }
    }
  },
  plugins: []
};
