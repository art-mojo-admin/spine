/** @type {import('tailwindcss').Config} */
const path = require('path')

module.exports = {
  content: [
    path.resolve(__dirname, './src/**/*.{js,ts,jsx,tsx}'),
    path.resolve(__dirname, './index.html')
  ],
  theme: {
    extend: {
      colors: {
        border: "rgb(var(--border))",
        input: "rgb(var(--input))",
        ring: "rgb(var(--ring))",
        background: "rgb(var(--background))",
        foreground: "rgb(var(--foreground))",
        primary: {
          DEFAULT: "rgb(var(--primary))",
          foreground: "rgb(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary))",
          foreground: "rgb(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive))",
          foreground: "rgb(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "rgb(var(--muted))",
          foreground: "rgb(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "rgb(var(--accent))",
          foreground: "rgb(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "rgb(var(--popover))",
          foreground: "rgb(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "rgb(var(--card))",
          foreground: "rgb(var(--card-foreground))",
        },
        navy: {
          DEFAULT: "#1e2a4a",
          50: "#f0f3f8",
          100: "#dce3f0",
          200: "#b9c7e1",
          300: "#8da4cc",
          400: "#5b7bb5",
          500: "#3d5a94",
          600: "#2e4573",
          700: "#1e2a4a",
          800: "#162038",
          900: "#0e1525",
        },
        "accent-blue": {
          DEFAULT: "#5b7bb5",
          light: "#7ba0d4",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
}
