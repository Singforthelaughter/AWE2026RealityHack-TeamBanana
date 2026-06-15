import {Detection} from "./DetectionHelpers"
import {MLSpatializer} from "./MLSpatializer"

/**
 * BoundingBoxVisualizer (class name kept to preserve scene wiring) — minimal detection indicator.
 *
 * Shows ONE object (e.g. a centered "Butterfly detected" Text) while the model sees a butterfly,
 * and hides it otherwise. Render it with the MAIN camera: parent statusObject under the Camera so
 * it sits head-locked at screen center. No bounding boxes, no ScreenTransform — so NO orthographic
 * camera is needed.
 *
 * Detection can be toggled at runtime via startDetection() / stopDetection(), meant to be wired to
 * an agentic Gemini route ("start detecting butterflies" / "stop"). While stopped, the indicator
 * stays hidden and detections are ignored.
 *
 * A short holdSeconds keeps the indicator up through brief dropouts so it doesn't flicker.
 */
@component
export class BoundingBoxVisualizer extends BaseScriptComponent {
  @input
  @hint("The MLSpatializer that emits detections")
  mlSpatializer!: MLSpatializer

  @input
  @hint("Object shown while a butterfly is detected (e.g. a centered 'Butterfly detected' Text parented to the main Camera). The script only toggles it — its PARENT must stay enabled.")
  statusObject: SceneObject | null = null

  @input
  @hint("Only count detections at or above this confidence")
  @widget(new SliderWidget(0, 1, 0.01))
  minScore: number = 0.0

  @input
  @hint("Seconds to keep the indicator visible after detection drops out, to stop flicker. Try 0.5.")
  @widget(new SliderWidget(0, 2, 0.05))
  holdSeconds: number = 0.5

  @input
  @hint("Start with detection ON. Turn OFF if Joe's Gemini route should enable it via startDetection().")
  startActive: boolean = true

  @input
  @hint("Log activity to the Logger panel")
  debugLogging: boolean = true

  private active: boolean = true // is detection currently on (gated by start/stopDetection)
  private lastSeenTime: number = -1 // last time a butterfly was detected (drives the hold timer)
  private lastShown: boolean = false // current visibility, so we log only on change

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.start())
  }

  /** Validate input, set initial active state, hide the indicator, and subscribe to detections. */
  private start(): void {
    if (!this.mlSpatializer) {
      print("[ButterflyDetected] ERROR: mlSpatializer not assigned")
      return
    }
    this.active = this.startActive
    this.setShown(false)
    this.mlSpatializer.getDetectionsUpdatedEvent().add((detections) => this.onDetections(detections))
    if (this.debugLogging) {
      print("[ButterflyDetected] subscribed (active=" + this.active + ")")
    }
  }

  // --- Agentic control: wire these to Gemini routes ---------------------------------------------

  /** Begin reacting to detections and showing the indicator. (Wire to a "start detecting" route.) */
  public startDetection(): void {
    this.active = true
    if (this.debugLogging) print("[ButterflyDetected] startDetection()")
  }

  /** Stop reacting and hide the indicator. (Wire to a "stop detecting" route.) */
  public stopDetection(): void {
    this.active = false
    this.lastSeenTime = -1
    this.setShown(false)
    if (this.debugLogging) print("[ButterflyDetected] stopDetection()")
  }

  /** Whether detection is currently on. */
  public isDetecting(): boolean {
    return this.active
  }

  // ----------------------------------------------------------------------------------------------

  /**
   * Called each frame with the current detections. While active, shows statusObject if any
   * detection is above threshold, with a short hold after the last hit so it doesn't flicker.
   */
  private onDetections(detections: Detection[]): void {
    if (!this.active) {
      this.setShown(false)
      return
    }

    const now = getTime()
    let detected = false
    for (let i = 0; i < detections.length; i++) {
      if (detections[i].score >= this.minScore) {
        detected = true
        break
      }
    }
    if (detected) {
      this.lastSeenTime = now
    }

    const show = this.lastSeenTime >= 0 && now - this.lastSeenTime < this.holdSeconds
    this.setShown(show)
  }

  /** Toggle the indicator object, logging only when visibility changes. */
  private setShown(show: boolean): void {
    if (this.statusObject) {
      this.statusObject.enabled = show
    }
    if (show !== this.lastShown) {
      this.lastShown = show
      if (this.debugLogging) {
        print("[ButterflyDetected] " + (show ? "Butterfly detected" : "cleared"))
      }
    }
  }
}