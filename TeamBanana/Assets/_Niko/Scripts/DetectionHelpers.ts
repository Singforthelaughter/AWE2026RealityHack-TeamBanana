/**
 * Class representing a detection.
 */
export class Detection {
  bbox: [number, number, number, number]
  score: number
  index: number
  label: string

  /**
   * @param {[number, number, number, number]} bbox - bbox coordinates in screen space
   * @param {number} score - detection score
   * @param {number} index - class index
   * @param {string} [label] - class label
   */
  constructor(bbox: [number, number, number, number], score: number, index: number, label?: string) {
    this.bbox = bbox
    this.score = score
    this.index = index
    this.label = label === undefined ? "class_" + index : label
  }

  /**
   * @returns {string}
   */
  toString(): string {
    return `Class: ${this.label} Score: ${this.score.toFixed(5)} Bounding Box: ${this.bbox}`
  }

  /**
   * @returns {Rect}
   */
  getScreenRect(): Rect {
    // bbox - x, y, w, h
    const x = this.bbox[0] * 2.0 - 1.0
    const y = 1.0 - 2 * this.bbox[1]
    // bbox is in screen space, rect is in local space
    return Rect.create(x - this.bbox[2], x + this.bbox[2], y - this.bbox[3], y + this.bbox[3])
  }

  /**
   * @returns {vec2}
   */
  getScreenPos(): vec2 {
    // bbox - x, y, w, h
    return new vec2(this.bbox[0], this.bbox[1])
  }
}

export class DetectionHelpers {
  // NmsIou.ts
  // Version: 0.0.1
  // Event: OnAwake
  // Description: Implements non-maximum suppression and intersection over union algorithms.

  /**
   * Non-maximum suppression algorithm.
   * @param {number[][]} boxes
   * @param {{ cls: number, score: number }[]} scores
   * @param {number} scoreThresh
   * @param {number} iouThresh
   * @returns {Detection[]}
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

    candidates.sort(DetectionHelpers.compareByScoreReversed)
    const candidateCount = Math.min(candidates.length, maxCandidates)

    const suppressed: boolean[] = []
    for (let i = 0; i < candidateCount; i++) {
      if (suppressed[i]) {
        continue
      }

      const currentBox = candidates[i]
      result.push(currentBox)

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
   * Computes the intersection over union of two boxes.
   * @param {number[]} box1
   * @param {number[]} box2
   * @returns {number}
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

  /**
   * Compares two detections by score in descending order.
   * @param {Detection} a
   * @param {Detection} b
   * @returns {number}
   */
  static compareByScoreReversed(a: Detection, b: Detection): number {
    return b.score - a.score
  }

  static compareByHeightReversed(a: Detection, b: Detection): number {
    return b.bbox[3] - a.bbox[3]
  }

  onAwake() {}
}
