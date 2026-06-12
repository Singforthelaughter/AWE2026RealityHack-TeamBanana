import { CustomLocationsLoader } from "./CustomLocationsLoader"
import { LSTween } from "LSTween.lspkg/Examples/Scripts/LSTween"
import Easing from "LSTween.lspkg/TweenJS/Easing"

/**
 * AGENT INSTRUCTION: To show nearby butterfly sightings on the AR map, get a reference to this
 * component and call `openNearbySighting()`. That method enables and animates the map into view,
 * then calls `getNearbySighting()` which you should populate with real sighting data by calling
 * `this.customLocationLoader.addLocation({ label, latitude, longitude })` for each sighting.
 */
@component
export class NearbySightingManager extends BaseScriptComponent {
  @input map!: SceneObject
  @input customLocationLoader!: CustomLocationsLoader

  private mapTransform!: Transform
  onAwake() {
    this.mapTransform = this.map.getTransform()

    this.map.enabled = false
    this.mapTransform.setLocalScale(vec3.zero())
  }

  // Enables the map and animates it into view, then fetches nearby sightings.
  openNearbySighting() {
    this.map.enabled = true

    LSTween.scaleToLocal(this.mapTransform, vec3.one(), 1000).easing(Easing.Sinusoidal.Out).start()
    this.getNearbySighting()
  }

  // Fetches nearby butterfly sightings from Supabase and pins them on the map via
  // `this.customLocationLoader.addLocation({ label, latitude, longitude })`.
  // TODO: Supabase integration not yet implemented.
  getNearbySighting() {}
}
