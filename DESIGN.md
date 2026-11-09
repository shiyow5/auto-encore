---
name: Auto Encore
description: Visual identity for shiyow5/auto-encore — a rhythm-completion game with mechanical theme. Library/live theme with cyan accents.
omitted:
  - elevation
  - shapes
colors:
  primary: "#E0E0E0"
  secondary: "#8892B0"
  tertiary: "#00E5FF"
  on-tertiary: "#1A1A2E"
  neutral: "#16162A"
  on-neutral: "#E0E0E0"
  highlight: "#FF6B9D"
  warning: "#FFD93D"
  success: "#6BCB77"
typography:
  h1:
    fontFamily: "DotGothic16"
    fontSize: "1.75rem"
    fontWeight: "400"
    lineHeight: "1.3"
  h2:
    fontFamily: "DotGothic16"
    fontSize: "1.25rem"
    fontWeight: "400"
    lineHeight: "1.3"
  body-lg:
    fontFamily: "DotGothic16"
    fontSize: "1rem"
    lineHeight: "1.6"
  body-md:
    fontFamily: "DotGothic16"
    fontSize: "0.875rem"
    lineHeight: "1.5"
  label-sm:
    fontFamily: "DotGothic16"
    fontSize: "0.75rem"
    lineHeight: "1.4"
  label-caps:
    fontFamily: "DotGothic16"
    fontSize: "0.625rem"
    lineHeight: "1.4"
    letterSpacing: "0.05em"
rounded:
  sm: 2px
  md: 4px
  lg: 8px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    typography: "{typography.label-sm}"
  button-primary-hover:
    backgroundColor: "#33EBFF"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.secondary}"
    border: "1px solid {colors.secondary}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    typography: "{typography.label-sm}"
  panel:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    border: "1px solid #2A2A4A"
    padding: "16px"
  tile:
    backgroundColor: "#1E1E36"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    border: "1px solid #2A2A4A"
    padding: "8px"
  combo-number:
    textColor: "{colors.tertiary}"
    typography: "{typography.h1}"
    fontWeight: "700"
  score-bar-bg:
    backgroundColor: "#2A2A4A"
    rounded: "{rounded.sm}"
    height: "8px"
  score-bar-fill:
    backgroundColor: "{colors.success}"
    rounded: "{rounded.sm}"
  medal-display:
    textColor: "{colors.highlight}"
    typography: "{typography.label-sm}"
  graph-area:
    backgroundColor: "#0F0F1E"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
---

## Overview

Auto Encore is a rhythm-completion game where players arrange mechanical parts to create harmonious sequences. The visual identity is a **library/live performance theme** — part machine workshop, part concert hall. The palette uses a warm dark base (#16162A) with electric cyan (#00E5FF) as the primary accent, reflecting the energy of live performance.

The design philosophy is "energy at a glance." Combo counts, score progress, and completion feedback all use the brightest, most eye-catching colors. The palette feels more vibrant than log-dive while maintaining the same DotGothic16 font for consistency across both games.

## Colors

The palette centers on a dark purple-black base (#16162A) with energetic accent colors:

- **Tertiary (#00E5FF):** "Electric Cyan" — combos, completion feedback, active elements. The signature color of the game.
- **Highlight (#FF6B9D):** "Pink Spark" — special events, bonus rewards, rare achievements.
- **Success (#6BCB77):** "Green Clear" — perfect completion, medal acquisition.
- **Warning (#FFD93D):** "Yellow Caution" — timing misses, low accuracy warnings.

The secondary and primary tones are desaturated to let the accent colors pop. All text uses #E0E0E0 on #16162A for a contrast ratio above 13:1 — above WCAG AA.

## Typography

The entire UI uses **DotGothic16** (SIL OFL 1.1). The same font as log-dive ensures visual consistency across both games in the project. The font is bundled in `assets/font/` with the OFL license file.

- Headings: 1.75rem / 1.25rem with normal weight
- Body: 1rem / 0.875rem with comfortable line height
- Labels: 0.75rem down to 0.625rem for HUD and score elements

## Layout

The game uses a fixed grid with 8px spacing scale. All UI panels use 4px rounded corners. The main gameplay area occupies the center with score/combo displays at the top and result panels sliding in from the bottom after completion.

Result screens use a full-width layout with the lightweight-charts graph component embedded in the center panel for throughput/cost distribution visualization.

## Components

### Buttons

Primary buttons use electric cyan with dark text. Secondary (back/cancel) buttons use outlined style.

### Panels

Main UI panels use the neutral base (#16162A) with a subtle 1px border (#2A2A4A). Interior padding is 16px.

### Tiles

Game element tiles use a slightly lighter background (#1E1E36) with the same border color.

### HUD Elements

- Score bar: 8px high, green fill (#6BCB77) on dark gray track
- Combo counter: oversized cyan text at 1.75rem
- Medal display: pink highlight text for special rewards

### Result Screen

- Graph area: dark panel (#0F0F1E) with lightweight-charts for performance visualization
- Score summary: large typography for total score and grade
- Medal collection: grid of acquired medals with highlight color

## Do's and Don'ts

- **Do** use cyan (#00E5FF) as the primary accent for combo and completion feedback
- **Do** keep all text at 16px equivalent or larger (DotGothic16 0.75rem = ~12px, used only for non-critical HUD labels)
- **Do** maintain consistent 8px/16px spacing throughout
- **Do** bundle DotGothic16 with OFL license file
- **Do** use lightweight-charts on result screens for data visualization
- **Don't** use PixelSRPG-Forge assets (unresolved rights)
- **Don't** introduce additional font families
- **Don't** use pure white (#FFFFFF) — always use #E0E0E0 for a softer reading experience
- **Don't** use rounded corners larger than 8px — the retro aesthetic calls for sharper edges
