/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        shiftsys: {
          dark: '#111827',
          orange: '#F97316'
        }
      }
    }
  },
  plugins: []
};
