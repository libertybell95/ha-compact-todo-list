# Image generation brief

These are optional graphics for the GitHub repository and README. The card itself uses no custom images; its icons are standard Material Design Icons, and nothing here changes that.

README screenshots must come from a real Home Assistant dashboard, not image generation. Generated images are for branding only.

## What to make

| Priority  | Asset                                    | Size                   | Format                                       | Used in                                                               |
| --------- | ---------------------------------------- | ---------------------- | -------------------------------------------- | --------------------------------------------------------------------- |
| Essential | Repository icon                          | 512 × 512 (1:1)        | PNG, transparent background                  | GitHub social avatar, README header                                   |
| Essential | Icon, dark variant                       | 512 × 512 (1:1)        | PNG, transparent background                  | README on GitHub dark theme (`<picture>` with `prefers-color-scheme`) |
| Optional  | Social preview banner                    | 1280 × 640 (2:1)       | PNG, opaque                                  | GitHub → Settings → Social preview                                    |
| Optional  | README hero illustration, light and dark | 1600 × 600 (8:3), each | PNG, transparent or theme-matched background | Top of the README                                                     |

## Prompt to paste into ChatGPT

> Create a set of simple, flat graphics for an open-source Home Assistant dashboard add-on called **"Compact To-Do Card."** The add-on shows a to-do list as tight single-line rows, with each task expanding to show its details. The graphics should feel at home next to Home Assistant's own interface, which follows Google Material Design: clean, friendly, flat, no clutter.
>
> **Visual idea:** a rounded-rectangle card containing three or four short horizontal bars, each starting with a small square checkbox and ending with a small chevron (›). One bar is "open," showing a slightly taller area underneath with two or three thin gray lines that stand for a description. The second bar's checkbox is ticked. The image should say "compact list where one item opens up." Don't use readable text or letters on the bars.
>
> **Colors:**
>
> - Accent (checkbox fill, chevron highlight): Home Assistant blue `#03A9F4`
> - Light variant: card `#FFFFFF`, bars and lines `#E0E0E0` / `#BDBDBD`, outline `#E0E0E0`, background transparent
> - Dark variant: card `#1C1C1C`, bars and lines `#3A3A3A` / `#5A5A5A`, outline `#2C2C2C`, background transparent
> - A dark gray for strokes: `#212121` (light variant) or `#E1E1E1` (dark variant)
>
> **Style rules:**
>
> - Flat vector look, consistent 2–3 px strokes at 512 px, rounded corners (about 12 px radius on the card)
> - No gradients, no 3D, no glossy highlights, no drop shadows (at most one very soft one), no photos
> - No text, letters, logos or wordmarks, including the Home Assistant logo, house shapes, or any trademarked mark
> - Keep the drawing inside the central 80 % of the canvas so it isn't cropped when shown as a circle
> - Must still be readable at 48 × 48 px
>
> **Please produce:**
>
> 1. **Icon, light:** 512 × 512 PNG, transparent background, the card drawing alone.
> 2. **Icon, dark:** the same drawing in the dark-variant colors, 512 × 512 PNG, transparent background.
> 3. _(Optional)_ **Social preview:** 1280 × 640 PNG with an opaque background in `#F5F5F5`. The icon drawing sits on the left third. The right two-thirds shows a larger version of the card, with the top row open and four rows closed, so the size difference is easy to see. The only text allowed is "Compact To-Do Card" in a plain sans-serif (Roboto or similar), dark gray `#212121`.
> 4. _(Optional)_ **Hero illustration:** 1600 × 600 PNG in light and dark versions. Two cards side by side: on the left, a tall "before" card where every row has big gray description blocks; on the right, the short "after" card with thin rows and one open. A small arrow points from left to right. No text.

## After generating

- Save the files in `docs/images/` as `icon.png`, `icon-dark.png`, `social-preview.png`, `hero-light.png` and `hero-dark.png`.
- Check that the icon is legible at 48 px and that the transparent backgrounds have no leftover halo.
- Optimize each file (for example `oxipng -o 4` or TinyPNG) and keep each under 300 KB.
- Don't add these images to the card's JavaScript bundle.
