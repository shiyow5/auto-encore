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
    fontSize: "2rem"
    fontWeight: "400"
    lineHeight: "1.3"
  h2:
    fontFamily: "DotGothic16"
    fontSize: "1.5rem"
    fontWeight: "400"
    lineHeight: "1.3"
  body:
    fontFamily: "DotGothic16"
    fontSize: "1rem"
    lineHeight: "1.6"
  small:
    fontFamily: "DotGothic16"
    fontSize: "0.875rem"
    lineHeight: "1.4"
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
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "#33EBFF"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.secondary}"
    border: "1px solid {colors.secondary}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    typography: "{typography.body}"
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
    typography: "{typography.body}"
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

### Workshop background (#110 / #101)

Implementation: `src/art/workshopBg.ts` (canvas, depth -20 — behind the ambient FX back layer at -10) and `.ws-grid` box-shadow in `src/ui/workshop.css`. Layers from back to front: floor tile (16px checker `#241B29`/`#2B2131`, grout `#1A131F`) → drop shadow → workbench top (wood `#8C6642`, edge `#4A3322`; 16px ring on landscape, 3px on portrait/compact) → corner vignette (`#0B0710`, 5 steps, ~10% of the short side). Board cell `#1E1722` vs bench `#8C6642` = 3.41:1 (≥3:1). Text areas (side panels, bottom band) stay on the dark floor.

## Typography

The entire UI uses **DotGothic16** (SIL OFL 1.1). The same font as log-dive ensures visual consistency across both games in the project. The font is bundled in `assets/font/` with the OFL license file.

Three levels, fixed (#99 / #114). Nothing is smaller than 14px. Checked by `e2e/ae99-typography.spec.ts` and `e2e/ae114-readability.spec.ts` on title, order select, workshop and result at 1280×720 / 390×844 / 844×390.

| Level   | Size        | Used for                                                                              |
| ------- | ----------- | ------------------------------------------------------------------------------------- |
| Heading | 32px / 24px | Screen title (h1 32px), section headings (24px)                                       |
| Body    | 16px        | All body text, buttons, labels, order rows, result table                              |
| Small   | 14px        | Only `.ae-footnote` (shelf prices 1G/4G/…) and `.rs-footer` (credits / license links) |

Icons drawn as emoji (🔒) are not text and may be smaller.

### Text contrast (#114, WCAG AA 4.5:1)

Measured with the WCAG 2.x formula. Every text colour must reach 4.5:1 on the surface it sits on — including locked and disabled text.

| Text colour                      | on `--ae-bg` #1E1722 | on `--ae-surface` #2A2030 | on `--ae-surface-up` #3A2D42 |
| -------------------------------- | -------------------- | ------------------------- | ---------------------------- |
| `--ae-text` #F3E9DC              | 14.57                | 12.98                     | 10.71                        |
| `--ae-text-weak` #C4B4C9         | 8.93                 | 7.95                      | 6.56                         |
| `--ae-text-muted` #9A88A8        | 5.38                 | 4.79                      | **3.95 — do not use**        |
| Locked shelf tool #B8A8C0        | 7.83                 | 6.97                      | 5.75                         |
| `--ae-amber` #F2B45A             | 9.54                 | 8.50                      | 7.01                         |
| `--ae-entry` #92DDCC             | 11.19                | 9.97                      | 8.22                         |
| `--ae-exit` #F29BB8              | 8.46                 | 7.54                      | 6.22                         |
| `--ae-danger` #FF8A7A            | 7.63                 | 6.80                      | 5.61                         |
| #1E1722 on `--ae-amber` (button) | 9.54                 | —                         | —                            |

## Layout

The game uses a fixed grid with 8px spacing scale. All UI panels use 4px rounded corners. The main gameplay area occupies the center with score/combo displays at the top and result panels sliding in from the bottom after completion.

Result screens use a full-width layout with the lightweight-charts graph component embedded in the center panel for throughput/cost distribution visualization.

## Components

### Buttons

Primary buttons use amber with dark text (`#1E1722`); at most one per screen. Secondary buttons are outlined (2px `--ae-line`).

### Panels

Main UI panels use the neutral base (`--ae-surface` #2A2030). Interior padding is 16px.

**Frame token (#111, shared with log-dive #102)** — drawn with `box-shadow` + corner gradients only, so layout sizes do not change. Applied to `.ae-frame`, `.ws-shelf`, `.ws-order`, `.ws-confirm`, `.volume-panel`.

| Part             | Variable            | Value                                                                                       |
| ---------------- | ------------------- | ------------------------------------------------------------------------------------------- |
| Outer line       | `--ae-frame-outer`  | 1px #C4B4C9 (8.93:1 on bg, 7.95:1 on panel)                                                 |
| Inner band       | `--ae-frame-inner`  | 2px #120D16 (inset)                                                                         |
| Corner dots      | `--ae-frame-corner` | 3×3px #F3E9DC at the 4 inner corners (2px inset)                                            |
| Selected         | `--ae-amber`        | solid 2px amber + corner brackets `--ae-bracket` #F3E9DC (6px long, 2px thick, 4px outside) |
| Locked           | `--ae-frame-lock`   | solid 2px #5A4A64 + 🔒 (never dashed; dashed reads as "disabled")                           |
| Danger (confirm) | `--ae-danger`       | border of the "はい" button (`.ws-btn.ws-danger`)                                           |

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
- **Do** keep all text at 16px or larger; only `.ae-footnote` / `.rs-footer` may use 14px, and nothing goes below 14px (#114)
- **Do** maintain consistent 8px/16px spacing throughout
- **Do** bundle DotGothic16 with OFL license file
- **Do** use lightweight-charts on result screens for data visualization
- **Don't** use PixelSRPG-Forge assets (unresolved rights)
- **Don't** introduce additional font families
- **Don't** use pure white (#FFFFFF) or pure black — use `--ae-text` (#F3E9DC) for a softer reading experience
- **Don't** use the retired cyan and pink-spark accents or hard-code colors; use `--ae-*` variables
- **Don't** use rounded corners larger than 8px — the retro aesthetic calls for sharper edges
