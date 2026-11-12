---
name: Auto Encore
description: Visual identity for shiyow5/auto-encore — a rhythm-completion game with mechanical theme. Library/live theme with amber accents on a plum base.
omitted:
  - elevation
  - shapes
colors:
  primary: "#F2B45A"
  on-primary: "#1E1722"
  secondary: "#C4B4C9"
  tertiary: "#92DDCC"
  neutral: "#1E1722"
  surface: "#2A2030"
  surface-up: "#3A2D42"
  line: "#7A6888"
  on-neutral: "#F3E9DC"
  text-muted: "#9A88A8"
  highlight: "#F29BB8"
  danger: "#FF8A7A"
  medal-gold: "#FFD27A"
  medal-silver: "#D8D3E0"
  medal-bronze: "#D98E5F"
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

Auto Encore is a rhythm-completion game where players arrange mechanical parts to create harmonious sequences. The visual identity is a **library/live performance theme** — part machine workshop, part concert hall. The palette is a warm plum base (#1E1722) with amber (#F2B45A) as the primary accent. The warm palette also keeps it visually distinct from log-dive's cool celadon.

The implementation is the source of truth: all colors live in CSS variables `--ae-*` (`src/ui/workshop.css` `:root`). Change DESIGN.md and workshop.css in the same PR.

## Colors

| Role                              | Variable                                        | Value                       |
| --------------------------------- | ----------------------------------------------- | --------------------------- |
| Background (all screens)          | `--ae-bg`                                       | #1E1722                     |
| Panel                             | `--ae-surface`                                  | #2A2030                     |
| Raised surface / grid             | `--ae-surface-up`                               | #3A2D42                     |
| Border / line (3.47:1 on bg)      | `--ae-line`                                     | #7A6888                     |
| Body text (14.57:1)               | `--ae-text`                                     | #F3E9DC                     |
| Hints / secondary text            | `--ae-text-weak`                                | #C4B4C9                     |
| Locked / disabled text            | `--ae-text-muted`                               | #9A88A8                     |
| Primary action, heading, selected | `--ae-amber` (hover `--ae-amber-hover` #F6C77F) | #F2B45A                     |
| Entry                             | `--ae-entry`                                    | #92DDCC                     |
| Exit                              | `--ae-exit`                                     | #F29BB8                     |
| Failure / error                   | `--ae-danger`                                   | #FF8A7A                     |
| Medals                            | `--ae-medal-gold/silver/bronze`                 | #FFD27A / #D8D3E0 / #D98E5F |

Entry/exit must not rely on color alone: add the "入"/"出" label or an arrow shape. Medals also carry a shape (●/▲/■).

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

Primary buttons use amber with dark text (`#1E1722`); at most one per screen. Secondary buttons are outlined (2px `--ae-line`).

### Panels

Main UI panels use the neutral base (`--ae-surface` #2A2030) with a subtle border (`--ae-line`). Interior padding is 16px.

### Tiles

Game element tiles use a slightly lighter background (`--ae-surface-up` #3A2D42) with the same border color.

### HUD Elements

- Score bar: 8px high, amber fill (#F2B45A) on dark gray track
- Combo counter: oversized amber text at 1.75rem
- Medal display: medal colors (gold/silver/bronze) for special rewards

### Run effects (Issue #113, workshop)

Drawn with the board `gfx` only, redrawn every tick (110ms). No new canvas. Only while a run plays (`fxEnabled()` true; with `?fx=0` / reduced motion the run is not animated at all).

- Run lamp: 14px x 2px amber (#F6C77F) bar on the 2px outside the board's top edge (moves left to right) and bottom edge (right to left), 10px per tick.
- Note tail: previous tick's note position, radius 2px, same pitch color at 30% alpha. Skipped when a note is still on that cell.
- Merger sparks: while a note sits on a merger cell, four 2x2 white dots near the cell corners, shifting 1px every tick.
- Never covers a note, a machine glyph or text.

### Pixel Icons (Issue #112)

Defined as strings in `src/art/sprites.ts`; drawn with `iconCanvas()` and scaled with `image-rendering: pixelated` (never blurred).

- Speaker (volume on/off) and ♪ note (on/off): 14px sprites, shown at `clamp(16px, 7·--u, 28px)` in `.ae-icon`. Muted state also changes shape (not colour alone).
- Medals (gold/silver/bronze): 12px sprites at 24px (2x), always paired with a text label (金/銀/銅).
- Title mark: ♪ (`note-on`) at 40px above the heading; decorative, `aria-hidden`.
- Machine sprites: 14px tiles; running lamp has 2 frames (rio, #112).
- Ports (entrance/exit panels): light/dark edge so shape reads without colour.

### Result Screen

- Graph area: dark panel (`--ae-bg`) with lightweight-charts for performance visualization
- Score summary: large typography for total score and grade
- Medal collection: grid of acquired medals with highlight color

## Do's and Don'ts

- **Do** use amber (#F2B45A) as the primary accent (primary button, headings, selected state)
- **Do** keep all text at 16px equivalent or larger (DotGothic16 0.75rem = ~12px, used only for non-critical HUD labels)
- **Do** maintain consistent 8px/16px spacing throughout
- **Do** bundle DotGothic16 with OFL license file
- **Do** use lightweight-charts on result screens for data visualization
- **Don't** use PixelSRPG-Forge assets (unresolved rights)
- **Don't** introduce additional font families
- **Don't** use pure white (#FFFFFF) or pure black — use `--ae-text` (#F3E9DC) for a softer reading experience
- **Don't** use the retired cyan and pink-spark accents or hard-code colors; use `--ae-*` variables
- **Don't** use rounded corners larger than 8px — the retro aesthetic calls for sharper edges
