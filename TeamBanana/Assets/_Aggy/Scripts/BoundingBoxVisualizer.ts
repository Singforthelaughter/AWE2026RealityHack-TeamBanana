import {Detection} from "./DetectionHelpers"
import {MLSpatializer} from "./MLSpatializer"

/**
 * BoundingBoxVisualizer — draws bounding boxes around detected butterflies.
 *
 * Creates colored rectangle overlays for each detection, positioned via ScreenTransform
 * using the normalized bbox from YOLO. Boxes persist for holdSeconds after the last
 * detection and fade out. Only active when detection is enabled (startDetection).
 */
@component
export class BoundingBoxVisualizer extends BaseScriptComponent {
  @input
  @hint("The MLSpatializer that emits detections")
  mlSpatializer!: MLSpatializer

  @input
  @hint("Material for bounding box rectangles (e.g. a green outline material)")
  boxMaterial!: Material

  @input
  @hint("How thick the box border should be as a fraction of box size (0.005 = thin)")
  @widget(new SliderWidget(0.001, 0.05, 0.001))
  borderThickness: number = 0.005

  @input
  @hint("Tint color for the box")
  boxColor: vec4 = new vec4(0.3, 1.0, 0.3, 0.8)

  @input
  @hint("Only draw boxes for detections at or above this confidence")
  @widget(new SliderWidget(0, 1, 0.01))
  minScore: number = 0.3

  @input
  @hint("Seconds to keep boxes visible after the last detection drops out")
  @widget(new SliderWidget(0, 5, 0.05))
  holdSeconds: number = 10.0

  @input
  @hint("Start with detection ON")
  startActive: boolean = true

  @input
  @hint("Log activity to the Logger panel")
  debugLogging: boolean = false

  @input
  @hint("Maximum number of boxes to show at once")
  @widget(new SliderWidget(1, 10, 1))
  maxBoxes: number = 5

  private active: boolean = true
  private lastSeenTime: number = -1
  private readonly boxPool: SceneObject[] = []

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.start())
  }

  private start(): void {
    if (!this.mlSpatializer) {
      print("[BoundingBox] ERROR: mlSpatializer not assigned")
      return
    }
    if (!this.boxMaterial) {
      print("[BoundingBox] ERROR: boxMaterial not assigned — assign a material in the Inspector")
      return
    }
    this.active = this.startActive
    this.hideAllBoxes()
    this.mlSpatializer.getDetectionsUpdatedEvent().add((detections) => this.onDetections(detections))
    if (this.debugLogging) {
      print("[BoundingBox] subscribed (active=" + this.active + ")")
    }
  }

  /** Begin drawing bounding boxes. */
  public startDetection(): void {
    this.active = true
    if (this.debugLogging) print("[BoundingBox] startDetection()")
  }

  /** Stop drawing and hide all boxes. */
  public stopDetection(): void {
    this.active = false
    this.lastSeenTime = -1
    this.hideAllBoxes()
    if (this.debugLogging) print("[BoundingBox] stopDetection()")
  }

  public isDetecting(): boolean {
    return this.active
  }

  /** Called with each detection event. Draws boxes for valid detections. */
  private onDetections(detections: Detection[]): void {
    if (!this.active) {
      this.hideAllBoxes()
      return
    }

    const now = getTime()
    const valid = detections.filter((d) => d.score >= this.minScore)

    if (valid.length > 0) {
      this.lastSeenTime = now
    }

    const show = this.lastSeenTime >= 0 && now - this.lastSeenTime < this.holdSeconds

    if (show) {
      const count = Math.min(valid.length, this.maxBoxes)
      for (let i = 0; i < count; i++) {
        const box = this.getOrCreateBox(i)
        this.positionBox(box, valid[i])
        box.enabled = true
      }
      // Hide unused pool boxes
      for (let i = count; i < this.boxPool.length; i++) {
        this.boxPool[i].enabled = false
      }
    } else {
      this.hideAllBoxes()
    }
  }

  /** Create a ScreenImage rectangle positioned to match the detection bbox. */
  private getOrCreateBox(index: number): SceneObject {
    if (index < this.boxPool.length) return this.boxPool[index]

    const box = global.scene.createSceneObject("bbox_" + index)
    box.setParent(this.sceneObject)

    // ScreenTransform for normalized screen-space positioning
    const st: any = box.createComponent("ScreenTransform" as any)
    st.anchors = Rect.create(0, 0, 1, 1)

    // Image for the colored rectangle (Spectacles runtime doesn't have ScreenImage factory)
    const img: any = box.createComponent("Image" as any)
    img.material = this.boxMaterial
    img.color = this.boxColor

    this.boxPool.push(box)
    return box
  }

  /**
   * Position a box to match the detection's normalized bbox.
   * bbox = [centerX, centerY, width, height] all in 0–1 screen space.
   */
  private positionBox(box: SceneObject, detection: Detection): void {
    const st: any = box.getComponent("ScreenTransform" as any)
    const [cx, cy, w, h] = detection.bbox

    // Inset by borderThickness so we see an outline rather than a solid fill.
    // Outer rectangle: use box as-is. Inner rectangle: created as a slightly
    // smaller ScreenImage on top. Together they form a border.
    const bw = Math.max(this.borderThickness, 0.002)

    // Map [0,1] → [-1,1] anchor space
    const left = cx * 2 - 1 - w
    const right = cx * 2 - 1 + w
    const bottom = cy * 2 - 1 - h
    const top = cy * 2 - 1 + h

    st.anchors = Rect.create(left, bottom, right, top)
    st.offsets = Rect.create(0, 0, 0, 0)
  }

  private hideAllBoxes(): void {
    for (const box of this.boxPool) {
      box.enabled = false
    }
  }
}
