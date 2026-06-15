import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {TargetingMode} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import {Tooltip} from "SpectaclesUIKit.lspkg/Scripts/Tooltip"

const TOOLTIP_RENDER_ORDER = 5000
const TOOLTIP_LOCAL_POSITION = new vec3(8, 0, 0.08)
const TOOLTIP_LOCAL_SCALE = 1.15
const HOVER_COLLIDER_LOCAL_POSITION = new vec3(-5, 0, 0)
const HOVER_COLLIDER_SIZE = new vec3(10, 1.4, 1)

@component
export class IdInfoTooltipText extends BaseScriptComponent {
  private tooltipObject!: SceneObject
  private tooltip!: Tooltip
  private colliderObject!: SceneObject
  private interactable!: Interactable
  private collider!: ColliderComponent

  onAwake(): void {
    this.createTooltip()
    this.setupHoverInteraction()
    this.updateTooltipText()
  }

  private createTooltip(): void {
    this.tooltipObject = global.scene.createSceneObject(this.sceneObject.name + "_info_tooltip")
    this.tooltipObject.layer = this.sceneObject.layer
    this.tooltipObject.setParent(this.sceneObject)
    this.tooltipObject.getTransform().setLocalPosition(TOOLTIP_LOCAL_POSITION)
    this.tooltipObject.getTransform().setLocalScale(vec3.one().uniformScale(TOOLTIP_LOCAL_SCALE))
    this.tooltip = this.tooltipObject.createComponent(Tooltip.getTypeName()) as Tooltip
    this.tooltip.renderOrder = TOOLTIP_RENDER_ORDER
    this.tooltip.setOn(false)
  }

  private setupHoverInteraction(): void {
    const boxShape = Shape.createBoxShape()
    boxShape.size = HOVER_COLLIDER_SIZE
    this.colliderObject = global.scene.createSceneObject(this.sceneObject.name + "_info_collider")
    this.colliderObject.layer = this.sceneObject.layer
    this.colliderObject.setParent(this.sceneObject)
    this.colliderObject.getTransform().setLocalPosition(HOVER_COLLIDER_LOCAL_POSITION)
    this.collider = this.colliderObject.createComponent("ColliderComponent") as ColliderComponent
    this.collider.fitVisual = false
    this.collider.shape = boxShape
    this.interactable = this.sceneObject.createComponent(Interactable.getTypeName()) as Interactable
    this.interactable.targetingMode = TargetingMode.All
    this.interactable.onHoverEnter.add(() => this.showTooltip())
    this.interactable.onHoverExit.add(() => this.hideTooltip())
    this.interactable.onSyncHoverEnter.add(() => this.showTooltip())
    this.interactable.onSyncHoverExit.add(() => this.hideTooltip())
  }

  private showTooltip(): void {
    this.updateTooltipText()
    this.tooltip?.setOn(true)
  }

  private hideTooltip(): void {
    this.tooltip?.setOn(false)
  }

  private updateTooltipText(): void {
    if (!this.tooltip) {
      return
    }
    this.tooltip.tip = this.tooltipTextForObjectName()
  }

  private tooltipTextForObjectName(): string {
    const objectName = (this.sceneObject.name || "").toLowerCase()
    if (objectName.indexOf("gbif") !== -1) {
      return "GBIF ID: species page on gbif.org"
    }
    if (objectName.indexOf("inaturalist") !== -1) {
      return "iNaturalist ID: taxon page on inaturalist.org"
    }
    return "Species database ID"
  }
}
