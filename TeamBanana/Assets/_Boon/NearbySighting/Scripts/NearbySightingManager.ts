require("LensStudio:RawLocationModule")

import { CustomLocationsLoader } from "./CustomLocationsLoader"
import { SupabaseDBManager } from "../../SupabaseInfoStoring&Retrieving/Scripts/SupabaseDBManager"
import { LSTween } from "LSTween.lspkg/Examples/Scripts/LSTween"
import Easing from "LSTween.lspkg/TweenJS/Easing"

/**
 * AGENT INSTRUCTION: To show nearby butterfly sightings on the AR map, get a reference to this
 * component and call `openNearbySighting()`. That method enables and animates the map into view,
 * fetches the user's current GPS position once, queries Supabase for sightings within
 * `searchRadius` miles, and pins them on the map.
 *
 * Inspector inputs required:
 *   map                  — the map SceneObject
 *   customLocationLoader — the CustomLocationsLoader component
 *   dbManager            — the SupabaseDBManager component (handles auth automatically)
 *   searchRadius         — how far to search in miles (default 5)
 */
@component
export class NearbySightingManager extends BaseScriptComponent {
  @input map!: SceneObject
  @input customLocationLoader!: CustomLocationsLoader

  @input
  @hint("SupabaseDBManager component — handles auth automatically on start")
  dbManager!: SupabaseDBManager

  @input
  @hint("Search radius in miles")
  searchRadius: number = 5

  @input
  @hint("Maximum number of sightings to show on the map (0 = no limit)")
  maxResults: number = 50

  private mapTransform!: Transform
  private locationService!: LocationService
  private closeTween: ReturnType<typeof LSTween.scaleToLocal> | null = null

  onAwake() {
    this.mapTransform = this.map.getTransform()
    this.map.enabled = false
    // this.mapTransform.setLocalScale(vec3.zero())

    this.createEvent("OnStartEvent").bind(() => {
      this.locationService = GeoLocation.createLocationService()
      this.locationService.accuracy = GeoLocationAccuracy.Navigation

      // timeManager.setTimeout(() => {
      //   this.openNearbySighting()
      // }, 2000)
    })
  }

  // Enables the map, animates it into view, then fetches and pins nearby sightings.
  openNearbySighting() {
    if (this.closeTween) {
      this.closeTween.stop()
      this.closeTween = null
    }
    this.map.enabled = true
    LSTween.scaleToLocal(this.mapTransform, vec3.one(), 1000).easing(Easing.Sinusoidal.Out).start()
    this.getNearbySighting()
  }

  // Animates the map out and disables it.
  closeNearbySighting() {
    print(`[NearbySightingManager] closeNearbySighting — clearing ${this.customLocationLoader ? "loader" : "NULL loader"} locations`)
    this.customLocationLoader.clearLocations()
    this.closeTween = LSTween.scaleToLocal(this.mapTransform, vec3.zero(), 500).easing(Easing.Sinusoidal.In)
    this.closeTween.onComplete(() => {
      this.closeTween = null
      this.map.enabled = false
    })
    this.closeTween.start()
  }

  // Gets the user's current GPS position once, then fetches nearby butterfly sightings
  // from Supabase and pins them on the map. Clears previous pins first.
  // Pin label: common name if available, otherwise scientific name.
  getNearbySighting() {
    this.locationService.getCurrentPosition(
      async (geoPosition) => {
        const sightings = await this.dbManager.getNearbySightings({
          latitude: geoPosition.latitude,
          longitude: geoPosition.longitude,
          radius: this.searchRadius,
          unit: "miles",
          limit: this.maxResults > 0 ? this.maxResults : undefined,
        })

        const locations = sightings
          .filter((s) => s.latitude !== null && s.longitude !== null)
          .map((s) => ({
            label: (s.species_common_names?.[0] ?? s.species_scientific_name) || "Butterfly",
            latitude: s.latitude as number,
            longitude: s.longitude as number,
            sighting: {
              id: s.id,
              snapDisplayName: s.snap_display_name,
              photoUrl: s.photo_url,
              speciesScientificName: s.species_scientific_name,
              speciesCommonNames: s.species_common_names,
              speciesProbability: s.species_probability,
              speciesDescription: s.species_description,
              speciesImageUrl: s.species_image_url,
              identifiedAt: s.identified_at,
              speciesRedList: s.species_red_list,
              speciesDanger: s.species_danger,
              speciesDangerDescription: s.species_danger_description,
              speciesRole: s.species_role,
              speciesTaxonomy: s.species_taxonomy as {
                kingdom: string | null
                phylum: string | null
                class: string | null
                order: string | null
                family: string | null
                genus: string | null
              } | null,
            },
          }))

        print(locations.length)

        this.customLocationLoader.setLocations(locations)

        print(`[NearbySightingManager] Pinned ${locations.length} nearby sightings within ${this.searchRadius} miles`)
      },
      (error) => {
        print(`[NearbySightingManager] Failed to get location: ${error}`)
      },
    )
  }
}
