import { Suggestion } from "../../../_Aggy/Scripts/KindwiseTypes"
import { SightingInfo } from "../../NearbySighting/Scripts/CustomLocationsLoader"
import { ButterflyInfoPrefabComponentsManager } from "./ButterflyInfoPrefabComponentsManager"

const internetModule = require("LensStudio:InternetModule") as InternetModule

/**
 * ButterflyInfoDisplayManager — instantiates a prefab and populates its Text and Image
 * children from either a live Kindwise identification or a stored sighting record.
 *
 * The prefab root must have a ButterflyInfoPrefabComponentsManager component wired up with:
 *   textArray           — Text components matched by SceneObject name (case-insensitive):
 *                         name, common_name, common_names, probability, description,
 *                         inaturalist_id, red_list, danger, danger_description, role,
 *                         kingdom, phylum, class, order, family, genus, spotter, identified_at
 *   userPhotoImage      — Image for the user's captured photo
 *   dataPhotoImageArray — Images for species reference photos (index 0 = primary, 1+ = extras)
 */
@component
export class ButterflyInfoDisplayManager extends BaseScriptComponent {
  @ui.label("Place butterfly info prefab here")
  @input
  @hint("Butterfly Info Display prefab to instantiate when a result arrives")
  prefab!: ObjectPrefab

  @input
  @hint("Parent SceneObject for the spawned prefab (leave empty to use this component's object)")
  spawnParent: SceneObject | null = null

  @input
  @hint("Log field assignments to the Logger panel")
  debugLogging: boolean = true

  private remoteMediaModule = require("LensStudio:RemoteMediaModule") as RemoteMediaModule
  private currentInstance: SceneObject | null = null
  private prefabComponents: ButterflyInfoPrefabComponentsManager | null = null
  private snapDisplayName: string = ""

  onAwake(): void {
    global.userContextSystem.requestDisplayName((name: string) => {
      this.snapDisplayName = name || ""
    })
  }

  private spawnPrefab(): void {
    if (this.currentInstance) {
      this.currentInstance.destroy()
      this.currentInstance = null
      this.prefabComponents = null
    }
    // Set static callback before instantiate() so onAwake() on the prefab root registers synchronously
    ButterflyInfoPrefabComponentsManager._onReady = (comp) => {
      this.prefabComponents = comp
      if (comp.userPhotoImage) {
        comp.userPhotoImage.mainMaterial = comp.userPhotoImage.mainMaterial.clone()
      }
      for (let i = 0; i < comp.dataPhotoImageArray.length; i++) {
        const img = comp.dataPhotoImageArray[i]
        if (img) img.mainMaterial = img.mainMaterial.clone()
      }
    }
    this.currentInstance = this.prefab.instantiate(this.spawnParent ?? this.sceneObject)
    ButterflyInfoPrefabComponentsManager._onReady = null // clear in case onAwake never fired
    if (this.debugLogging) {
      print("[InfoDisplay] Prefab instantiated — components manager: " + (this.prefabComponents ? "found" : "NOT FOUND"))
    }
  }

  private setField(fieldName: string, value: string): void {
    if (!this.prefabComponents || !value) return
    const arr = this.prefabComponents.textArray
    for (let i = 0; i < arr.length; i++) {
      const text = arr[i]
      if (text && text.sceneObject.name.toLowerCase() === fieldName.toLowerCase()) {
        text.text = value
        if (this.debugLogging) print("[InfoDisplay] " + fieldName + " = " + value)
        return
      }
    }
  }

  private setUserPhoto(texture: Texture | null): void {
    if (!texture || !this.prefabComponents) return
    this.prefabComponents.userPhotoImage.mainPass.baseTex = texture
  }

  private setDataImage(index: number, texture: Texture | null): void {
    if (!texture || !this.prefabComponents) return
    const arr = this.prefabComponents.dataPhotoImageArray
    if (index < arr.length) {
      arr[index].mainPass.baseTex = texture
    } else if (this.debugLogging) {
      print("[InfoDisplay] No data image slot at index " + index)
    }
  }

  private loadTextureFromUrl(url: string): Promise<Texture | null> {
    return new Promise((resolve) => {
      const request = RemoteServiceHttpRequest.create()
      request.url = url
      internetModule.performHttpRequest(request, (response) => {
        const resource = response.asResource()
        this.remoteMediaModule.loadResourceAsImageTexture(
          resource,
          (texture: Texture) => resolve(texture),
          (err: string) => {
            if (this.debugLogging) print("[InfoDisplay] Image load failed: " + err)
            resolve(null)
          },
        )
      })
    })
  }

  private populate(fields: {
    name?: string
    common_name?: string
    common_names?: string
    probability?: string
    description?: string
    inaturalist_id?: string
    red_list?: string
    danger?: string
    danger_description?: string
    role?: string
    kingdom?: string
    phylum?: string
    class?: string
    order?: string
    family?: string
    genus?: string
    spotter?: string
    last_seen?: string
    seen_by?: string
  }): void {
    this.setField("name", fields.name ?? "")
    this.setField("common_name", fields.common_name ?? "")
    this.setField("common_names", fields.common_names ?? "")
    this.setField("probability", fields.probability ?? "")
    this.setField("description", fields.description ?? "")
    this.setField("inaturalist_id", fields.inaturalist_id ?? "")
    this.setField("red_list", fields.red_list ?? "")
    this.setField("danger", fields.danger ?? "")
    this.setField("danger_description", fields.danger_description ?? "")
    this.setField("role", fields.role ?? "")
    this.setField("kingdom", fields.kingdom ?? "")
    this.setField("phylum", fields.phylum ?? "")
    this.setField("class", fields.class ?? "")
    this.setField("order", fields.order ?? "")
    this.setField("family", fields.family ?? "")
    this.setField("genus", fields.genus ?? "")
    this.setField("spotter", fields.spotter ?? "")
    this.setField("last_seen", fields.last_seen ?? "")
    this.setField("seen_by", fields.seen_by ?? "")
  }

  /**
   * Instantiate the prefab and populate it from a live Kindwise identification.
   * Called by ButterflyIdentifier — userPhotoTexture is the just-captured frame.
   */
  public displayResult(suggestion: Suggestion, userPhotoTexture: Texture | null = null): void {
    this.spawnPrefab()
    const d = suggestion.details

    this.populate({
      name: suggestion.name,
      common_name: d?.common_names?.[0] ?? "",
      common_names: d?.common_names?.join(", ") ?? "",
      probability: Math.round(suggestion.probability * 100) + "%",
      description: d?.description?.value ?? d?.description_gpt ?? "",
      inaturalist_id: d?.inaturalist_id != null ? String(d.inaturalist_id) : "",
      red_list: d?.red_list ?? "",
      danger: d?.danger?.join(", ") ?? "",
      danger_description: d?.danger_description ?? "",
      role: d?.role?.join(", ") ?? "",
      kingdom: d?.taxonomy?.kingdom ?? "",
      phylum: d?.taxonomy?.phylum ?? "",
      class: d?.taxonomy?.class ?? "",
      order: d?.taxonomy?.order ?? "",
      family: d?.taxonomy?.family ?? "",
      genus: d?.taxonomy?.genus ?? "",
      last_seen: new Date().toISOString(),
      seen_by: this.snapDisplayName,
    })

    if (this.debugLogging) {
      print("[InfoDisplay] Result: " + suggestion.name + " (" + Math.round(suggestion.probability * 100) + "%)")
      print("[InfoDisplay] userPhotoTexture: " + (userPhotoTexture ? "present" : "null"))
      print("[InfoDisplay] d.image.value: " + (d?.image?.value ?? "none"))
      print("[InfoDisplay] d.images count: " + (d?.images?.length ?? 0))
      print("[InfoDisplay] similar_images count: " + (suggestion.similar_images?.length ?? 0))
    }

    this.setUserPhoto(userPhotoTexture)

    const slots = this.prefabComponents?.dataPhotoImageArray.length ?? 0
    const seen = new Set<string>()
    const imageUrls: string[] = []

    const addUrl = (url: string | null | undefined) => {
      if (!url || seen.has(url) || imageUrls.length >= slots) return
      // wikidata CDN images return HTTP 200 but fail at loadResourceAsImageTexture — skip them
      if (url.indexOf("/knowledge_base/wikidata/") !== -1) return
      seen.add(url)
      imageUrls.push(url)
    }

    if (d?.images) {
      for (const img of d.images) addUrl(img.value)
    }
    if (suggestion.similar_images) {
      for (const img of suggestion.similar_images) addUrl(img.url)
    }
    addUrl(d?.image?.value) // wikidata fallback — added last, skipped by addUrl if it's wikidata

    imageUrls.forEach(async (url, i) => {
      const texture = await this.loadTextureFromUrl(url)
      if (this.debugLogging) print("[InfoDisplay] dataImage[" + i + "] load " + (texture ? "OK" : "FAILED") + " — " + url)
      this.setDataImage(i, texture)
    })
  }

  /**
   * Instantiate the prefab and populate it from a stored sighting (e.g. tapping a map marker).
   * userPhotoImage = spotter's photo, dataPhotoImageArray[0] = species reference image.
   */
  public async displaySighting(sighting: SightingInfo): Promise<void> {
    this.spawnPrefab()

    const tax = sighting.speciesTaxonomy
    this.populate({
      name: sighting.speciesScientificName ?? "",
      common_name: sighting.speciesCommonNames?.[0] ?? "",
      common_names: sighting.speciesCommonNames?.join(", ") ?? "",
      probability: sighting.speciesProbability != null ? Math.round(sighting.speciesProbability * 100) + "%" : "",
      description: sighting.speciesDescription ?? "",
      red_list: sighting.speciesRedList ?? "",
      danger: sighting.speciesDanger?.join(", ") ?? "",
      danger_description: sighting.speciesDangerDescription ?? "",
      role: sighting.speciesRole?.join(", ") ?? "",
      kingdom: tax?.kingdom ?? "",
      phylum: tax?.phylum ?? "",
      class: tax?.class ?? "",
      order: tax?.order ?? "",
      family: tax?.family ?? "",
      genus: tax?.genus ?? "",
      spotter: sighting.snapDisplayName ?? "",
      last_seen: sighting.identifiedAt ?? "",
      seen_by: sighting.snapDisplayName ?? "",
    })

    if (sighting.photoUrl) {
      const texture = await this.loadTextureFromUrl(sighting.photoUrl)
      this.setUserPhoto(texture)
    }

    if (sighting.speciesImageUrl) {
      const texture = await this.loadTextureFromUrl(sighting.speciesImageUrl)
      this.setDataImage(0, texture)
    }
  }
}
