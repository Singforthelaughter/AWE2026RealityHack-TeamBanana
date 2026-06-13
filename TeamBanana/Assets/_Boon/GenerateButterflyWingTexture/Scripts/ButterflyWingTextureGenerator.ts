/**
 * ButterflyWingGenerator — generates procedural wing textures via a Supabase Edge Function.
 *
 * FLOW:
 *   caller provides imageUrl  ->  POST to Supabase Edge Function "generate-wing-texture"
 *   ->  edge function returns { wingTexture, wingOpacityMap } as base64 strings
 *   ->  Base64.decodeTextureAsync() converts both to Lens Studio Texture objects
 *   ->  onComplete(wingTexture, wingOpacityMap) callback fires
 *
 * PUBLIC API:
 *   generateWingTextures(imageUrl, onComplete, onError?)
 *     Call this from any other script that needs wing textures.
 *     Both textures are decoded in parallel; onComplete fires once both are ready.
 *
 * TEST MODE:
 *   Enable runTestModeAtStart in the inspector. All test objects (testTextureImage,
 *   testOpacityImage, testButterfly, timerText) are shown/hidden automatically.
 *   Fill in testImageUrl and the test runs on start, applying results to those objects.
 *   timerText shows live timing: edge function latency, decode time, and total time.
 *
 * EDGE FUNCTION CONTRACT:
 *   POST body:    { imageUrl: string }
 *   Response:     { wingTexture: string, wingOpacityMap: string }  (base64-encoded images)
 *   Deploy name:  generate-wing-texture
 */
import { createClient, type SupabaseClient } from "SupabaseClient.lspkg/supabase-snapcloud"

const TAG = "[ButterflyWingGenerator]"

@component
export class ButterflyWingGenerator extends BaseScriptComponent {
  @input
  @hint("Supabase project asset (URL + public token). Created via the Supabase Plugin's 'Import Credentials'.")
  supabaseProject!: SupabaseProject

  @input
  @hint("Enable to show test objects and automatically run a test call on start")
  runTestModeAtStart: boolean = false

  @input
  testTextureImage!: Image

  @input
  testOpacityImage!: Image

  @input
  @hint("Image URL to test with on start")
  testImageUrl: string = ""

  @input testButterfly!: SceneObject

  @input
  @hint("Text component to display timing info")
  timerText!: Text

  private supabase: SupabaseClient | null = null

  /** Initializes the Supabase client and conditionally runs test mode on start. */
  onAwake(): void {
    print(TAG + " onAwake")
    this.createEvent("OnStartEvent").bind(() => {
      print(TAG + " OnStartEvent fired")
      this.supabase = createClient(this.supabaseProject.url, this.supabaseProject.publicToken)
      print(TAG + " Supabase client created")

      this.setTestObjectsVisible(this.runTestModeAtStart)

      if (this.runTestModeAtStart) {
        this.runTest()
      }
    })
  }

  /** Shows or hides all test-only scene objects based on the given flag. */
  private setTestObjectsVisible(visible: boolean): void {
    if (this.testTextureImage) this.testTextureImage.enabled = visible
    if (this.testOpacityImage) this.testOpacityImage.enabled = visible
    if (this.testButterfly) this.testButterfly.enabled = visible
    if (this.timerText) this.timerText.getSceneObject().enabled = visible
    print(TAG + " Test objects " + (visible ? "enabled" : "disabled"))
  }

  /**
   * Runs a test call using testImageUrl and applies the resulting textures to
   * testTextureImage, testOpacityImage, and testButterfly.
   */
  private runTest(): void {
    if (!this.testImageUrl) {
      print(TAG + " testImageUrl is empty — skipping test")
      return
    }
    print(TAG + " Starting test with URL: " + this.testImageUrl)
    this.generateWingTextures(
      this.testImageUrl,
      (wingTexture, wingOpacityMap) => {
        print(TAG + " onComplete callback received both textures")
        if (this.testTextureImage) {
          this.testTextureImage.mainPass.baseTex = wingTexture
          print(TAG + " wingTexture applied to testTextureImage")
        } else {
          print(TAG + " testTextureImage not assigned")
        }
        if (this.testOpacityImage) {
          this.testOpacityImage.mainPass.baseTex = wingOpacityMap
          print(TAG + " wingOpacityMap applied to testOpacityImage")
        } else {
          print(TAG + " testOpacityImage not assigned")
        }
        if (this.testButterfly) {
          const mesh = this.testButterfly.getChild(2).getComponent("RenderMeshVisual")
          mesh.mainMaterial.mainPass.baseTex = wingTexture
          mesh.mainMaterial.mainPass.opacityTex = wingOpacityMap
        }
      },
      (err) => print(TAG + " Test failed: " + err),
    )
  }

  /** Writes a message to the timerText component if one is assigned. */
  private setTimerText(msg: string): void {
    if (this.timerText) this.timerText.text = msg
  }

  /**
   * Sends imageUrl to the generate-wing-texture edge function and returns two textures.
   * Both Base64 decodes run in parallel; onComplete fires once both are ready.
   *
   * @param imageUrl     Public URL of the source butterfly image.
   * @param onComplete   Called with (wingTexture, wingOpacityMap) when both are ready.
   * @param onError      Optional — called with an error string if any step fails.
   */
  public async generateWingTextures(
    imageUrl: string,
    onComplete: (wingTexture: Texture, wingOpacityMap: Texture) => void,
    onError?: (error: string) => void,
  ): Promise<void> {
    print(TAG + " generateWingTextures called with: " + imageUrl)

    if (!this.supabase) {
      print(TAG + " ERROR: Supabase client not ready")
      onError?.("Supabase client not ready")
      return
    }

    const t0 = Date.now()
    this.setTimerText("Calling edge function...")
    print(TAG + " [t=0ms] Invoking edge function generate-wing-texture...")

    const { data, error } = await this.supabase.functions.invoke<{ wingTexture: string; wingOpacityMap: string }>(
      "generate-wing-texture",
      { body: { imageUrl } },
    )

    const tEdge = Date.now()
    print(TAG + " [t=" + (tEdge - t0) + "ms] Edge function returned")
    this.setTimerText("Edge function: " + (tEdge - t0) + "ms\nDecoding textures...")

    if (error) {
      const msg = "generate-wing-texture error: " + error
      print(TAG + " ERROR: " + msg)
      this.setTimerText("ERROR: " + msg)
      onError?.(msg)
      return
    }

    if (!data || !data.wingTexture || !data.wingOpacityMap) {
      const msg = "Response missing wingTexture or wingOpacityMap"
      print(TAG + " ERROR: " + msg)
      print(TAG + " Raw data: " + JSON.stringify(data))
      this.setTimerText("ERROR: " + msg)
      onError?.(msg)
      return
    }

    print(TAG + " wingTexture b64 length: " + data.wingTexture.length)
    print(TAG + " wingOpacityMap b64 length: " + data.wingOpacityMap.length)

    this.decodeTwoTextures(data.wingTexture, data.wingOpacityMap, t0, tEdge, onComplete, onError)
  }

  /**
   * Decodes two base64 image strings to Lens Studio Textures in parallel.
   * Calls onComplete only after both have successfully decoded.
   * Logs timing breakdowns to both the Logger and timerText.
   */
  private decodeTwoTextures(
    wingTextureB64: string,
    wingOpacityMapB64: string,
    t0: number,
    tEdge: number,
    onComplete: (wingTexture: Texture, wingOpacityMap: Texture) => void,
    onError?: (error: string) => void,
  ): void {
    print(TAG + " Decoding both textures from base64...")
    let wingTexture: Texture | null = null
    let wingOpacityMap: Texture | null = null

    const tryComplete = () => {
      print(TAG + " tryComplete — wingTexture: " + !!wingTexture + ", wingOpacityMap: " + !!wingOpacityMap)
      if (wingTexture && wingOpacityMap) {
        const tDone = Date.now()
        const decodeMs = tDone - tEdge
        const totalMs = tDone - t0
        const summary = "Edge fn: " + (tEdge - t0) + "ms\nDecode: " + decodeMs + "ms\nTotal: " + totalMs + "ms"
        print(TAG + " Done! " + summary.replace(/\n/g, " | "))
        this.setTimerText(summary)
        onComplete(wingTexture, wingOpacityMap)
      }
    }

    Base64.decodeTextureAsync(
      wingTextureB64,
      (texture) => {
        print(TAG + " wingTexture decoded successfully")
        wingTexture = texture
        tryComplete()
      },
      () => {
        print(TAG + " ERROR: Failed to decode wingTexture")
        onError?.("Failed to decode wingTexture")
      },
    )

    Base64.decodeTextureAsync(
      wingOpacityMapB64,
      (texture) => {
        print(TAG + " wingOpacityMap decoded successfully")
        wingOpacityMap = texture
        tryComplete()
      },
      () => {
        print(TAG + " ERROR: Failed to decode wingOpacityMap")
        onError?.("Failed to decode wingOpacityMap")
      },
    )
  }
}
