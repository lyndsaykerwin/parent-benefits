# Bundle deck — design system (v1, Oct 23 2026)

The deck should feel like a top consumer-app launch: one idea per slide, a big confident headline, one hero visual, almost no body text. Everything below is defined once as CSS variables in `bundle-deck.html`.

## Color tokens
| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--cream` | `#FBF6EF` | Default slide background (warm, not clinical white) | — |
| `--paper` | `#FFFFFF` | Cards, phone screens | — |
| `--ink` | `#1B1714` | Headlines, body text | 16.9:1 on cream |
| `--ink-2` | `#5C534B` | Secondary text, captions | 7.2:1 on cream |
| `--ink-3` | `#8A8076` | Tiny labels only (≥22px) | 3.6:1 (large text only) |
| `--line` | `#E9E0D4` | Hairlines, card borders | — |
| `--coral` | `#E4572E` | **The one brand accent**: key numbers, highlights, CTAs | 3.6:1 on cream: used for big (≥48px) type and fills only |
| `--coral-deep` | `#B93E1A` | Accent text at body sizes | 5.4:1 on cream |
| `--coral-tint` | `#FCE6DC` | Accent backgrounds, pills | — |
| `--night` | `#1B1714` | Dark "statement" slides (title, close) | — |

Card-kind colors (used only as small dots/pills inside the product, never as slide decoration):
clawback `#1E8A5A` · recall `#C9352B` · deadline `#E4572E` (brand) · discount `#6B4EE6` · coming soon `#8A8076`.

## Type
- Family: **Manrope** (Google Fonts), weights 500 / 600 / 700 / 800. Monospace for SQL/trace: **JetBrains Mono** 500.
- Scale (1920×1080 canvas): Display 128/1.0 −3% · H1 84/1.05 −2.5% · H2 52/1.15 −1.5% · Big number 160–220/0.95 −4% · Body 30/1.4 · Caption 22/1.35 · Eyebrow 20 uppercase, +12% tracking, 700.
- Rule: max ~25 words of body text per slide. Headlines are sentences, not labels.

## Spacing & layout
- 8px base grid. Slide padding 112px left/right, 96px top/bottom. Gaps from the set 16 / 24 / 32 / 48 / 64 / 96.
- 12-column grid, 48px gutters. Hero visual normally occupies columns 7–12.
- Every slide: eyebrow (section label) top-left, slide number + "Bundle" bottom-right in `--ink-3`.

## Shape
- Radii: 12 (pills, small chips) · 24 (cards) · 40 (big panels) · phone 56 outer / 44 screen.
- Card style: white, 1px `--line` border, shadow `0 1px 2px rgba(27,23,20,.04), 0 12px 32px rgba(27,23,20,.06)`. No gradients on cards.

## Iconography
- Simple inline SVG line icons, 2px stroke, rounded caps, drawn in `currentColor`. No emoji, no clip-art, no stock photos.
- Card kinds use a colored dot + label pill instead of icons, so the feed reads at a glance.

## Phone mockup component
- `.phone`: 390×844 logical screen scaled to fit (default 360 wide on slide), 14px near-black bezel, 56px outer radius, dynamic-island pill, status bar (9:41).
- Inside: app header ("Bundle" wordmark + baby name), content in 16px padding, iOS-like type sizes (scaled).
- The phone frame now holds real app screenshots (`img/`). Captions say "real app screenshot" and note the data is a fake sample family.

## Data & honesty rules
- All families are fake (Maya, Leo, Ava). Only public facts are real (the CPSC recall, the 2026 rules).
- Numbers that come from research carry a source line in the slide footer. Numbers flagged "(check)" in the research book are not used.
- No secrets, hostnames, keys or real personal data anywhere.
