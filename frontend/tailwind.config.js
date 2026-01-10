/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#075e54',
        secondary: '#128c7e',
        accent: '#25d366',
        bg: {
          primary: '#0b141a',
          secondary: '#202c33',
          chat: '#0b141a',
        },
        text: {
          primary: '#e9edef',
          secondary: '#8696a0',
        },
        message: {
          out: '#005c4b',
          in: '#202c33',
        },
        border: '#2a3942',
        hover: '#2a3942',
      }
    },
  },
  plugins: [],
}