import { createClient, type SupabaseClient } from "SupabaseClient.lspkg/supabase-snapcloud"
import { IDResponse, Suggestion } from "../../../_Aggy/Scripts/KindwiseTypes"
import { SupabaseDBManager } from "../../SupabaseInfoStoring&Retrieving/Scripts/SupabaseDBManager"
import { ButterflyWingGenerator } from "../../GenerateButterflyWingTexture/Scripts/ButterflyWingTextureGenerator"
import { ButterflyInfoDisplayManager } from "./ButterflyInfoDisplayManager"

@component
export class InsectIDAPITestScript extends BaseScriptComponent {
  @input
  @hint("Supabase project asset (URL + public token).")
  supabaseProject!: SupabaseProject

  @input
  @hint("Name of the Supabase Edge Function that processes the image and calls Kindwise")
  functionName: string = "identify-butterfly"

  @input
  @hint("Texture to use as the butterfly photo input instead of the camera")
  inputTexture!: Texture

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
  infoDisplay: ButterflyInfoDisplayManager | null = null

  private supabase: SupabaseClient | null = null
  private busy: boolean = false

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.start())
  }

  private start(): void {
    this.supabase = createClient(this.supabaseProject.url, this.supabaseProject.publicToken)
    this.identify()
  }

  public identify(): void {
    if (this.busy) return
    if (!this.inputTexture) {
      this.fail("No input texture assigned")
      return
    }
    this.busy = true
    this.encode(this.inputTexture)
  }

  private encode(texture: Texture): void {
    Base64.encodeTextureAsync(
      texture,
      (base64String: string) => this.sendToSupabase(base64String),
      () => this.fail("Failed to encode image"),
      CompressionQuality.HighQuality,
      EncodingType.Jpg,
    )
  }

  private async sendToSupabase(base64String: string): Promise<void> {
    if (!this.supabase) {
      this.fail("Supabase client not ready")
      return
    }
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

  private async showResult(data: IDResponse | null): Promise<void> {
    const suggestions = data && data.result && data.result.classification ? data.result.classification.suggestions : null
    if (!suggestions || suggestions.length === 0) {
      return
    }
    const top = suggestions[0] as Suggestion
    const commonNames = top.details ? top.details.common_names : null
    const common = commonNames && commonNames.length > 0 ? commonNames[0] : null
    const display = common ? common + " (" + top.name + ")" : top.name
    const percent = Math.round(top.probability * 100)
    if (this.debugLogging) {
      print("[InsectIDTest] " + display + " " + percent + "%")
    }

    this.infoDisplay?.displayResult(top, this.inputTexture)

    // await this.generateWingTexturesAndStoreSighting(top)
  }

  private async generateWingTexturesAndStoreSighting(top: Suggestion): Promise<{ wingTexture: Texture | null; wingOpacityMap: Texture | null }> {
    const isBlockedUrl = (url: string) => url.indexOf("/knowledge_base/wikidata/") !== -1 || url.indexOf("/knowledge_base/wikipedia/") !== -1
    const detailsUrl = top.details?.image?.value
    const imageUrl = (detailsUrl && !isBlockedUrl(detailsUrl) ? detailsUrl : null) ?? top.similar_images?.find((img) => img.url && !isBlockedUrl(img.url))?.url ?? null
    if (this.debugLogging) print("[InsectIDTest] Wing texture imageUrl: " + (imageUrl ?? "none"))
    if (imageUrl && this.wingGenerator) {
      const textures = await new Promise<{ wingTexture: Texture; wingOpacityMap: Texture; wingTextureB64: string; wingOpacityMapB64: string } | null>((resolve) => {
        this.wingGenerator.generateWingTextures(
          imageUrl,
          (wingTexture, wingOpacityMap, wingTextureB64, wingOpacityMapB64) => resolve({ wingTexture, wingOpacityMap, wingTextureB64, wingOpacityMapB64 }),
          (err: string) => {
            if (this.debugLogging) {
              print("[InsectIDTest] Wing generation failed: " + err)
            }
            resolve(null)
          },
        )
      })

      if (this.debugLogging) {
        print("[InsectIDTest] Wing textures " + (textures ? "generated for " + top.name : "unavailable"))
      }

      if (this.dbManager) {
        const record = await this.dbManager.storeSighting({
          suggestion: top,
          photoTexture: this.inputTexture,
          wingTextureBase64: textures?.wingTextureB64,
          wingOpacityMapBase64: textures?.wingOpacityMapB64,
        })
        if (this.debugLogging) {
          print("[InsectIDTest] storeSighting " + (record ? "OK: " + record.photo_url : "failed"))
        }
      }

      return { wingTexture: textures?.wingTexture ?? null, wingOpacityMap: textures?.wingOpacityMap ?? null }
    }

    if (this.dbManager) {
      const record = await this.dbManager.storeSighting({
        suggestion: top,
        photoTexture: this.inputTexture,
        wingTexture: null,
        wingOpacityMap: null,
      })
      if (this.debugLogging) {
        print("[InsectIDTest] storeSighting (no wing textures) " + (record ? "OK" : "failed"))
      }
    }

    return { wingTexture: null, wingOpacityMap: null }
  }

  private fail(message: string): void {
    this.busy = false
    if (this.debugLogging) {
      print("[InsectIDTest] " + message)
    }
  }
}

/**
 * [Assets/_Boon/ButterflyInfoDisplay/Scripts/ButterflyInfoDisplayManager.ts:179] [InfoDisplay] imageUrl[0]: https://insect-id.ams3.cdn.digitaloceanspaces.com/knowledge_base/wikidata/17d/17d46c18680edb5b8bc9ca03bb77ff651f93dec5.jpg
[Assets/_Boon/ButterflyInfoDisplay/Scripts/ButterflyInfoDisplayManager.ts:179] [InfoDisplay] imageUrl[1]: https://insect-id.ams3.cdn.digitaloceanspaces.com/knowledge_base/wikidata/80f/80fd60d142f713aeeb64097f3c364de6e7737d65.jpg
 * [Assets/_Boon/ButterflyInfoDisplay/Scripts/ButterflyInfoDisplayManager.ts:179] [InfoDisplay] imageUrl[2]: https://insect-id.ams3.cdn.digitaloceanspaces.com/knowledge_base/wikipedia/f75/f7538d299e5747d94c2193ae24e25be9b08c2854.jpg
[Assets/_Boon/ButterflyInfoDisplay/Scripts/ButterflyInfoDisplayManager.ts:179] [InfoDisplay] imageUrl[3]: https://insect-id.ams3.cdn.digitaloceanspaces.com/knowledge_base/inaturalist/dca/dcad3f8d1bf677d6df50283dc574dce532847aa6.jpg
[Assets/_Boon/ButterflyInfoDisplay/Scripts/ButterflyInfoDisplayManager.ts:179] [InfoDisplay] imageUrl[4]: https://insect-id.ams3.cdn.digitaloceanspaces.com/knowledge_base/inaturalist/3cf/3cfea15adefe328f4605afe159a7977ed6f1d0c2.jpg
[Assets/_Boon/ButterflyInfoDisplay/Scripts/ButterflyInfoDisplayManager.ts:179] [InfoDisplay] imageUrl[5]: https://insect-id.ams3.cdn.digitaloceanspaces.com/knowledge_base/inaturalist/815/815b84e83f92d39bdaba941918dc4f7c273f6dcc.jpeg
[Assets/_Boon/ButterflyInfoDisplay/Scripts/ButterflyInfoDisplayManager.ts:179] [InfoDisplay] imageUrl[6]: https://insect-id.ams3.cdn.digitaloceanspaces.com/knowledge_base/inaturalist/dac/dac9f26a4d61a7ffbe301dac7b15b1ecce200577.jpg
[Assets/_Boon/ButterflyInfoDisplay/Scripts/ButterflyInfoDisplayManager.ts:179] [InfoDisplay] imageUrl[7]: https://insect-id.ams3.cdn.digitaloceanspaces.com/similar_images/2/d18/9a4d215a5ad5ba6d19efdf79cc1f5a51620a0.jpg
[Assets/_Boon/ButterflyInfoDisplay/Scripts/ButterflyInfoDisplayManager.ts:179] [InfoDisplay] imageUrl[8]: https://insect-id.ams3.cdn.digitaloceanspaces.com/similar_images/2/d5b/c3ad9991d5e8b58e3b6b77179a582d226c088.jpg
 [Assets/_Boon/GenerateButterflyWingTexture/Scripts/ButterflyWingTextureGenerator.ts:137] [ButterflyWingGenerator] generateWingTextures called with: https://insect-id.ams3.cdn.digitaloceanspaces.com/similar_images/2/5d6/79f91f5a5f2f1c1c907956d7a0b08ff47f2cd.jpg

*/
