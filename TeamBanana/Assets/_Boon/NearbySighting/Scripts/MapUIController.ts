import { PinchButton } from "SpectaclesInteractionKit.lspkg/Components/UI/PinchButton/PinchButton"
import { ToggleButton } from "SpectaclesInteractionKit.lspkg/Components/UI/ToggleButton/ToggleButton"
import { InteractorEvent } from "SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent"
import { CancelFunction } from "SpectaclesInteractionKit.lspkg/Utils/animate"
import NativeLogger from "SpectaclesInteractionKit.lspkg/Utils/NativeLogger"
import { MapComponent } from "../MapComponent.lspkg/MapComponent/Scripts/MapComponent"
import { makeTween } from "../MapComponent.lspkg/MapComponent/Scripts/MapUtils"

export const TWEEN_DURATION = 0.3
const ZOOM_IN_BUTTON_OFFSET_MINI = new vec3(7, -9.5, 2)
const ZOOM_IN_BUTTON_OFFSET_FULL = new vec3(7, -32, 2)
const ZOOM_OUT_BUTTON_OFFSET_MINI = new vec3(-7, -9.5, 2)
const ZOOM_OUT_BUTTON_OFFSET_FULL = new vec3(-7, -32, 2)
const CENTER_MAP_BUTTON_OFFSET_MINI = new vec3(0, -10, 2)
const CENTER_MAP_BUTTON_OFFSET_FULL = new vec3(0, -32, 2)
const TOGGLE_BUTTON_OFFSET_MINI = new vec3(-7, 10.5, 2)
const TOGGLE_BUTTON_OFFSET_FULL = new vec3(-29, 32, 2)

enum ButtonType {
  ZOOM_IN,
  ZOOM_OUT,
  CENTER_MAP,
  TOGGLE_MINI_MAP,
}

const TAG = "[MapUIController]"
const log = new NativeLogger(TAG)

@component
export class MapUIController extends BaseScriptComponent {
  @input
  private mapComponent!: MapComponent

  @input
  private zoomInButton!: PinchButton
  @input
  private zoomOutButton!: PinchButton
  @input
  private centerMapButton!: PinchButton

  @input
  private toggleMiniMapButton!: ToggleButton

  // For debugging
  @input
  @allowUndefined
  private logObject: SceneObject | undefined

  private buttonTransforms: (Transform | undefined)[] = []

  private isMiniMap: boolean = false

  private tweenCancelFunction: CancelFunction | undefined

  onAwake() {
    this.createEvent("OnStartEvent").bind(this.onStart.bind(this))
  }

  private onStart() {
    this.zoomInButton?.onButtonPinched?.add(this.handleZoomInButtonPinched.bind(this))
    this.zoomOutButton?.onButtonPinched?.add(this.handleZoomOutButtonPinched.bind(this))
    this.centerMapButton?.onButtonPinched?.add(() => this.mapComponent.centerMap())
    this.toggleMiniMapButton?.onStateChanged.add(this.handleToggleMiniMapButtonPinched.bind(this))

    // Should have the same order as the ButtonType enum
    this.buttonTransforms = [this.zoomInButton?.getTransform(), this.zoomOutButton?.getTransform(), this.centerMapButton?.getTransform(), this.toggleMiniMapButton?.getTransform()]

    if (this.logObject !== undefined) {
      this.buttonTransforms.push(this.logObject.getTransform())
    }
  }

  private handleZoomInButtonPinched(event: InteractorEvent) {
    this.mapComponent.zoomIn()
  }

  private handleZoomOutButtonPinched(event: InteractorEvent) {
    this.mapComponent.zoomOut()
  }

  private handleToggleMiniMapButtonPinched(isOn: boolean) {
    if (this.isMiniMap === isOn) {
      return
    }

    log.i("Toggling minimap " + isOn)

    this.mapComponent.toggleMiniMap(isOn)
    if (this.tweenCancelFunction !== undefined) {
      this.tweenCancelFunction()
      this.tweenCancelFunction = undefined
    }

    if (isOn) {
      this.tweenCancelFunction = makeTween((t) => {
        this.buttonTransforms[ButtonType.ZOOM_IN]?.setLocalPosition(vec3.lerp(ZOOM_IN_BUTTON_OFFSET_FULL, ZOOM_IN_BUTTON_OFFSET_MINI, t))
        this.buttonTransforms[ButtonType.ZOOM_OUT]?.setLocalPosition(vec3.lerp(ZOOM_OUT_BUTTON_OFFSET_FULL, ZOOM_OUT_BUTTON_OFFSET_MINI, t))
        this.buttonTransforms[ButtonType.CENTER_MAP]?.setLocalPosition(vec3.lerp(CENTER_MAP_BUTTON_OFFSET_FULL, CENTER_MAP_BUTTON_OFFSET_MINI, t))
        this.buttonTransforms[ButtonType.TOGGLE_MINI_MAP]?.setLocalPosition(vec3.lerp(TOGGLE_BUTTON_OFFSET_FULL, TOGGLE_BUTTON_OFFSET_MINI, t))
      }, TWEEN_DURATION)
    } else {
      this.tweenCancelFunction = makeTween((t) => {
        this.buttonTransforms[ButtonType.ZOOM_IN]?.setLocalPosition(vec3.lerp(ZOOM_IN_BUTTON_OFFSET_MINI, ZOOM_IN_BUTTON_OFFSET_FULL, t))
        this.buttonTransforms[ButtonType.ZOOM_OUT]?.setLocalPosition(vec3.lerp(ZOOM_OUT_BUTTON_OFFSET_MINI, ZOOM_OUT_BUTTON_OFFSET_FULL, t))
        this.buttonTransforms[ButtonType.CENTER_MAP]?.setLocalPosition(vec3.lerp(CENTER_MAP_BUTTON_OFFSET_MINI, CENTER_MAP_BUTTON_OFFSET_FULL, t))
        this.buttonTransforms[ButtonType.TOGGLE_MINI_MAP]?.setLocalPosition(vec3.lerp(TOGGLE_BUTTON_OFFSET_MINI, TOGGLE_BUTTON_OFFSET_FULL, t))
      }, TWEEN_DURATION)
    }

    this.isMiniMap = isOn
  }
}
