import {MapPin} from "./MapPin"

export class QuestMarker {
  mapPin: MapPin
  transform: Transform
  markerLabel: Text
  distanceText: Text
  imageComponent: Image
  private interactable: SceneObject | null
  private inViewMaterialSrc: Material | null = null
  private inViewMaterialInst: Material | null = null
  private outOfViewMaterialSrc: Material | null = null
  private outOfViewMaterialInst: Material | null = null

  constructor(mapPin: MapPin, transform: Transform, scale: number) {
    this.mapPin = mapPin
    this.transform = transform
    this.transform.setLocalScale(new vec3(scale, scale, scale))
    this.markerLabel = transform.getSceneObject().getChild(0).getComponent("Text")
    if (mapPin.placeInfo !== undefined) {
      this.markerLabel.text = mapPin.placeInfo.name
    } else {
      this.markerLabel.text = mapPin.sceneObject.name
    }

    this.distanceText = transform.getSceneObject().getChild(1).getComponent("Text")
    this.imageComponent = transform.getSceneObject().getChild(2).getComponent("Image")

    this.interactable = this.findChildByName(transform.getSceneObject(), "interactable")
    if (this.interactable) {
      this.interactable.enabled = false
    }
  }

  private findChildByName(parent: SceneObject, name: string): SceneObject | null {
    for (let i = 0; i < parent.getChildrenCount(); i++) {
      const child = parent.getChild(i)
      if (child.name === name) return child
    }
    return null
  }

  setIsInView(isInView: boolean, inViewMaterial: Material, outOfViewMaterial: Material): void {
    if (this.interactable) {
      this.interactable.enabled = isInView
    }
    if (isInView) {
      if (this.inViewMaterialSrc !== inViewMaterial) {
        this.inViewMaterialSrc = inViewMaterial
        this.inViewMaterialInst = inViewMaterial.clone()
      }
      this.imageComponent.mainMaterial = this.inViewMaterialInst!
    } else {
      if (this.outOfViewMaterialSrc !== outOfViewMaterial) {
        this.outOfViewMaterialSrc = outOfViewMaterial
        this.outOfViewMaterialInst = outOfViewMaterial.clone()
      }
      this.imageComponent.mainMaterial = this.outOfViewMaterialInst!
    }
  }

  setDistance(distance: number): void {
    this.distanceText.text = `${distance.toFixed(0)}m`
  }

  setOrientation(orientation: number): void {
    this.imageComponent.getTransform().setLocalRotation(quat.fromEulerAngles(0, 0, orientation))
  }
}
