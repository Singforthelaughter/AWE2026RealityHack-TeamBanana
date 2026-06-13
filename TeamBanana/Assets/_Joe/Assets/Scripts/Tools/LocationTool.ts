/**
 * Location Tool - Spectacles GPS location services
 * Provides current GPS coordinates, altitude, and accuracy for butterfly habitat analysis
 * Agents can call this tool to get user's location for species occurrence lookups
 */

export class LocationTool {
  public readonly name = "location_tool"
  public readonly description =
    "Get current GPS location using Spectacles LocationService for butterfly habitat and species analysis"

  public readonly parameters = {
    type: "object",
    properties: {
      // No parameters required - auto-fetches from Spectacles
    },
    required: []
  }

  private lastLocation: {
    latitude: number
    longitude: number
    altitude: number | null
    accuracy: number
    timestamp: number
  } | null = null

  private fetchPromise: Promise<{
    latitude: number
    longitude: number
    altitude: number | null
    accuracy: number
    timestamp: number
  } | null> | null = null

  constructor() {
    try {
      print("LocationTool: Initialized with Spectacles LocationService")
    } catch (error) {
      print(`LocationTool: ERROR - Failed to initialize: ${error}`)
      throw error
    }
  }

  public async execute(args: Record<string, unknown>): Promise<{
    success: boolean
    result?: {
      latitude: number
      longitude: number
      altitude: number | null
      accuracy: number
      timestamp: number
    }
    error?: string
  }> {
    try {
      print("LocationTool: Executing location query...")

      // If we have cached location (< 30 seconds old), return it
      if (this.lastLocation && Date.now() - this.lastLocation.timestamp < 30000) {
        print("LocationTool: Returning cached location")
        return {
          success: true,
          result: this.lastLocation
        }
      }

      // Fetch fresh location
      const location = await this.fetchLocation()

      if (!location) {
        return {
          success: false,
          error: "Unable to retrieve location. Please check location permissions and try again."
        }
      }

      this.lastLocation = location
      print(`LocationTool: Successfully retrieved location - Lat: ${location.latitude.toFixed(4)}, Lon: ${location.longitude.toFixed(4)}`)

      return {
        success: true,
        result: location
      }
    } catch (error) {
      print(`LocationTool: ERROR - Location fetch failed: ${error}`)
      return {
        success: false,
        error: `Location tool failed: ${error}`
      }
    }
  }

  /**
   * Fetch location using getCurrentPosition
   */
  private async fetchLocation(): Promise<{
    latitude: number
    longitude: number
    altitude: number | null
    accuracy: number
    timestamp: number
  } | null> {
    // If already fetching, return the existing promise
    if (this.fetchPromise !== null) {
      return this.fetchPromise
    }

    this.fetchPromise = new Promise((resolve) => {
      let resolved = false

      // Success callback
      const onSuccess = (geoPosition: GeoPosition) => {
        if (!resolved) {
          resolved = true

          const result = {
            latitude: geoPosition.latitude,
            longitude: geoPosition.longitude,
            altitude: geoPosition.altitude > 0 ? geoPosition.altitude : null,
            accuracy: geoPosition.horizontalAccuracy,
            timestamp: Date.now()
          }
          resolve(result)
          this.fetchPromise = null
        }
      }

      // Error callback
      const onError = (error: string) => {
        if (!resolved) {
          resolved = true
          print(`LocationTool: Location fetch error: ${error}`)
          resolve(null)
          this.fetchPromise = null
        }
      }

      // Request location
      try {
        const locationService = LocationService as any
        locationService.getCurrentPosition(onSuccess, onError)
      } catch (error) {
        print(`LocationTool: Error calling getCurrentPosition: ${error}`)
        resolve(null)
        this.fetchPromise = null
      }
    })

    return this.fetchPromise
  }

  /**
   * Get location as formatted string
   */
  public getFormattedLocation(): string {
    if (!this.lastLocation) {
      return "Location not available"
    }

    const latitude = this.lastLocation.latitude
    const longitude = this.lastLocation.longitude
    const altitude = this.lastLocation.altitude
    const altText = altitude ? `, ${altitude.toFixed(0)}m altitude` : ""
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}${altText}`
  }

  /**
   * Calculate distance between two coordinates (in meters)
   * Uses Haversine formula
   */
  public calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000
    const phi1 = (lat1 * Math.PI) / 180
    const phi2 = (lat2 * Math.PI) / 180
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2)
      + Math.cos(phi1) * Math.cos(phi2)
      * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }
}
