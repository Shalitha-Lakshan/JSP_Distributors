/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        leaf: "#0f766e",
        sand: "#f8f4e8",
        clay: "#f97316",
        slatewash: "#e2e8f0"
      },
      fontFamily: {
        display: ["Trebuchet MS", "Verdana", "sans-serif"]
      }
    }
  },
  plugins: []
};
