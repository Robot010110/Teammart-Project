/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#1D2D5C",
        orange: "#F47A20",
        "dark-gray": "#1A1A1A",
        "light-gray": "#E8E8E8",
        // Mirror of brand/tokens.mjs — blue is identity (logo, data, focus),
        // orange is action (buttons, priority, alerts).
        brand: {
          night: "#0A0B10",
          blue: "#4F7CFF",
          "blue-soft": "#9BB3FF",
          "blue-deep": "#2F4FCC",
          orange: "#F47A20",
          "orange-deep": "#C95C10",
        },
      },
      fontFamily: {
        display: ["'Plus Jakarta Sans'", "sans-serif"],
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
