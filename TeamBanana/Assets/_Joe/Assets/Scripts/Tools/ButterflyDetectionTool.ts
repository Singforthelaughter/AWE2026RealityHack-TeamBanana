import {setTimeout} from "SpectaclesInteractionKit.lspkg/Utils/FunctionTimingUtils"
import {MLSpatializer} from "_Aggy/Scripts/MLSpatializer"
import {Detection, DetectionHelpers} from "_Aggy/Scripts/DetectionHelpers"
import {ButterflyIdentificationTool, ButterflyIdentificationResult} from "./ButterflyIdentificationTool"

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
  scanDurationMs: number
  message: string
  // Auto-triggered identification result when butterflies are found during the scan.
  identification?: ButterflyIdentificationResult
}

/**
 * ButterflyDetectionTool — on-demand butterfly scanning via the YOLO camera pipeline.
 *
 * "help me scan for butterflies" triggers a 10-second scan. The YOLO model runs
 * continuously during the scan window. If any butterflies are detected, a camera
 * frame is automatically sent to the Kindwise identification API.
 *
 * No bounding boxes are drawn — this is a pure detection+identification pipeline
 * with voice/text output only.
 */
export class ButterflyDetectionTool {
  public readonly name = "butterfly_detection"
  public readonly description =
    "Scan for butterflies using the camera for 10 seconds. If butterflies are found, automatically identify the species."

  public readonly parameters = {
    type: "object",
    properties: {
      scanDurationMs: {
        type: "number",
        description: "How long to scan in milliseconds (default 10000 = 10 seconds)",
        default: 10000
      },
      maxDetections: {
        type: "number",
        description: "Maximum unique butterflies to report (default 5)",
        default: 5
      },
      autoIdentify: {
        type: "boolean",
        description: "Automatically run identification if butterflies are found (default true)",
        default: true
      }
    },
    required: []
  }

  private mlSpatializer: MLSpatializer
  private identificationTool: ButterflyIdentificationTool | null

  /**
   * @param mlSpatializer — MLSpatializer component for on-device YOLO inference.
   * @param identificationTool — optional ButterflyIdentificationTool for auto-ID when butterflies are found.
   */
  constructor(mlSpatializer: MLSpatializer, identificationTool?: ButterflyIdentificationTool) {
    this.mlSpatializer = mlSpatializer
    this.identificationTool = identificationTool ?? null
    print("ButterflyDetectionTool: Initialized" + (identificationTool ? " (with auto-ID)" : " (detection only)"))
  }

  public async execute(args: Record<string, unknown>): Promise<{
    success: boolean
    result?: ButterflyDetectionResult
    error?: string
    executionTime: number
  }> {
    const startTime = Date.now()
    try {
      const scanDurationMs = (args.scanDurationMs as number) ?? 10000
      const maxDetections = (args.maxDetections as number) ?? 5
      const autoIdentify = (args.autoIdentify as boolean) ?? true

      print(`ButterflyDetectionTool: Starting ${scanDurationMs}ms scan...`)

      // 1. Start continuous YOLO inference.
      this.mlSpatializer.setScheduled(true)

      // 2. Collect detections over the scan duration.
      const allDetections: Detection[] = []

      await new Promise<void>((resolve) => {
        const handler = (detections: Detection[]) => {
          if (detections.length > 0) {
            for (const d of detections) {
              allDetections.push(new Detection([...d.bbox] as [number, number, number, number], d.score, d.index, d.label))
            }
          }
        }

        this.mlSpatializer.getDetectionsUpdatedEvent().add(handler)

        const timer = setTimeout(() => {
          this.mlSpatializer.getDetectionsUpdatedEvent().remove(handler)
          resolve()
        }, scanDurationMs)
      })

      // 3. Always stop inference when done — battery is precious on Spectacles.
      this.mlSpatializer.setScheduled(false)

      // 4. Deduplicate detections across frames (same butterfly seen multiple times).
      const uniqueDetections = this.deduplicateDetections(allDetections, maxDetections)

      // Map to clean result type.
      const butterflyDetections: ButterflyDetection[] = uniqueDetections.map((d) => ({
        label: d.label,
        confidence: d.score,
        bbox: [d.bbox[0], d.bbox[1], d.bbox[2], d.bbox[3]]
      }))

      // 5. Auto-identify if butterflies were found and the ID tool is wired.
      let identification: ButterflyIdentificationResult | undefined
      if (butterflyDetections.length > 0 && autoIdentify && this.identificationTool) {
        print("ButterflyDetectionTool: Butterflies detected! Auto-triggering identification...")
        const idResult = await this.identificationTool.execute({})
        if (idResult.success && idResult.result) {
          identification = idResult.result
          print(
            `ButterflyDetectionTool: Auto-ID result: ` +
            `${identification.commonName ?? identification.scientificName ?? "Unknown"} ` +
            `(${Math.round(identification.probability * 100)}%)`
          )
        } else {
          print(`ButterflyDetectionTool: Auto-ID failed or returned no match: ${idResult.error ?? "no species found"}`)
        }
      }

      // 6. Build human-readable summary message.
      const message = this.buildResultMessage(butterflyDetections, identification)

      const result: ButterflyDetectionResult = {
        detected: butterflyDetections.length > 0,
        detections: butterflyDetections,
        scanDurationMs,
        message,
        identification
      }

      const elapsed = Date.now() - startTime
      print(`ButterflyDetectionTool: Scan complete — ${butterflyDetections.length} unique detection(s) in ${elapsed}ms`)

      return {
        success: true,
        result,
        executionTime: elapsed
      }
    } catch (error) {
      // Ensure ML is stopped even on error — don't leave the GPU running.
      try { this.mlSpatializer.setScheduled(false) } catch (_) {}
      print(`ButterflyDetectionTool: ERROR — ${error}`)
      return {
        success: false,
        error: `Butterfly scanning failed: ${error}`,
        executionTime: Date.now() - startTime
      }
    }
  }

  /**
   * Merge frame-to-frame detections of the same butterfly using IoU overlap.
   * A detection from a new frame that overlaps an already-tracked unique detection
   * by > 50% is treated as the same butterfly — the higher-confidence box wins.
   * Returns the top `maxDetections` sorted by confidence descending.
   */
  private deduplicateDetections(detections: Detection[], maxDetections: number): Detection[] {
    if (detections.length === 0) return []

    const unique: Detection[] = []

    for (const det of detections) {
      let matched = false
      for (const u of unique) {
        if (DetectionHelpers.iou(det.bbox, u.bbox) >= 0.5) {
          matched = true
          // Keep the higher-confidence box for this butterfly.
          if (det.score > u.score) {
            u.score = det.score
            u.bbox = [...det.bbox] as [number, number, number, number]
          }
          break
        }
      }
      if (!matched) {
        unique.push(new Detection(
          [...det.bbox] as [number, number, number, number],
          det.score,
          det.index,
          det.label
        ))
      }
    }

    // Highest confidence first, capped at maxDetections.
    unique.sort((a, b) => b.score - a.score)
    return unique.slice(0, maxDetections)
  }

  /**
   * Build a natural-language summary combining detection + optional identification.
   */
  private buildResultMessage(
    detections: ButterflyDetection[],
    identification?: ButterflyIdentificationResult
  ): string {
    if (detections.length === 0) {
      return "I scanned for 10 seconds and didn't spot any butterflies. Try looking around slowly — they might be resting on nearby flowers or leaves."
    }

    let msg = ""

    // Detection summary
    if (detections.length === 1) {
      const d = detections[0]
      msg = `I spotted 1 butterfly: a ${d.label} (${Math.round(d.confidence * 100)}% confidence).`
    } else {
      const parts = detections.map(
        (d) => `${d.label} (${Math.round(d.confidence * 100)}%)`
      )
      msg = `I spotted ${detections.length} butterflies: ${parts.join(", ")}.`
    }

    // Identification result (if auto-ID ran)
    if (identification) {
      if (identification.scientificName) {
        const name = identification.commonName
          ? `${identification.commonName} (${identification.scientificName})`
          : identification.scientificName
        const pct = Math.round(identification.probability * 100)
        msg += ` I took a closer look — it's a ${name} (${pct}% confidence).`
      } else {
        msg += " I tried to identify it but couldn't get a clear match."
      }
    } else if (detections.length > 0) {
      msg += " To identify a specific one, ask me 'what is this butterfly?' while looking at it."
    }

    return msg
  }

  /**
   * Build a human-readable detection summary for agent prompt context.
   */
  public buildDetectionMessage(detections: ButterflyDetection[]): string {
    return this.buildResultMessage(detections)
  }

  /**
   * Format the full detection result for agent prompt context injection.
   */
  public formatDetectionSummary(result: ButterflyDetectionResult): string {
    let summary = result.message

    if (result.detected && result.detections.length > 0 && !result.identification) {
      summary += "\n\nTo identify a specific butterfly, ask me 'what is this one?' while looking at it."
    }

    if (result.identification && result.identification.scientificName) {
      const name = result.identification.commonName
        ? `${result.identification.commonName} (${result.identification.scientificName})`
        : result.identification.scientificName
      summary += `\n\nSpecies identified: ${name} (${Math.round(result.identification.probability * 100)}% confidence).`
    }

    return summary
  }
}
