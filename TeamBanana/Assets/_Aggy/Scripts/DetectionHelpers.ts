/**
 * DetectionHelpers — the data class for one detection, plus the geometry math used to clean up
 * overlapping detections (non-maximum suppression).
 *
 * Used by YOLODetectionProcessor (to build/merge boxes) and BoundingBoxVisualizer (to read boxes).
 */

/**
 * One detected object.
 * bbox is [centerX, centerY, width, height], all normalized 0-1 in screen space (top-left origin).
 */
export class Detection {
  bbox: [number, number, number, number]
  score: number // confidence 0-1
  index: number // class index (always 0 for the single-class butterfly model)
  label: string // human label, e.g. "Butterfly"

  constructor(bbox: [number, number, number, number], score: number, index: number, label?: string) {
    this.bbox = bbox
    this.score = score
    this.index = index
    this.label = label === undefined ? "class_" + index : label
  }

  toString(): string {
    return `Class: ${this.label} Score: ${this.score.toFixed(5)} Bounding Box: ${this.bbox}`
  }

  /** Bounding box as a Rect in local (-1..1) space (handy for screen placement). */
  getScreenRect(): Rect {
    const x = this.bbox[0] * 2.0 - 1.0
    const y = 1.0 - 2 * this.bbox[1]
    return Rect.create(x - this.bbox[2], x + this.bbox[2], y - this.bbox[3], y + this.bbox[3])
  }

  /** Center of the box in normalized (0-1) space. */
  getScreenPos(): vec2 {
    return new vec2(this.bbox[0], this.bbox[1])
  }
}

export class DetectionHelpers {
  /**
   * Non-Maximum Suppression (NMS).
   * The model emits many overlapping boxes for the same butterfly. NMS keeps the highest-scoring
   * box and deletes any other box of the same class that overlaps it more than `iouThresh`.
   *
   * @param boxes       candidate boxes ([cx,cy,w,h] each)
   * @param scores      parallel array of {cls, score} for each box
   * @param scoreThresh drop boxes below this confidence
   * @param iouThresh   overlap above which a lower box is suppressed (0.5 is typical)
   * @param maxCandidates safety cap on how many boxes to consider
   * @returns the surviving Detections (deduplicated)
   */
  static nms(
    boxes: number[][],
    scores: {cls: number; score: number}[],
    scoreThresh: number,
    iouThresh: number,
    maxCandidates: number = 300
  ): Detection[] {
    const result: Detection[] = []
    const candidates: Detection[] = []

    // Keep only valid, above-threshold boxes as candidates.
    for (let i = 0; i < boxes.length && i < scores.length; i++) {
      const box = boxes[i]
      const score = scores[i]
      if (
        box &&
        score &&
        score.score > scoreThresh &&
        DetectionHelpers.isValidBox(box) &&
        isFinite(score.score) &&
        isFinite(score.cls)
      ) {
        candidates.push(new Detection(box as [number, number, number, number], score.score, score.cls))
      }
    }

    // Highest confidence first, so we keep the best box of each cluster.
    candidates.sort(DetectionHelpers.compareByScoreReversed)
    const candidateCount = Math.min(candidates.length, maxCandidates)

    const suppressed: boolean[] = []
    for (let i = 0; i < candidateCount; i++) {
      if (suppressed[i]) {
        continue
      }

      // This box wins; keep it.
      const currentBox = candidates[i]
      result.push(currentBox)

      // Suppress every lower box of the same class that overlaps it too much.
      for (let j = i + 1; j < candidateCount; j++) {
        if (suppressed[j]) {
          continue
        }
        const item = candidates[j]
        if (currentBox.index === item.index && DetectionHelpers.iou(currentBox.bbox, item.bbox) >= iouThresh) {
          suppressed[j] = true
        }
      }
    }

    return result
  }

  /**
   * Intersection-over-Union of two [cx,cy,w,h] boxes: overlap area / combined area, 0..1.
   * 0 = no overlap, 1 = identical. Used by NMS to measure how much two boxes overlap.
   */
  static iou(box1: number[], box2: number[]): number {
    const xi1 = Math.max(box1[0] - box1[2] / 2, box2[0] - box2[2] / 2)
    const yi1 = Math.max(box1[1] - box1[3] / 2, box2[1] - box2[3] / 2)

    const xi2 = Math.min(box1[0] + box1[2] / 2, box2[0] + box2[2] / 2)
    const yi2 = Math.min(box1[1] + box1[3] / 2, box2[1] + box2[3] / 2)

    const iarea = Math.max(xi2 - xi1, 0) * Math.max(yi2 - yi1, 0)
    const b1area = box1[2] * box1[3]
    const b2area = box2[2] * box2[3]
    const uarea = b1area + b2area - iarea

    return uarea > 0 ? iarea / uarea : 0
  }

  /** True if the box has 4 finite numbers and positive width/height. */
  private static isValidBox(box: number[]): boolean {
    return (
      box.length >= 4 &&
      isFinite(box[0]) &&
      isFinite(box[1]) &&
      isFinite(box[2]) &&
      isFinite(box[3]) &&
      box[2] > 0 &&
      box[3] > 0
    )
  }

  /** Sort comparator: highest score first. */
  static compareByScoreReversed(a: Detection, b: Detection): number {
    return b.score - a.score
  }

  /** Sort comparator: tallest box first. */
  static compareByHeightReversed(a: Detection, b: Detection): number {
    return b.bbox[3] - a.bbox[3]
  }
}
