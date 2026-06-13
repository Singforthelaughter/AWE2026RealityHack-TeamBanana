import { MapComponent } from "../MapComponent.lspkg/MapComponent/Scripts/MapComponent"
import { MapPin } from "../MapComponent.lspkg/MapComponent/Scripts/MapPin"

export type SightingInfo = {
  id: string
  snapDisplayName: string | null
  photoUrl: string | null
  speciesScientificName: string | null
  speciesCommonNames: string[] | null
  speciesProbability: number | null
  speciesDescription: string | null
  speciesImageUrl: string | null
  identifiedAt: string
}

export type CustomLocation = {
  label: string
  latitude: number
  longitude: number
  sighting?: SightingInfo
}

/**
 * Manages runtime-added custom map pins.
 * Call setLocations() or addLocation() from any script that has GPS data ready.
 * Pins queued before the map is ready are placed automatically once it initialises.
 */
@component
export class CustomLocationsLoader extends BaseScriptComponent {
  @input
  private mapComponent!: MapComponent

  private pins: MapPin[] = []
  private mapReady: boolean = false
  private pendingLocations: CustomLocation[] = []
  private pinLocationMap: Map<string, CustomLocation> = new Map()
  // holds the location being placed right now, for the synchronous onMapAddPin callback window
  private activePlacingLocation: CustomLocation | null = null

  onAwake() {
    this.createEvent("OnStartEvent").bind(this.onStart.bind(this))
  }

  private onStart() {
    this.mapComponent.subscribeOnUserLocationFirstSet(() => {
      this.mapReady = true
      for (const loc of this.pendingLocations) {
        this.placePin(loc)
      }
      this.pendingLocations = []
    })
  }

  /** Replace all custom pins with a new set. */
  setLocations(locations: CustomLocation[]): void {
    this.clearLocations()
    for (const loc of locations) {
      this.addLocation(loc)
    }
  }

  /** Add a single pin. Safe to call before the map is ready — it will be queued. */
  addLocation(location: CustomLocation): MapPin | null {
    if (this.mapReady) {
      return this.placePin(location)
    }
    this.pendingLocations.push(location)
    return null
  }

  /** Remove all custom pins from the map. */
  clearLocations(): void {
    for (const pin of this.pins) {
      this.mapComponent.removeMapPin(pin)
    }
    this.pins = []
    this.pinLocationMap.clear()
  }

  getLocationForPin(pin: MapPin): CustomLocation | undefined {
    // activePlacingLocation covers the case where onMapAddPin fires synchronously
    // inside createMapPin before pinLocationMap.set() has run
    return this.pinLocationMap.get(pin.sceneObject.uniqueIdentifier) ?? this.activePlacingLocation ?? undefined
  }

  private placePin(loc: CustomLocation): MapPin {
    this.activePlacingLocation = loc
    const pin = this.mapComponent.createMapPin(loc.longitude, loc.latitude, loc.label)
    this.pinLocationMap.set(pin.sceneObject.uniqueIdentifier, loc)
    this.activePlacingLocation = null
    this.pins.push(pin)
    return pin
  }
}
