import {Detection, DetectionHelpers} from "./DetectionHelpers"

/**
 * YOLODetectionProcessor — turns the raw ONNX model output into clean Detection boxes.
 *
 * The ButterflyDetection.onnx model is a YOLOv7. It does NOT output ready-to-use boxes; it outputs
 * 3 "head" tensors of raw numbers that have to be decoded with anchor boxes + grid math. This class
 * does that decode, then runs NMS to merge duplicates.
 *
 * Model shape (for reference):
 *   input  : images  640x640x3
 *   outputs: 80x80x18, 40x40x18, 20x20x18
 *   18 channels = 3 anchors * (5 + 1 class)  ->  confirms ONE class ("Butterfly").
 *
 * ⚠️ IF BOXES ARE WRONG SIZE/POSITION OR THERE ARE ZERO DETECTIONS ON AN OBVIOUS BUTTERFLY:
 *   the `anchors` and `strides` below must match how the .onnx was exported. They were carried over
 *   from the working pipeline. This is the first place to check.
 */
export class YOLODetectionProcessor {
  private classLabels: string[]
  private scoreThreshold: number
  private iouThreshold: number
  private debugLogging: boolean
  private inputShape!: vec3

  // Anchor boxes (in pixels) per detection head. Model-specific — must match the export.
  private readonly anchors = [
    [
      [144, 300],
      [304, 220],
      [288, 584]
    ],
    [
      [568, 440],
      [768, 972],
      [1836, 1604]
    ],
    [
      [48, 64],
      [76, 144],
      [160, 112]
    ]
  ]

  // Stride (downsample factor) per head — used to map grid cells back to input pixels.
  private readonly strides = [16, 32, 8]

  private grids: [number, number][][][] = [] // precomputed [x,y] grid per head
  private boxes: [number, number, number, number][] = [] // scratch: decoded boxes this frame
  private scores: {cls: number; score: number}[] = [] // scratch: class/score per box this frame

  constructor(classLabels: string[], scoreThreshold: number, iouThreshold: number, debugLogging: boolean) {
    this.classLabels = classLabels
    this.scoreThreshold = scoreThreshold
    this.iouThreshold = iouThreshold
    this.debugLogging = debugLogging
  }

  /**
   * One-time setup once the model is built: precompute the grid coordinates for each output head
   * and remember the model input size.
   */
  public initialize(outputs: OutputPlaceholder[], inputs: InputPlaceholder[]): void {
    this.grids = []
    for (let i = 0; i < outputs.length; i++) {
      const shape = outputs[i].shape
      this.grids.push(this.makeGrid(shape.x, shape.y))
    }

    this.inputShape = inputs[0].shape

    if (this.debugLogging) {
      print(`[YOLO] Initialized with ${outputs.length} outputs`)
      print(`[YOLO] Input shape: ${this.inputShape.x}x${this.inputShape.y}x${this.inputShape.z}`)
      for (let i = 0; i < outputs.length; i++) {
        const shape = outputs[i].shape
        print(`[YOLO] Output ${i}: ${shape.x}x${shape.y}x${shape.z}`)
      }
    }
  }

  /** Build an nx-by-ny grid of [x,y] cell coordinates (used to offset each prediction). */
  private makeGrid(nx: number, ny: number): [number, number][][] {
    const grids: [number, number][][] = []
    for (let dy = 0; dy < ny; dy++) {
      const grid: [number, number][] = []
      for (let dx = 0; dx < nx; dx++) {
        grid.push([dx, dy])
      }
      grids.push(grid)
    }
    return grids
  }

  /**
   * Decode all model outputs into final Detection boxes.
   * Steps: walk every grid cell × anchor, decode xy/wh from the raw values, keep ones above the
   * confidence threshold, then NMS to remove duplicates.
   */
  public parseYolo7Outputs(outputs: OutputPlaceholder[]): Detection[] {
    this.boxes = []
    this.scores = []

    const numHeads = outputs.length
    const classCount = this.classLabels.length

    // Debug counters.
    let totalBoxes = 0
    let boxesOverThreshold = 0
    let highestScore = 0
    let highestScoreClass = -1

    for (let i = 0; i < numHeads; i++) {
      const output = outputs[i]
      const data = output.data
      const shape = output.shape
      const nx = shape.x
      const ny = shape.y
      const step = classCount + 4 + 1 // values per anchor: 4 box + 1 conf + N class

      // Flat tensor layout: [ny][nx][anchors][step]. Walk it cell by cell, anchor by anchor.
      for (let dy = 0; dy < ny; dy++) {
        for (let dx = 0; dx < nx; dx++) {
          for (let da = 0; da < this.anchors.length; da++) {
            totalBoxes++
            const idx = dy * nx * this.anchors.length * step + dx * this.anchors.length * step + da * step

            // 0-1: xy, 2-3: wh, 4: objectness conf, 5+: per-class scores.
            let x = data[idx]
            let y = data[idx + 1]
            let w = data[idx + 2]
            let h = data[idx + 3]
            const conf = data[idx + 4]

            if (conf > highestScore) {
              highestScore = conf
            }

            if (conf > this.scoreThreshold) {
              boxesOverThreshold++

              // YOLOv7 box decode:
              //   center = (raw*2 - 0.5 + gridCell) * stride
              //   size   = (raw*2)^2 * anchor      <-- the *2 factor matters; without it boxes are 4x too small
              x = (x * 2 - 0.5 + this.grids[i][dy][dx][0]) * this.strides[i]
              y = (y * 2 - 0.5 + this.grids[i][dy][dx][1]) * this.strides[i]
              w = (w * 2) * (w * 2) * this.anchors[i][da][0]
              h = (h * 2) * (h * 2) * this.anchors[i][da][1]

              const res = {cls: 0, score: 0}
              // Normalize box back to 0-1 of the input.
              const box: [number, number, number, number] = [
                x / this.inputShape.x,
                y / this.inputShape.y,
                w / this.inputShape.x,
                h / this.inputShape.y
              ]

              // Pick the best class for this box (only 1 class here, but kept general).
              for (let nc = 0; nc < classCount; nc++) {
                const classScore = data[idx + 5 + nc] * conf
                if (classScore > this.scoreThreshold && classScore > res.score) {
                  res.cls = nc
                  res.score = classScore
                  if (classScore > highestScore) {
                    highestScore = classScore
                    highestScoreClass = nc
                  }
                }
              }

              if (res.score > 0) {
                this.boxes.push(box)
                this.scores.push(res)
              }
            }
          }
        }
      }
    }

    if (this.debugLogging) {
      if (this.boxes.length === 0) {
        print(
          `[YOLO] No detections. Examined ${totalBoxes} boxes, ${boxesOverThreshold} over conf threshold. Highest raw conf: ${highestScore.toFixed(
            3
          )}`
        )
        // If we're just under threshold, suggest lowering it.
        if (highestScore > 0 && highestScore < this.scoreThreshold && highestScore > this.scoreThreshold * 0.5) {
          print(`[YOLO] TIP: try lowering scoreThreshold toward ${(highestScore * 0.9).toFixed(3)}`)
        }
      } else {
        print(`[YOLO] Found ${this.boxes.length} detections from ${totalBoxes} potential boxes`)
      }
    }

    // Merge overlapping duplicates, then sort best-first.
    const detections = DetectionHelpers.nms(this.boxes, this.scores, this.scoreThreshold, this.iouThreshold).sort(
      DetectionHelpers.compareByScoreReversed
    )

    // Attach human-readable labels.
    for (let i = 0; i < detections.length; i++) {
      if (this.classLabels.length > detections[i].index && this.classLabels[detections[i].index]) {
        detections[i].label = this.classLabels[detections[i].index]
      }
    }

    return detections
  }
}
