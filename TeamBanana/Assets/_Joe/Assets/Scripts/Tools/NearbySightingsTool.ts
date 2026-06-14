require("LensStudio:RawLocationModule")

import {setTimeout, clearTimeout} from "SpectaclesInteractionKit.lspkg/Utils/FunctionTimingUtils"
import { SupabaseDBManager } from "_Boon/SupabaseInfoStoring&Retrieving/Scripts/SupabaseDBManager"
import { NearbySightingManager } from "_Boon/NearbySighting/Scripts/NearbySightingManager"
import { CustomLocationsLoader, CustomLocation } from "_Boon/NearbySighting/Scripts/CustomLocationsLoader"

/**
 * Cleaned-up sighting result returned to agents.
 * Omits internal DB fields — only what agents need for responses.
 */
export type NearbySighting = {
  id: string
  speciesScientificName: string | null
  speciesCommonNames: string[] | null
  speciesProbability: number | null
  speciesDescription: string | null
  speciesImageUrl: string | null
  photoUrl: string | null
  snapDisplayName: string | null
  latitude: number
  longitude: number
  distanceKm: number
  identifiedAt: string
}

export type NearbySightingsResult = {
  userLocation: {
    latitude: number
    longitude: number
  }
  sightings: NearbySighting[]
  count: number
  radius: number
  unit: "km" | "miles"
}

/**
 * NearbySightingsTool — queries Supabase for butterfly sightings near the user.
 *
 * Follows the same pattern as LocationTool and WeatherTool.
 * Constructor accepts a SupabaseDBManager (dependency injection) so it reuses
 * the existing Supabase client and auth session rather than creating a second one.
 *
 * Optional: pass a NearbySightingManager reference via setMapManager() to enable
 * the `showOnMap` parameter, which triggers Boon's AR map pins alongside the
 * voice response.
 */
export class NearbySightingsTool {
  public readonly name = "nearby_sightings"
  public readonly description =
    "Find butterfly sightings near the user's current GPS location using community-reported data from Supabase"

  public readonly parameters = {
    type: "object",
    properties: {
      radius: {
        type: "number",
        description: "Search radius (default 5, in the unit specified by `unit`)",
        default: 5
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return (default 10, 0 = no limit)",
        default: 10
      },
      unit: {
        type: "string",
        description: "Unit for radius: 'km' or 'miles' (default 'miles')",
        enum: ["km", "miles"],
        default: "miles"
      },
      showOnMap: {
        type: "boolean",
        description: "If true, also displays sightings as pins on the AR minimap (requires mapManager to be wired)",
        default: false
      }
    },
    required: []
  }

  private dbManager: SupabaseDBManager
  private mapManager: NearbySightingManager | null = null
  private customLocationsLoader: CustomLocationsLoader | null = null

  // Cache — avoids repeated GPS + DB calls in a single conversation turn
  private lastResult: NearbySightingsResult | null = null
  private lastFetchTimestamp: number = 0
  private readonly CACHE_TTL_MS = 30000 // 30 seconds

  private fetchPromise: Promise<NearbySightingsResult | null> | null = null

  constructor(dbManager: SupabaseDBManager) {
    this.dbManager = dbManager
    print("NearbySightingsTool: Initialized with SupabaseDBManager")
  }

  /** Wire Boon's AR map display so `showOnMap` can push pins directly. */
  public setMapManager(manager: NearbySightingManager): void {
    this.mapManager = manager
    // Grab the CustomLocationsLoader from the same object for direct pin placement
    this.customLocationsLoader = (manager as any).customLocationLoader as CustomLocationsLoader | null
    print("NearbySightingsTool: Map manager wired — showOnMap enabled")
  }

  public async execute(args: Record<string, unknown>): Promise<{
    success: boolean
    result?: NearbySightingsResult
    error?: string
    executionTime: number
  }> {
    const startTime = Date.now()
    try {
      const radius = (args.radius as number) ?? 5
      const limit = (args.limit as number) ?? 10
      const unit = (args.unit as "km" | "miles") ?? "miles"

      print(`NearbySightingsTool: Executing — radius: ${radius} ${unit}, limit: ${limit}`)

      // Return cached result if still fresh and parameters match
      if (
        this.lastResult &&
        Date.now() - this.lastFetchTimestamp < this.CACHE_TTL_MS &&
        this.lastResult.radius === radius &&
        this.lastResult.unit === unit
      ) {
        print("NearbySightingsTool: Returning cached sightings")
        // Re-apply limit on cached data if needed
        const sightings = limit > 0 ? this.lastResult.sightings.slice(0, limit) : this.lastResult.sightings
        return {
          success: true,
          result: { ...this.lastResult, sightings, count: sightings.length },
          executionTime: Date.now() - startTime
        }
      }

      const result = await this.fetchNearbySightings(radius, limit, unit)

      if (!result) {
        return {
          success: false,
          error: "Unable to retrieve nearby sightings. Please check location permissions and try again.",
          executionTime: Date.now() - startTime
        }
      }

      // Cache the full (unlimited) result
      this.lastResult = result
      this.lastFetchTimestamp = Date.now()

      // Push results to AR map if requested and wired
      if (args.showOnMap && result) {
        if (this.mapManager && this.customLocationsLoader) {
          print(`NearbySightingsTool: Pushing ${result.count} pins to AR map`)
          try {
            // Enable + scale the map directly — no tween, no second GPS query
            this.mapManager.map.enabled = true
            this.mapManager.map.getTransform().setLocalScale(vec3.one())

            // Feed our already-fetched data directly to the pin loader
            const locations: CustomLocation[] = result.sightings.map((s) => ({
              label: s.speciesCommonNames?.[0] ?? s.speciesScientificName ?? "Butterfly",
              latitude: s.latitude,
              longitude: s.longitude,
              sighting: {
                id: s.id,
                snapDisplayName: s.snapDisplayName,
                photoUrl: s.photoUrl,
                speciesScientificName: s.speciesScientificName,
                speciesCommonNames: s.speciesCommonNames,
                speciesProbability: s.speciesProbability,
                speciesDescription: s.speciesDescription,
                speciesImageUrl: s.speciesImageUrl,
                identifiedAt: s.identifiedAt,
              },
            }))
            this.customLocationsLoader.setLocations(locations)
            print(`NearbySightingsTool: ${locations.length} pins placed on map`)
          } catch (e) {
            print(`NearbySightingsTool: Map push failed: ${e}`)
          }
        } else {
          print("NearbySightingsTool: showOnMap=true but mapManager not wired — AR map skipped")
        }
      }

      print(`NearbySightingsTool: Found ${result.count} sightings within ${radius} ${unit}`)

      return {
        success: true,
        result,
        executionTime: Date.now() - startTime
      }
    } catch (error) {
      print(`NearbySightingsTool: ERROR — ${error}`)
      return {
        success: false,
        error: `Nearby sightings tool failed: ${error}`,
        executionTime: Date.now() - startTime
      }
    }
  }

  /**
   * Fetch GPS position once, then query Supabase.
   */
  private async fetchNearbySightings(
    radius: number,
    limit: number,
    unit: "km" | "miles"
  ): Promise<NearbySightingsResult | null> {
    // Dedup concurrent fetch attempts
    if (this.fetchPromise !== null) {
      return this.fetchPromise
    }

    // London fallback — matches SimulatedData.ts seed coordinates
    const LONDON_LAT = 51.5074
    const LONDON_LON = -0.1278

    this.fetchPromise = new Promise((resolve) => {
      let resolved = false

      const resolveWithFallback = () => {
        if (resolved) return
        resolved = true
        print(`NearbySightingsTool: GPS timed out — falling back to London (${LONDON_LAT}, ${LONDON_LON})`)
        resolve(this.querySightings(LONDON_LAT, LONDON_LON, radius, limit, unit))
        this.fetchPromise = null
      }

      // Timeout: if GPS doesn't respond in 5s, fall back to London
      const timeoutId = setTimeout(resolveWithFallback, 5000)

      const onSuccess = async (geoPosition: GeoPosition) => {
        if (resolved) return
        resolved = true
        clearTimeout(timeoutId)

        print(`NearbySightingsTool: GPS acquired (${geoPosition.latitude.toFixed(4)}, ${geoPosition.longitude.toFixed(4)})`)
        const result = await this.querySightings(
          geoPosition.latitude,
          geoPosition.longitude,
          radius,
          limit,
          unit
        )
        resolve(result)
        this.fetchPromise = null
      }

      const onError = (error: string) => {
        if (resolved) return
        resolved = true
        clearTimeout(timeoutId)
        print(`NearbySightingsTool: GPS error: ${error} — falling back to London`)
        resolve(this.querySightings(LONDON_LAT, LONDON_LON, radius, limit, unit))
        this.fetchPromise = null
      }

      try {
        const locationService = GeoLocation.createLocationService()
        locationService.accuracy = GeoLocationAccuracy.Navigation
        locationService.getCurrentPosition(onSuccess, onError)
      } catch (e) {
        if (resolved) return
        resolved = true
        clearTimeout(timeoutId)
        print(`NearbySightingsTool: LocationService unavailable: ${e} — falling back to London`)
        resolve(this.querySightings(LONDON_LAT, LONDON_LON, radius, limit, unit))
        this.fetchPromise = null
      }
    })

    return this.fetchPromise
  }

  /**
   * Shared Supabase query — called by both real GPS and London fallback paths.
   */
  private async querySightings(
    latitude: number,
    longitude: number,
    radius: number,
    limit: number,
    unit: "km" | "miles"
  ): Promise<NearbySightingsResult | null> {
    try {
      const sightings = await this.dbManager.getNearbySightings({
        latitude,
        longitude,
        radius,
        unit,
        limit: limit > 0 ? limit : undefined
      })

      const toRad = (deg: number) => deg * (Math.PI / 180)
      const earthR = 6371

      const mapped: NearbySighting[] = sightings.map((s) => {
        const lat2 = s.latitude as number
        const lon2 = s.longitude as number
        const dLat = toRad(lat2 - latitude)
        const dLon = toRad(lon2 - longitude)
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(latitude)) * Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2)
        const distKm = earthR * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

        return {
          id: s.id,
          speciesScientificName: s.species_scientific_name,
          speciesCommonNames: s.species_common_names,
          speciesProbability: s.species_probability,
          speciesDescription: s.species_description,
          speciesImageUrl: s.species_image_url,
          photoUrl: s.photo_url,
          snapDisplayName: s.snap_display_name,
          latitude: lat2,
          longitude: lon2,
          distanceKm: Math.round(distKm * 100) / 100,
          identifiedAt: s.identified_at
        }
      })

      return {
        userLocation: { latitude, longitude },
        sightings: mapped,
        count: mapped.length,
        radius,
        unit
      }
    } catch (e) {
      print(`NearbySightingsTool: Supabase query failed: ${e}`)
      return null
    }
  }

  /**
   * Format sightings as a human-readable summary string for agents to use inline.
   */
  public formatSightingsSummary(result: NearbySightingsResult): string {
    if (result.count === 0) {
      return `No butterfly sightings found within ${result.radius} ${result.unit}.`
    }

    const nearest = result.sightings[0]
    const nearestName = nearest.speciesCommonNames?.[0] ?? nearest.speciesScientificName ?? "Unknown species"
    const nearestDist = nearest.distanceKm < 1
      ? `${Math.round(nearest.distanceKm * 1000)} meters`
      : `${nearest.distanceKm.toFixed(1)} km`

    const lines = result.sightings.map((s, i) => {
      const name = s.speciesCommonNames?.[0] ?? s.speciesScientificName ?? "Unknown species"
      const dist = s.distanceKm < 1
        ? `${Math.round(s.distanceKm * 1000)}m`
        : `${s.distanceKm.toFixed(1)}km`
      return `${i + 1}. ${name} — ${dist} away`
    })

    return `The nearest butterfly sighting is a ${nearestName}, about ${nearestDist} away. ` +
      `${result.count} sighting(s) total within ${result.radius} ${result.unit}:\n${lines.join("\n")}`
  }

  /**
   * Clear the cache (e.g. when user moves significantly).
   */
  public clearCache(): void {
    this.lastResult = null
    this.lastFetchTimestamp = 0
    print("NearbySightingsTool: Cache cleared")
  }
}
