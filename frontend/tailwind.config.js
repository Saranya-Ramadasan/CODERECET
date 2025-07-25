/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // <--- IMPORTANT: Ensure this line is present and correct
  ],
  theme: {
    extend: {
      // If you defined a custom font like 'Inter' earlier, keep it here
      fontFamily: {
        inter: ['Inter', 'sans-serif'], // Example if you want to use the Inter font
      },
    },
  },
  plugins: [],
}
