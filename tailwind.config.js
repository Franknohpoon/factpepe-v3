/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ssg-red': '#CE0E2D',
        'ssg-green': '#00864F',
      }
    },
  },
  plugins: [],
}
