/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 20px 60px rgba(79, 70, 229, 0.25)",
      },
    },
  },
  plugins: [],
}

