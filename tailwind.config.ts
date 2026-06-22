import type { Config } from "tailwindcss";

/**
 * Better-VC — "Carbon & Rust" design system.
 *
 * Tokens are ported verbatim from stitch_oxide_discord_client/carbon_rust/DESIGN.md
 * so the Stitch markup converts 1:1. The only deliberate deviation is borderRadius:
 * the auto-generated Stitch config made `rounded-full` 0.75rem, but the design spec
 * says avatars/status indicators must be perfect circles — so `full` is 9999px here.
 */
const config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- Surfaces (Carbon) ---
        surface: "#131313",
        "surface-dim": "#131313",
        "surface-bright": "#393939",
        "surface-container-lowest": "#0e0e0e",
        "surface-container-low": "#1c1b1b",
        "surface-container": "#201f1f",
        "surface-container-high": "#2a2a2a",
        "surface-container-highest": "#353534",
        "surface-variant": "#353534",
        "surface-tint": "#ffb59f",
        background: "#131313",
        "on-background": "#e5e2e1",
        "on-surface": "#e5e2e1",
        "on-surface-variant": "#e0bfb6",
        "inverse-surface": "#e5e2e1",
        "inverse-on-surface": "#313030",

        // --- Outlines ---
        outline: "#a88a82",
        "outline-variant": "#59413a",

        // --- Primary (Rust) ---
        primary: "#ffb59f",
        "on-primary": "#5e1600",
        "primary-container": "#ff7043",
        "on-primary-container": "#641800",
        "inverse-primary": "#ac3509",
        "primary-fixed": "#ffdbd0",
        "primary-fixed-dim": "#ffb59f",
        "on-primary-fixed": "#3a0a00",
        "on-primary-fixed-variant": "#852300",

        // --- Secondary (Slate) ---
        secondary: "#bbc9d0",
        "on-secondary": "#253238",
        "secondary-container": "#3e4b51",
        "on-secondary-container": "#adbbc2",
        "secondary-fixed": "#d7e5ec",
        "secondary-fixed-dim": "#bbc9d0",
        "on-secondary-fixed": "#101d23",
        "on-secondary-fixed-variant": "#3c494f",

        // --- Tertiary (Copper) ---
        tertiary: "#ffb5a0",
        "on-tertiary": "#601400",
        "tertiary-container": "#ff7048",
        "on-tertiary-container": "#661600",
        "tertiary-fixed": "#ffdbd1",
        "tertiary-fixed-dim": "#ffb5a0",
        "on-tertiary-fixed": "#3b0900",
        "on-tertiary-fixed-variant": "#872000",

        // --- Error ---
        error: "#ffb4ab",
        "on-error": "#690005",
        "error-container": "#93000a",
        "on-error-container": "#ffdad6",

        // --- Status (presence) ---
        "status-online": "#4caf50",
        "status-away": "#ff9800",
        "status-busy": "#ff7043",
      },
      borderRadius: {
        none: "0",
        sm: "0.125rem", // 2px
        DEFAULT: "0.25rem", // 4px — soft base for buttons/inputs/cards
        md: "0.375rem", // 6px
        lg: "0.5rem", // 8px — modals & large containers
        xl: "0.75rem", // 12px
        full: "9999px", // avatars & status dots: perfect circles
      },
      spacing: {
        unit: "4px",
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "40px",
        gutter: "16px",
        "container-max": "1440px",
      },
      fontFamily: {
        // UI workhorse
        body: ["Inter", "system-ui", "sans-serif"],
        "body-lg": ["Inter", "system-ui", "sans-serif"],
        "body-md": ["Inter", "system-ui", "sans-serif"],
        "display-lg": ["Inter", "system-ui", "sans-serif"],
        "headline-md": ["Inter", "system-ui", "sans-serif"],
        "headline-md-mobile": ["Inter", "system-ui", "sans-serif"],
        // Technical / metadata
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
        "code-sm": ["JetBrains Mono", "ui-monospace", "monospace"],
        "label-caps": ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "display-lg": [
          "48px",
          { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" },
        ],
        "headline-md": [
          "24px",
          { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "600" },
        ],
        "headline-md-mobile": [
          "20px",
          { lineHeight: "28px", fontWeight: "600" },
        ],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "code-sm": ["13px", { lineHeight: "18px", fontWeight: "400" }],
        "label-caps": [
          "11px",
          { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "700" },
        ],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "voice-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(76, 175, 80, 0.4)" },
          "50%": { boxShadow: "0 0 0 6px rgba(76, 175, 80, 0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "voice-pulse": "voice-pulse 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
