import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import { InteractorEvent } from "SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent"
import { SightingInfo } from "./CustomLocationsLoader"
import { ButterflyInfoDisplayManager } from "../../ButterflyInfoDisplay/Scripts/ButterflyInfoDisplayManager"

@component
export class MarkerInteractableTrigger extends BaseScriptComponent {
  @input
  @hint("Sibling Text component")
  text1: Text | null = null

  @input
  @hint("Sibling Text component")
  text2: Text | null = null

  @input("SceneObject")
  @hint("Sibling SceneObject with an Image component")
  image1: SceneObject | null = null

  @input
  @widget(new ColorWidget())
  @hint("Colour when nothing is hovering")
  normalColor: vec4 = new vec4(1, 1, 1, 1)

  @input
  @widget(new ColorWidget())
  @hint("Colour when hovered but not triggered")
  hoverColor: vec4 = new vec4(0.8, 0.9, 1, 1)

  @input
  @widget(new ColorWidget())
  @hint("Colour while trigger is held")
  triggerColor: vec4 = new vec4(0.5, 0.7, 1, 1)

  @input
  @widget(new ColorWidget())
  @hint("Colour immediately after trigger releases (still hovering)")
  triggerEndColor: vec4 = new vec4(0.8, 0.9, 1, 1)

  @input
  @hint("Per-axis scale multiplier applied to the parent on trigger start (e.g. 1.1 = 110%)")
  triggerScaleMultiplier: vec3 = new vec3(1.1, 1.1, 1.1)

  @input
  @hint("ButterflyInfoDisplayManager to populate when this marker is triggered")
  infoDisplay: ButterflyInfoDisplayManager | null = null

  private interactable: Interactable | null = null
  private parentTransform: Transform | null = null
  private originalParentScale: vec3 = vec3.one()
  private imgComp: Image | null = null
  private sightingData: SightingInfo | null = null

  onAwake() {
    this.interactable = this.sceneObject.getComponent(Interactable.getTypeName())
    if (!this.interactable) {
      print("[MarkerInteractableTrigger] No Interactable found on " + this.sceneObject.name)
      return
    }

    if (this.image1) {
      this.imgComp = this.image1.getComponent("Image") as Image
      if (this.imgComp) {
        this.imgComp.mainMaterial = this.imgComp.mainMaterial.clone()
      }
    }

    const parent = this.sceneObject.getParent()
    if (parent) {
      this.parentTransform = parent.getTransform()
      this.originalParentScale = this.parentTransform.getLocalScale()
    }

    this.interactable.onHoverEnter.add(this.onHoverEnter)
    this.interactable.onHoverExit.add(this.onHoverExit)
    this.interactable.onTriggerStart.add(this.onTriggerStart)
    this.interactable.onTriggerEnd.add(this.onTriggerEnd)
  }

  private setColor(color: vec4): void {
    const textObjects = [this.text1, this.text2]
    for (let i = 0; i < textObjects.length; i++) {
      const obj = textObjects[i]
      if (!obj) continue
      obj.textFill.color = color
    }

    if (this.imgComp) {
      this.imgComp.mainPass.baseColor = color
    }
  }

  private onHoverEnter = (_: InteractorEvent): void => {
    this.setColor(this.hoverColor)
  }

  private onHoverExit = (_: InteractorEvent): void => {
    this.setColor(this.normalColor)
  }

  private onTriggerStart = (_: InteractorEvent): void => {
    this.setColor(this.triggerColor)
    if (this.parentTransform) {
      const s = this.originalParentScale
      const m = this.triggerScaleMultiplier
      this.parentTransform.setLocalScale(new vec3(s.x * m.x, s.y * m.y, s.z * m.z))
    }
  }

  setSightingData(data: SightingInfo): void {
    this.sightingData = data
  }

  private onTriggerEnd = (_: InteractorEvent): void => {
    this.setColor(this.triggerEndColor)
    if (this.parentTransform) {
      this.parentTransform.setLocalScale(this.originalParentScale)
    }
    if (this.sightingData) {
      print(`[MarkerInteractableTrigger] Opened detail for: ${this.sightingData.speciesCommonNames}`)
      this.infoDisplay?.displaySighting(this.sightingData)
    }
  }
}
