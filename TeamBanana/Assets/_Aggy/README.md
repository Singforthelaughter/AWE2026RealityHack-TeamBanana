# _Aggy — Butterfly Detection + Identification

This folder is a **self-contained** butterfly pipeline for the Spectacles lens. Nothing here
depends on any other team folder, so it can't break from outside changes.

It does two separate jobs:

1. **Live detection** — runs a YOLO model on the camera every frame, finds butterflies, and shows
   a "Butterfly detected" label.
2. **Identification** — on a voice command ("identify"), takes a high-res photo, sends it to a
   Supabase Edge Function, which calls the Kindwise insect API and returns the species.

---

## Data flow (the big picture)

```
DETECTION (every frame, works in Preview):
  Device Camera Texture
      → MLSpatializer (runs ButterflyDetection.onnx)
      → YOLODetectionProcessor (decodes model output into boxes)
      → Detection[]  (emitted via EventModule event)
      → BoundingBoxVisualizer (positions a box / shows "Butterfly detected" label)

IDENTIFICATION (on "identify" voice command, DEVICE ONLY):
  ButterflyIdentifier
      → CameraModule.requestImage()   (high-res still — DEVICE ONLY, fails in Preview)
      → Base64 encode
      → supabase.functions.invoke("identify-butterfly", { image })
      → [Supabase Edge Function] calls Kindwise with the API key (server-side secret)
      → IDResponse  (typed in KindwiseTypes.ts)
      → ButterflyIdentifier.showResult() displays the species name
```

The Edge Function lives **outside this folder** at `supabase/functions/identify-butterfly/index.ts`
(repo root). Kindwise's API key is stored as a Supabase secret, never in the lens.

---

## Scripts and what each one does

| File | Role |
|------|------|
| `EventModule.ts` | Tiny `EventWrapper` (add/remove/trigger). Replaces a missing sample-pack module so nothing else is needed. |
| `DetectionHelpers.ts` | The `Detection` data class + non-max-suppression (NMS) / IoU math used to merge overlapping boxes. |
| `YOLODetectionProcessor.ts` | Decodes the raw YOLOv7 ONNX output tensors into `Detection` boxes. **The anchors/strides here must match the exported model.** |
| `MLSpatializer.ts` | Owns the `MLComponent`, runs the model each frame, emits `Detection[]`. The detection entry point. |
| `BoundingBoxVisualizer.ts` | Consumes detections → positions a screen box and/or shows the "Butterfly detected" status label. All the display tuning lives here. |
| `ButterflyIdentifier.ts` | Voice command → high-res capture → Supabase → shows species. The identification half. |
| `KindwiseTypes.ts` | TypeScript types for the full Kindwise `IDResponse`. Shared shape between the lens and the Edge Function. |

---

## Key gotchas (READ THIS before debugging)

- **Device-only APIs:** `CameraModule.requestImage()` (high-res capture) and `AsrModule` (voice)
  **do not work in Lens Studio Preview.** In Preview you'll see `Image request not supported` and
  `Login to My Lenses is required for VoiceML`. This is expected — test those on the real
  Spectacles. For Preview testing, disable `ButterflyIdentifier` (or its `useVoiceCommand`).
- **Detection is square, camera is widescreen:** the model takes 640×640. On a laptop webcam the
  box comes out small/offset because the wide frame is squished into a square. Use `boxScaleX` /
  `boxScaleY` on BoundingBoxVisualizer to compensate. It's much closer on real Spectacles.
- **A disabled parent hides a child:** BoundingBoxVisualizer only toggles the object you assign
  (e.g. the status label). If that object's **parent is disabled**, it stays invisible. Keep
  parents enabled; let the script toggle the leaf.
- **The model is 1 class:** output channels = 18 = 3 anchors × (5 + 1 class). `MLSpatializer.classLabels`
  MUST be a single entry (`["Butterfly"]`). More entries break the tensor decode.
- **Model is Git LFS:** `ButterflyDetection.onnx` is an LFS file (~24 MB). If it's 133 bytes, run
  `git lfs pull` or the model loads empty (zero detections).
- **Commit `.meta` files** with their assets/scripts, always — they hold the GUIDs that references rely on.

---

## How to test

**Detection + label (works in Preview):**
1. Disable `ButterflyIdentifier` (its device-only APIs error in Preview).
2. Feed the Preview a butterfly (drag an image in, or webcam on a butterfly photo).
3. Logger should print `[BoxVisualizer] Showing 1 box(es)` and the label appears.

**Identification (Spectacles only):**
1. Deploy the Edge Function + set `KINDWISE_API_KEY` secret (see `supabase/functions/...`).
2. On device, say "identify" → watch `resultText` go `Capturing... → Identifying... → <species>`.

**Backend alone (no device):** test the Edge Function / Kindwise with curl (see repo notes).

---

## BoundingBoxVisualizer inputs cheat-sheet

| Input | What it does |
|-------|--------------|
| `mlSpatializer` | The MLSpatializer feeding detections. Required. |
| `boxObjects` | Screen object(s) moved to each detection. Need ≥1 even if you only want the label. |
| `statusObject` | A fixed object (e.g. "Butterfly detected" text) shown when ≥1 butterfly is detected. Never moved. |
| `showBox` | Off = hide the box rectangle (label only). |
| `minScore` | Only show detections above this confidence. |
| `holdSeconds` | Keep visible this long after detection drops, to stop flicker. |
| `smoothing` | 0 = snap, higher = smoother glide. |
| `boxScaleX/Y` | Stretch the box to wrap the butterfly (webcam aspect fix). |
| `flipX/flipY` | Mirror if the box lands on the wrong side / upside down. |
