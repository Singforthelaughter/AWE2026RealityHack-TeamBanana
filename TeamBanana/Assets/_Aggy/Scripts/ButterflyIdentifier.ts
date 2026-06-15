import { createClient, type SupabaseClient } from "SupabaseClient.lspkg/supabase-snapcloud"
import { IDResponse, Suggestion } from "./KindwiseTypes"
import { SupabaseDBManager } from "../../_Boon/SupabaseInfoStoring&Retrieving/Scripts/SupabaseDBManager"
import { ButterflyWingGenerator } from "../../_Boon/GenerateButterflyWingTexture/Scripts/ButterflyWingTextureGenerator"
import { ButterflyInfoDisplayManager } from "../../_Boon/ButterflyInfoDisplay/Scripts/ButterflyInfoDisplayManager"

/**
 * ButterflyIdentifier — the identification half of the pipeline.
 *
 * FLOW: call identify() -> take a high-res photo -> send it to a Supabase Edge Function -> the
 * function calls Kindwise and returns the species -> show it in `resultText` + the info card.
 *
 *   identify()  ->  CameraModule.requestImage()  ->  Base64  ->
 *   supabase.functions.invoke("identify-butterfly", { image })  ->  IDResponse  ->  show name
 *
 * Trigger identify() however you like — auto-detection, a button, or an agentic Gemini route.
 *
 * ⚠️ DEVICE ONLY: `CameraModule.requestImage` (high-res capture) does NOT work in Lens Studio
 * Preview - you'll see "Image request not supported" / "Login to My Lenses". Test on real Spectacles.
 *
 * The Kindwise API key lives in Supabase secrets (server-side), never in this lens.
 */
@component
export class ButterflyIdentifier extends BaseScriptComponent {
  @input
  @hint("Supabase project asset (URL + public token). Created via the Supabase Plugin's 'Import Credentials'.")
  supabaseProject!: SupabaseProject

  @input
  @hint("Name of the Supabase Edge Function that processes the image and calls Kindwise")
  functionName: string = "identify-butterfly"

  @input
  @allowUndefined
  @hint("Optional Text to show the result (e.g. 'Capturing...' then the species). Can be left empty.")
  resultText: Text | null = null

  @input
  @hint("Log activity to the Logger panel")
  debugLogging: boolean = true

  @ui.separator
  @input
  @hint("SupabaseDBManager component for storing sightings to the database")
  dbManager!: SupabaseDBManager

  @input
  @hint("ButterflyWingGenerator component for generating procedural wing textures")
  wingGenerator!: ButterflyWingGenerator

  @input
  @hint("ButterflyInfoDisplayManager component for displaying identification results in a prefab")
  infoDisplay!: ButterflyInfoDisplayManager

  // Built-in Spectacles modules (resolved at construction).
  private cameraModule = require("LensStudio:CameraModule") // high-res still capture

  private supabase: SupabaseClient | null = null
  private busy: boolean = false // guard so we don't fire a second identification mid-flight
  private lastCapturedTexture: Texture | null = null

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.start())
  }

  /** Create the Supabase client. */
  private start(): void {
    this.supabase = createClient(this.supabaseProject.url, this.supabaseProject.publicToken)
  }

  /**
   * Public entry point - kicks off capture -> send -> show.
   * Call this from auto-detection, a button (Interactable onTrigger), or an agentic Gemini route.
   */
  public identify(): void {
    if (this.busy) {
      return // already identifying; ignore re-triggers
    }
    this.busy = true
    this.setResult("Capturing...")
    this.captureAndSend()
  }

  /** Take a high-res still photo, then hand it to the encoder. (Device only.) */
  private async captureAndSend(): Promise<void> {
    try {
      const imageRequest = CameraModule.createImageRequest()
      const imageFrame = await this.cameraModule.requestImage(imageRequest)
      this.encode(imageFrame.texture)
    } catch (e) {
      this.fail("Capture failed: " + e)
    }
  }

  /** JPEG-encode the captured texture to Base64, then send it to Supabase. */
  private encode(texture: Texture): void {
    this.lastCapturedTexture = texture
    Base64.encodeTextureAsync(
      texture,
      (base64String: string) => this.sendToSupabase(base64String),
      () => this.fail("Failed to encode image"),
      CompressionQuality.HighQuality,
      EncodingType.Jpg,
    )
  }

  /** Invoke the Edge Function with the image and display whatever species it returns. */
  private async sendToSupabase(base64String: string): Promise<void> {
    if (!this.supabase) {
      this.fail("Supabase client not ready")
      return
    }
    this.setResult("Identifying...")
    try {
      const { data, error } = await this.supabase.functions.invoke<IDResponse>(this.functionName, {
        body: { image: "data:image/jpeg;base64," + base64String },
      })
      this.busy = false
      if (error) {
        this.fail("Function error: " + error)
        return
      }
      this.showResult(data)
    } catch (e) {
      this.fail("Send failed: " + e)
    }
  }

  /** Pull the top suggestion from the IDResponse, show its name, then generate wing textures and store the sighting. */
  private async showResult(data: IDResponse | null): Promise<void> {
    const suggestions = data && data.result && data.result.classification ? data.result.classification.suggestions : null
    if (!suggestions || suggestions.length === 0) {
      this.setResult("No butterfly identified")
      return
    }
    const top = suggestions[0] as Suggestion
    const commonNames = top.details ? top.details.common_names : null
    const common = commonNames && commonNames.length > 0 ? commonNames[0] : null
    const display = common ? common + " (" + top.name + ")" : top.name
    const percent = Math.round(top.probability * 100)
    this.setResult(display + " - " + percent + "%")
    if (this.debugLogging) {
      print("[ButterflyId] " + display + " " + percent + "%")
    }

    this.infoDisplay?.displayResult(top, this.lastCapturedTexture)

    //added by boon
    const { wingTexture, wingOpacityMap } = await this.generateWingTexturesAndStoreSighting(top)
    //instantiate 3d butterfly here with generated texture
    /**Code to instantiate 3d butterfly*/
  }

  /**
   * Generates procedural wing textures for the identified species, then stores the sighting.
   * Uses the species image URL from the Kindwise result as the source for wing generation.
   * Falls back to storing without wing textures if no image URL is available or wingGenerator is unset.
   * Returns the generated textures once the sighting is stored, or null for both if unavailable.
   */
  private async generateWingTexturesAndStoreSighting(top: Suggestion): Promise<{ wingTexture: Texture | null; wingOpacityMap: Texture | null }> {
    const isBlockedUrl = (url: string) =>
      url.indexOf("/knowledge_base/wikidata/") !== -1 ||
      url.indexOf("/knowledge_base/wikipedia/") !== -1
    const detailsUrl = top.details?.image?.value
    const imageUrl =
      (detailsUrl && !isBlockedUrl(detailsUrl) ? detailsUrl : null) ??
      top.similar_images?.find((img) => img.url && !isBlockedUrl(img.url))?.url ??
      null
    if (imageUrl && this.wingGenerator) {
      const textures = await new Promise<{ wingTexture: Texture; wingOpacityMap: Texture; wingTextureB64: string; wingOpacityMapB64: string } | null>((resolve) => {
        this.wingGenerator.generateWingTextures(
          imageUrl,
          (wingTexture, wingOpacityMap, wingTextureB64, wingOpacityMapB64) => resolve({ wingTexture, wingOpacityMap, wingTextureB64, wingOpacityMapB64 }),
          (err) => {
            if (this.debugLogging) {
              print("[ButterflyId] Wing generation failed: " + err)
            }
            resolve(null)
          },
        )
      })

      if (this.debugLogging) {
        print("[ButterflyId] Wing textures " + (textures ? "generated for " + top.name : "unavailable"))
      }

      if (this.dbManager) {
        const record = await this.dbManager.storeSighting({
          suggestion: top,
          photoTexture: this.lastCapturedTexture,
          wingTextureBase64: textures?.wingTextureB64,
          wingOpacityMapBase64: textures?.wingOpacityMapB64,
        })
        if (this.debugLogging) {
          print("[ButterflyId] storeSighting " + (record ? "OK: " + record.photo_url : "failed"))
        }
      }

      return { wingTexture: textures?.wingTexture ?? null, wingOpacityMap: textures?.wingOpacityMap ?? null }
    }

    if (this.dbManager) {
      const record = await this.dbManager.storeSighting({
        suggestion: top,
        photoTexture: this.lastCapturedTexture,
        wingTexture: null,
        wingOpacityMap: null,
      })
      if (this.debugLogging) {
        print("[ButterflyId] storeSighting (no wing textures) " + (record ? "OK" : "failed"))
      }
    }

    return { wingTexture: null, wingOpacityMap: null }
  }

  /** Clear the busy flag, log, and show an error message in the result text. */
  private fail(message: string): void {
    this.busy = false
    if (this.debugLogging) {
      print("[ButterflyId] " + message)
    }
    this.setResult(message)
  }

  /** Write a line into the optional result Text, if one is assigned. */
  private setResult(text: string): void {
    if (this.resultText) {
      this.resultText.text = text
    }
  }
}
