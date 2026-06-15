import { createClient, type SupabaseClient } from "SupabaseClient.lspkg/supabase-snapcloud"
import { setTimeout, clearTimeout } from "SpectaclesInteractionKit.lspkg/Utils/FunctionTimingUtils"
import { IDResponse, Suggestion } from "_Aggy/Scripts/KindwiseTypes"

/**
 * Cleaned-up identification result returned to agents.
 * Omits internal Kindwise details — only what agents need for responses.
 */
export type ButterflyIdentificationResult = {
  scientificName: string | null
  commonName: string | null
  probability: number
}

/**
 * ButterflyIdentificationTool — triggers butterfly species identification via the camera.
 *
 * Self-contained in _Joe: captures a camera frame via VideoController (same mechanism
 * GeminiAssistant uses), sends it to the Kindwise insect API via Supabase Edge Function,
 * and returns the top species match.
 *
 * References Agrika's ButterflyIdentifier for Supabase config only — reads its public
 * `supabaseProject` and `functionName` fields. No modification to _Aggy code.
 *
 * Works in BOTH Lens Studio Preview and on-device (VideoController, unlike
 * CameraModule.requestImage, is not device-only).
 */
export class ButterflyIdentificationTool {
  public readonly name = "butterfly_identification"
  public readonly description =
    "Take a photo and identify a butterfly species using AI-powered insect recognition. Returns the species name, common name, and confidence."

  public readonly parameters = {
    type: "object",
    properties: {
      timeout: {
        type: "number",
        description: "Maximum seconds to wait for identification (default 15)",
        default: 15
      }
    },
    required: []
  }

  private supabaseUrl: string
  private supabaseToken: string
  private functionName: string
  private supabase: SupabaseClient | null = null

  /**
   * Optional callbacks to pause/resume an external video stream (e.g., Gemini Live)
   * while this tool captures a camera frame. Only one VideoController can record at a time.
   */
  public onPauseVideo: (() => void) | null = null
  public onResumeVideo: (() => void) | null = null

  /**
   * Optional frame provider. If set, the tool tries to grab a cached frame first
   * (e.g. from Gemini Live's video stream) instead of starting its own VideoController.
   * Falls back to direct camera capture if the provider returns null.
   */
  public getSharedFrame: (() => string | null) | null = null

  /**
   * @param butterflyIdentifier — Agrika's ButterflyIdentifier component (read for config only, not modified).
   *        Reads `supabaseProject` (url + publicToken) and `functionName` from its public inputs.
   */
  constructor(butterflyIdentifier: any) {
    // Read Supabase config from ButterflyIdentifier's public inspector inputs
    const project = butterflyIdentifier.supabaseProject
    this.supabaseUrl = project?.url ?? ""
    this.supabaseToken = project?.publicToken ?? ""
    this.functionName = butterflyIdentifier.functionName ?? "identify-butterfly"

    if (!this.supabaseUrl || !this.supabaseToken) {
      print("ButterflyIdentificationTool: WARNING — no Supabase config found on ButterflyIdentifier. Tool will fail at execute.")
    }

    print("ButterflyIdentificationTool: Initialized (function: " + this.functionName + ")")
  }

  public async execute(args: Record<string, unknown>): Promise<{
    success: boolean
    result?: ButterflyIdentificationResult
    error?: string
    executionTime: number
  }> {
    const startTime = Date.now()
    try {
      print("ButterflyIdentificationTool: Executing — capturing camera frame")

      // Use CameraModule.requestImage() for a high-res still photo.
      // This uses a separate camera pipeline from VideoController — no conflict
      // with Gemini Live's video stream. Works on real Spectacles (device only).
      let base64Image: string | null = null

      try {
        const cameraModule = require("LensStudio:CameraModule")
        const imageRequest = CameraModule.createImageRequest()
        const imageFrame = await cameraModule.requestImage(imageRequest)

        base64Image = await new Promise<string>((resolve, reject) => {
          Base64.encodeTextureAsync(
            imageFrame.texture,
            (encoded: string) => resolve(encoded),
            () => reject(new Error("Failed to encode image")),
            CompressionQuality.HighQuality,
            EncodingType.Jpg,
          )
        })

        print(`ButterflyIdentificationTool: High-res still captured (${base64Image.length} chars)`)
      } catch (stillError) {
        print(`ButterflyIdentificationTool: Still capture failed: ${stillError} — trying shared frame fallback...`)

        // Fallback: grab a cached frame from Gemini Live's video stream.
        if (this.getSharedFrame) {
          base64Image = this.getSharedFrame()
          if (base64Image) {
            print("ButterflyIdentificationTool: Using shared frame from Gemini Live")
          }
        }
      }

      print("ButterflyIdentificationTool: Frame ready, sending to Kindwise...")

      // 2. Lazy-init Supabase client and call the Edge Function
      if (!this.supabase) {
        this.supabase = createClient(this.supabaseUrl, this.supabaseToken)
      }

      const { data, error } = await this.supabase.functions.invoke<IDResponse>(this.functionName, {
        body: { image: "data:image/jpeg;base64," + base64Image },
      })

      if (error) {
        return {
          success: false,
          error: "Identification API error: " + error,
          executionTime: Date.now() - startTime
        }
      }

      // 3. Parse the Kindwise response
      const suggestions = data?.result?.classification?.suggestions
      if (!suggestions || suggestions.length === 0) {
        return {
          success: true,
          result: {
            scientificName: null,
            commonName: null,
            probability: 0
          },
          executionTime: Date.now() - startTime
        }
      }

      const top = suggestions[0] as Suggestion
      const commonNames = top.details?.common_names
      const common = commonNames && commonNames.length > 0 ? commonNames[0] : null

      const result: ButterflyIdentificationResult = {
        scientificName: top.name,
        commonName: common,
        probability: top.probability
      }

      print(
        `ButterflyIdentificationTool: Identified as "${common ?? top.name}" ` +
        `(${Math.round(top.probability * 100)}% confidence)`
      )

      return {
        success: true,
        result,
        executionTime: Date.now() - startTime
      }
    } catch (error) {
      print(`ButterflyIdentificationTool: ERROR — ${error}`)
      return {
        success: false,
        error: `Butterfly identification failed: ${error}`,
        executionTime: Date.now() - startTime
      }
    }
  }

  /**
   * Format the identification result as a human-readable summary for agents to inject
   * into their LLM prompt context.
   */
  public formatIdentificationSummary(result: ButterflyIdentificationResult): string {
    if (!result.scientificName) {
      return "No butterfly was identified in the photo."
    }

    const name = result.commonName
      ? `${result.commonName} (${result.scientificName})`
      : result.scientificName

    const confidence = Math.round(result.probability * 100)

    return `Butterfly identified as ${name} with ${confidence}% confidence.`
  }
}
