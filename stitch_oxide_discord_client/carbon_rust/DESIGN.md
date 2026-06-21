---
name: Carbon & Rust
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#e0bfb6'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#a88a82'
  outline-variant: '#59413a'
  surface-tint: '#ffb59f'
  primary: '#ffb59f'
  on-primary: '#5e1600'
  primary-container: '#ff7043'
  on-primary-container: '#641800'
  inverse-primary: '#ac3509'
  secondary: '#bbc9d0'
  on-secondary: '#253238'
  secondary-container: '#3e4b51'
  on-secondary-container: '#adbbc2'
  tertiary: '#ffb5a0'
  on-tertiary: '#601400'
  tertiary-container: '#ff7048'
  on-tertiary-container: '#661600'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbd0'
  primary-fixed-dim: '#ffb59f'
  on-primary-fixed: '#3a0a00'
  on-primary-fixed-variant: '#852300'
  secondary-fixed: '#d7e5ec'
  secondary-fixed-dim: '#bbc9d0'
  on-secondary-fixed: '#101d23'
  on-secondary-fixed-variant: '#3c494f'
  tertiary-fixed: '#ffdbd1'
  tertiary-fixed-dim: '#ffb5a0'
  on-tertiary-fixed: '#3b0900'
  on-tertiary-fixed-variant: '#872000'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  container-max: 1440px
  gutter: 16px
---

## Brand & Style

The design system is engineered for high-performance technical environments, specifically targeting the Linux developer and power-user community. The brand personality is "Industrial Precision"—combining the raw, structural feel of low-level systems programming with a refined, modern interface.

The design style is a hybrid of **Minimalism** and **Technical Professionalism**. It prioritizes extreme responsiveness and visual clarity, utilizing a "Deep Dark" aesthetic that reduces eye strain during long sessions. The emotional response should be one of reliability, speed, and native integration. It avoids unnecessary fluff, favoring functional density and logical information architecture.

## Colors

This design system utilizes a high-contrast palette optimized for dark environments.

- **Surface (Carbon):** The base is built on `#121212`, providing a deep, true-black foundation that makes the screen hardware disappear.
- **Primary (Rust):** `#FF7043` acts as the primary action color. It is a vibrant, energetic orange that signifies connectivity and active states.
- **Accent (Copper):** `#D84315` is used for deeper semantic meaning, alerts, or secondary active states, providing a more grounded metallic tone.
- **Neutral (Slate/Silver):** A range of cool grays from `#1E1E1E` (containers) to `#B0BEC5` (secondary text) provides a technical, hardware-inspired finish.
- **Success/Error:** Use standard high-visibility greens and reds, but desaturated slightly to prevent "vibrating" against the dark background.

## Typography

The typography system relies on two workhorse typefaces: **Inter** for standard UI and **JetBrains Mono** for technical data.

- **Inter** is used for all functional UI elements, navigation, and messaging. It is tuned for legibility at small sizes on high-DPI displays.
- **JetBrains Mono** is reserved for metadata, timestamps, terminal-style outputs, and code snippets. It reinforces the "Rust/Technical" narrative.
- **Hierarchy:** Use bold weights for headers to ensure they stand out against the dark canvas. All labels and secondary metadata should be rendered in the mono font to distinguish them from primary communication content.

## Layout & Spacing

This design system uses a strict **4px baseline grid**. All padding, margins, and heights must be multiples of 4 to maintain a tight, technical feel.

- **Layout Model:** A fluid grid for the sidebar and main content areas. The sidebar (channels/contacts) should have a fixed width of 260px-300px, while the chat/content area expands.
- **Breakpoints:**
  - **Mobile (<640px):** Single column. Sidebar becomes an overlay or a drawer.
  - **Tablet (640px - 1024px):** Two-column layout with collapsed sidebar icons.
  - **Desktop (>1024px):** Three-column layout (Navigation, Content, Contextual Inspector).
- **Density:** Information density should be high. Use `8px` (sm) for internal component spacing and `16px` (md) for layout gutters.

## Elevation & Depth

To maintain a "lightweight" feel, this design system avoids heavy shadows. Depth is communicated through **Tonal Layering** and **Subtle Outlines**.

- **Base Layer (L0):** `#121212` (The application background).
- **Surface Layer (L1):** `#1E1E1E` (Sidebar and main cards).
- **Elevated Layer (L2):** `#2A2A2A` (Popovers, tooltips, and modals).
- **Outlines:** Use a `1px` solid border of `#333333` for all containers to provide separation.
- **Active State:** Instead of a shadow, an active element (like a focused input) uses a `1px` solid border of the primary Rust color (`#FF7043`).

## Shapes

The shape language is "Geometric & Controlled." While the aesthetic is sharp, a minimal rounding is applied to prevent the UI from feeling aggressive.

- **Base Rounding:** 4px (Soft) is the standard for buttons, inputs, and cards.
- **Large Components:** Modals and large containers use 8px (rounded-lg).
- **Circular Elements:** Avatars and status indicators remain perfect circles to contrast against the otherwise rectilinear grid.

## Components

### Buttons
- **Primary:** Solid Rust (`#FF7043`) background with white text. High-contrast, sharp 4px corners.
- **Secondary:** Transparent background with a Carbon (`#333333`) border. Text in Slate (`#B0BEC5`).
- **Ghost:** No background or border. Text turns Rust on hover.

### Inputs
- **Field:** Dark Slate (`#1E1E1E`) background with a subtle border. On focus, the border transitions to Rust (`#FF7043`).
- **Monospace Input:** For command-line style inputs or search, use JetBrains Mono as the input font.

### Lists & Navigation
- **Navigation Items:** 4px padding-left indicator bar in Rust color for the active state. Hover states use a subtle `#2A2A2A` background.
- **Chat Bubbles:** No bubbles—use a "stream" layout where messages are separated by spacing and subtle horizontal lines to keep the UI lightweight.

### Chips & Status
- **Status Indicators:** Small, vibrant circles. Online (Green), Away (Amber), Busy (Rust).
- **Technical Tags:** Monospace font inside a `#2A2A2A` box with a 2px border-radius.

### Cards
- Flat surfaces with `#1E1E1E` background and `#333333` borders. No shadows. Content is aligned to the 4px grid.