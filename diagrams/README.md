# System Architecture Diagram

Minimalist architecture diagram for **Butterfly Spotting & Social Sightings** (Team Banana).

## Files
- `architecture.svg` — source (hand-authored, editable, scales infinitely)
- `architecture.png` — exported raster (2× scale)

## Edit
Open `architecture.svg` in any editor or browser. Text, colours, and layout are plain SVG.

## Re-export PNG
```bash
rsvg-convert -z 2 architecture.svg -o architecture.png   # 2x
rsvg-convert -z 4 architecture.svg -o architecture@4x.png # print/poster
```

## Layout
Four stacked layers, top → bottom: **Spectacles Device → Lens Studio Runtime SDKs → Snap Cloud (Supabase) → External APIs**.
Snap / Spectacles platform features are highlighted in yellow; non-Snap services are dimmed to neutral. Content is sourced from `MAP.md` and `Assets/_Boon/WRITEUP.md`.
