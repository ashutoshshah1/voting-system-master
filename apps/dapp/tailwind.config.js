/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        body: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
      },
      colors: {
        void: "#030712", // Deepest black-blue
        surface: "#111827", // Card backgrounds
        surfaceHighlight: "#1f2937", // Hover states
        neon: {
          blue: "#38bdf8",
          purple: "#c084fc",
          pink: "#e879f9",
          green: "#4ade80",
        },
        text: {
          main: "#f9fafb",
          muted: "#9ca3af",
          dim: "#6b7280",
        },
        border: "rgba(255, 255, 255, 0.1)",
      },
      boxShadow: {
        neon: "0 0 20px rgba(192, 132, 252, 0.4)", // Purple glow
        neonBlue: "0 0 20px rgba(56, 189, 248, 0.4)", // Blue glow
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
        },
        blob: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -50px) scale(1.1)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" },
        },
        slideIn: {
          "0%": { transform: "translateX(-20px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        fadeInUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        pulseGlow: "pulseGlow 2s ease-in-out infinite",
        blob: "blob 7s infinite",
        slideIn: "slideIn 0.4s ease-out forwards",
        fadeUp: "fadeInUp 0.6s ease-out forwards",
      },
    },
  },
  plugins: [],
}
