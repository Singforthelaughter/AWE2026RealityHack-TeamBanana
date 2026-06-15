import {MLSpatializer} from "_Aggy/Scripts/MLSpatializer"
import {Detection} from "_Aggy/Scripts/DetectionHelpers"

/**
 * Cleaned-up detection result returned to agents.
 * Omits raw YOLO internals — only what agents need to describe what's visible.
 */
export type ButterflyDetection = {
  label: string
  confidence: number
  bbox: [number, number, number, number] // [centerX, centerY, width, height] normalized 0-1
}

export type ButterflyDetectionResult = {
  detected: boolean
  detections: ButterflyDetection[]
  message: string
}

/**
 * ButterflyDetectionTool — on-demand butterfly spotting via the YOLO camera pipeline.
 *
 * Triggers MLSpatializer inference only when the user asks (e.g. "can you help me
 * spot butterflies?"). Runs one detection pass, returns results, then pauses the
 * model to save battery. No per-frame overhead when nobody is looking.
 */
export class ButterflyDetectionTool {
  public readonly name = "butterfly_detection"
  public readonly description =
    "Use the camera to look for butterflies right now. Returns what butterflies are visible, their positions on screen, and confidence scores."

  public readonly parameters = {
    type: "object",
    properties: {
      maxDetections: {
        type: "number",
        description: "Maximum butterflies to report (default 5)",
        default: 5
      }
    },
    required: []
  }

  private mlSpatializer: MLSpatializer

  /**
   * @param mlSpatializer — MLSpatializer component. Must be wired in the Inspector.
   */
  constructor(mlSpatializer: MLSpatializer) {
    this.mlSpatializer = mlSpatializer
    print("ButterflyDetectionTool: Initialized")
  }

  public async execute(args: Record<string, unknown>): Promise<{
    success: boolean
    result?: ButterflyDetectionResult
    error?: string
    executionTime: number
  }> {
    const startTime = Date.now()
    try {
      const maxDetections = (args.maxDetections as number) ?? 5

      print(`ButterflyDetectionTool: Running on-demand detection — maxDetections: ${maxDetections}`)

      // Trigger one inference pass on-demand (pauses the model afterward)
      const detections = await this.mlSpatializer.runOnce(5000)

      if (!detections || detections.length === 0) {
        const result: ButterflyDetectionResult = {
          detected: false,
          detections: [],
          message: "I don't see any butterflies right now. Try looking around slowly — they might be resting on nearby flowers or leaves."
        }
        return {
          success: true,
          result,
          executionTime: Date.now() - startTime
        }
      }

      // Map raw detections to clean result type, capped at maxDetections
      const limitedDetections = detections.slice(0, Math.min(maxDetections, 20))
      const butterflyDetections: ButterflyDetection[] = limitedDetections.map((d: Detection) => ({
        label: d.label,
        confidence: d.score,
        bbox: [d.bbox[0], d.bbox[1], d.bbox[2], d.bbox[3]]
      }))

      // Build human-readable message
      const message = this.buildDetectionMessage(butterflyDetections)

      const result: ButterflyDetectionResult = {
        detected: true,
        detections: butterflyDetections,
        message
      }

      print(`ButterflyDetectionTool: Found ${butterflyDetections.length} detection(s)`)

      return {
        success: true,
        result,
        executionTime: Date.now() - startTime
      }
    } catch (error) {
      print(`ButterflyDetectionTool: ERROR — ${error}`)
      return {
        success: false,
        error: `Butterfly detection failed: ${error}`,
        executionTime: Date.now() - startTime
      }
    }
  }

  /**
   * Build a natural-language summary of detections for agents to use inline.
   */
  public buildDetectionMessage(detections: ButterflyDetection[]): string {
    if (detections.length === 0) {
      return "I don't see any butterflies right now."
    }

    if (detections.length === 1) {
      const d = detections[0]
      return `I can see 1 butterfly: a ${d.label} (${Math.round(d.confidence * 100)}% confidence).`
    }

    const parts = detections.map(
      (d) => `${d.label} (${Math.round(d.confidence * 100)}%)`
    )
    return `I can see ${detections.length} butterflies: ${parts.join(", ")}.`
  }

  /**
   * Format the full detection result for agent prompt context.
   */
  public formatDetectionSummary(result: ButterflyDetectionResult): string {
    let summary = result.message

    if (result.detected && result.detections.length > 0) {
      summary += "\n\nTo identify a specific butterfly, ask me 'what is this one?' while looking at it."
    }

    return summary
  }
}
