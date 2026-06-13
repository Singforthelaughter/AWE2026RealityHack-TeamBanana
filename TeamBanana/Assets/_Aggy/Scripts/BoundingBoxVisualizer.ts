import {Detection} from "./DetectionHelpers"
import {MLSpatializer} from "./MLSpatializer"

/**
 * BoundingBoxVisualizer — the on-screen display for detections.
 *
 * Subscribes to MLSpatializer and, each frame, does two things:
 *   1. Moves a screen object (the "box") onto each detected butterfly (optional outline + label).
 *   2. Shows/hides a fixed "Butterfly detected" status object (e.g. a banner over the info card).
 *
 * KEY IDEAS:
 *   - `boxObjects` are reused, not spawned. You place them in the scene; the script repositions them.
 *   - The box's own Image (outline) is hidden unless `showBox` is on - you usually just want the label.
 *   - A short `holdSeconds` keeps things visible through brief detection dropouts so nothing flickers.
 *   - `smoothing` glides the box instead of snapping, so it doesn't jitter frame to frame.
 *
 * COMMON BUGS:
 *   - Label/box never shows: detection isn't producing a hit (check Logger for "Showing N box(es)"),
 *     OR the object's PARENT is disabled (a disabled parent hides the child even when we enable it).
 *   - Box too small/offset on laptop: webcam is widescreen, model is square -> use boxScaleX/Y.
 */
@component
export class BoundingBoxVisualizer extends BaseScriptComponent {
  @input
  @hint("The MLSpatializer that emits detections")
  mlSpatializer!: MLSpatializer

  @input
  @hint("Screen object(s) reused as boxes. Repositioned onto detections. Need at least one, even if you only want the label.")
  boxObjects: SceneObject[] = []

  @input
  @hint("Optional: a Text per box (same order). If empty, the script auto-finds a Text inside each box.")
  labelTexts: Text[] = []

  @input
  @hint("Only show detections at or above this confidence")
  @widget(new SliderWidget(0, 1, 0.01))
  minScore: number = 0.0

  @input
  @hint("Box smoothing. 0 = snap instantly (jittery), 0.8 = smooth glide (slight lag). Try 0.6.")
  @widget(new SliderWidget(0, 0.95, 0.05))
  smoothing: number = 0.6

  @input
  @hint("Seconds to keep a box/label visible after detection drops out, to stop flicker. Try 0.5.")
  @widget(new SliderWidget(0, 2, 0.05))
  holdSeconds: number = 0.5

  @input
  @hint("Box width multiplier. Raise if the box is too narrow for the butterfly (webcam aspect fix).")
  @widget(new SliderWidget(0.5, 3, 0.05))
  boxScaleX: number = 1.0

  @input
  @hint("Box height multiplier. Raise if the box is too short for the butterfly (webcam aspect fix).")
  @widget(new SliderWidget(0.5, 3, 0.05))
  boxScaleY: number = 1.0

  @input
  @hint("Mirror horizontally if boxes land on the wrong side")
  flipX: boolean = false

  @input
  @hint("Flip vertically if boxes are upside down")
  flipY: boolean = false

  @input
  @hint("Show the box outline. Off = only the label is shown (no rectangle).")
  showBox: boolean = false

  @input
  @hint("Log activity to the Logger panel")
  debugLogging: boolean = true

  @input
  @hint("Fixed object shown when a butterfly is detected, hidden otherwise. Placed by you - the script never moves it. Its PARENT must stay enabled.")
  statusObject: SceneObject | null = null

  // Per-box smoothed anchor state so each box glides instead of snapping.
  private smoothed: {l: number; r: number; b: number; t: number}[] = []
  private wasShown: boolean[] = [] // was this box shown last frame? (used to skip smoothing on first appear)
  private labelCache: (Text | null)[] = [] // cached auto-found Text per box
  private lastSeenTime: number[] = [] // last time each box had a fresh detection (for hold timer)
  private heldDetection: Detection[] = [] // last detection per box, reused during the hold window
  private lastLoggedCount: number = -1 // last logged "Showing N" count, to avoid spamming the Logger

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.start())
  }

  /** Validate inputs, set initial box-outline visibility, and subscribe to detections. */
  private start(): void {
    if (!this.mlSpatializer) {
      print("[BoxVisualizer] ERROR: mlSpatializer not assigned")
      return
    }
    if (this.boxObjects.length === 0) {
      print("[BoxVisualizer] ERROR: assign at least one Screen Image to boxObjects")
      return
    }
    // Hide each box's outline Image unless showBox is on (label still renders separately).
    for (let i = 0; i < this.boxObjects.length; i++) {
      const image = this.boxObjects[i].getComponent("Component.Image")
      if (image) {
        image.enabled = this.showBox
      }
    }
    this.mlSpatializer.getDetectionsUpdatedEvent().add((detections) => this.onDetections(detections))
    if (this.debugLogging) {
      print("[BoxVisualizer] Subscribed to detections, " + this.boxObjects.length + " box slot(s)")
    }
  }

  /**
   * Called every frame with the current detections. For each box slot:
   *   - if there's a fresh detection -> place + show it,
   *   - else if it was seen recently (within holdSeconds) -> keep showing the last one (anti-flicker),
   *   - else -> hide it.
   * Finally toggles the fixed statusObject based on whether anything is shown.
   */
  private onDetections(detections: Detection[]): void {
    const now = getTime()

    // Collect this frame's above-threshold detections, up to the number of box slots we have.
    const fresh: Detection[] = []
    for (let i = 0; i < detections.length && fresh.length < this.boxObjects.length; i++) {
      if (detections[i].score >= this.minScore) {
        fresh.push(detections[i])
      }
    }

    let shown = 0
    for (let slot = 0; slot < this.boxObjects.length; slot++) {
      const boxObj = this.boxObjects[slot]

      if (slot < fresh.length) {
        // Fresh detection for this slot.
        this.heldDetection[slot] = fresh[slot]
        this.lastSeenTime[slot] = now
        this.placeBox(boxObj, fresh[slot], slot)
        boxObj.enabled = true
        this.wasShown[slot] = true
        shown++
      } else if (this.heldDetection[slot] && now - this.lastSeenTime[slot] < this.holdSeconds) {
        // No fresh detection, but within the hold window -> keep last box up (prevents flicker).
        this.placeBox(boxObj, this.heldDetection[slot], slot)
        boxObj.enabled = true
        this.wasShown[slot] = true
        shown++
      } else {
        // Nothing to show in this slot -> hide box + its label.
        boxObj.enabled = false
        this.wasShown[slot] = false
        const label = this.getLabel(slot)
        if (label) {
          label.getSceneObject().enabled = false
        }
      }
    }

    // Fixed status banner: visible whenever at least one butterfly is shown.
    if (this.statusObject) {
      this.statusObject.enabled = shown > 0
    }

    // Log only when the count changes, so the Logger isn't flooded every frame.
    if (this.debugLogging && shown !== this.lastLoggedCount) {
      this.lastLoggedCount = shown
      print("[BoxVisualizer] Showing " + shown + " box(es)")
    }
  }

  /**
   * Move + resize one box onto a detection.
   * Detection bbox is [cx,cy,w,h] in 0-1 (top-left origin). ScreenTransform anchors are -1..1
   * (bottom-left origin), so we convert and flip Y. Applies scale, optional mirroring, and smoothing.
   */
  private placeBox(boxObj: SceneObject, detection: Detection, slot: number): void {
    const screenTransform = boxObj.getComponent("Component.ScreenTransform")
    if (!screenTransform) {
      print("[BoxVisualizer] ERROR: box object '" + boxObj.name + "' has no ScreenTransform component")
      return
    }

    let cx = detection.bbox[0]
    let cy = detection.bbox[1]
    const halfW = (detection.bbox[2] / 2) * this.boxScaleX
    const halfH = (detection.bbox[3] / 2) * this.boxScaleY

    if (this.flipX) cx = 1 - cx
    if (this.flipY) cy = 1 - cy

    // Convert 0-1 box edges to -1..1 anchors, flipping Y so screen-up is positive.
    let l = (cx - halfW) * 2 - 1
    let r = (cx + halfW) * 2 - 1
    let t = 1 - (cy - halfH) * 2
    let b = 1 - (cy + halfH) * 2

    // Smooth toward the target (skip on first appearance so it doesn't slide in from a stale spot).
    const prev = this.smoothed[slot]
    if (this.smoothing > 0 && this.wasShown[slot] && prev) {
      const s = this.smoothing
      l = prev.l * s + l * (1 - s)
      r = prev.r * s + r * (1 - s)
      t = prev.t * s + t * (1 - s)
      b = prev.b * s + b * (1 - s)
    }
    this.smoothed[slot] = {l: l, r: r, b: b, t: t}

    screenTransform.anchors = Rect.create(l, r, b, t)

    this.updateLabel(slot, detection)
  }

  /** Set this box's label text to "Butterfly detected" and show it. */
  private updateLabel(slot: number, detection: Detection): void {
    const label = this.getLabel(slot)
    if (!label) {
      return
    }
    label.text = "Butterfly detected"
    label.getSceneObject().enabled = true
  }

  /**
   * Find the Text for a box slot: use the assigned labelTexts entry if present, otherwise
   * auto-find (and cache) the first Text inside the box object's hierarchy.
   */
  private getLabel(slot: number): Text | null {
    if (slot < this.labelTexts.length && this.labelTexts[slot]) {
      return this.labelTexts[slot]
    }
    if (this.labelCache[slot] !== undefined) {
      return this.labelCache[slot]
    }
    const found = slot < this.boxObjects.length ? this.findText(this.boxObjects[slot]) : null
    this.labelCache[slot] = found
    return found
  }

  /** Depth-first search for a Text component on `obj` or any descendant. */
  private findText(obj: SceneObject): Text | null {
    const direct = obj.getComponent("Component.Text") as Text
    if (direct) {
      return direct
    }
    for (let i = 0; i < obj.getChildrenCount(); i++) {
      const found = this.findText(obj.getChild(i))
      if (found) {
        return found
      }
    }
    return null
  }
}
