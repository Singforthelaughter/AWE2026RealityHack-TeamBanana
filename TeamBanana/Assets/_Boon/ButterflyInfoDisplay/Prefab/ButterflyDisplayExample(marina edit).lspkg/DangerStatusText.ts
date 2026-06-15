import {BUTTERFLY_ENDANGERMENT_STATUSES} from "./ConservationStatusBar"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {TargetingMode} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import {Tooltip} from "SpectaclesUIKit.lspkg/Scripts/Tooltip"

type DangerStatusAliases = {
  label: string
  aliases: string[]
}

type DangerStatusColor = {
  label: string
  color: vec4
}

type DangerStatusDescription = {
  label: string
  description: string
}

const DANGER_STATUS_ALIASES: DangerStatusAliases[] = [
  {label: "No Info", aliases: ["no info", "unknown", "not available", "n/a", "na"]},
  {label: "Not Evaluated", aliases: ["not evaluated", "ne"]},
  {label: "Data Deficient", aliases: ["data deficient", "dd"]},
  {label: "Least Concern", aliases: ["least concern", "lc", "secure"]},
  {label: "Near Threatened", aliases: ["near threatened", "nt", "watch"]},
  {label: "Vulnerable", aliases: ["vulnerable", "vu", "threatened"]},
  {label: "Endangered", aliases: ["endangered", "en"]},
  {label: "Critically Endangered", aliases: ["critically endangered", "critical", "cr"]},
  {label: "Extinct in the Wild", aliases: ["extinct in the wild", "extinct wild", "ew"]},
  {label: "Extinct", aliases: ["extinct", "ex"]}
]

const DANGER_STATUS_COLORS: DangerStatusColor[] = [
  {label: "No Info", color: new vec4(0.92, 0.92, 0.92, 1)},
  {label: "Not Evaluated", color: new vec4(0.82, 0.94, 1, 1)},
  {label: "Data Deficient", color: new vec4(0.72, 0.88, 1, 1)},
  {label: "Least Concern", color: new vec4(0.36, 1, 0.5, 1)},
  {label: "Near Threatened", color: new vec4(1, 0.95, 0.25, 1)},
  {label: "Vulnerable", color: new vec4(1, 0.66, 0.22, 1)},
  {label: "Endangered", color: new vec4(1, 0.38, 0.24, 1)},
  {label: "Critically Endangered", color: new vec4(1, 0.22, 0.42, 1)},
  {label: "Extinct in the Wild", color: new vec4(0.86, 0.48, 1, 1)},
  {label: "Extinct", color: new vec4(0.96, 0.96, 1, 1)}
]

const DANGER_STATUS_DESCRIPTIONS: DangerStatusDescription[] = [
  {label: "No Info", description: "No conservation status is available for this butterfly."},
  {label: "Not Evaluated", description: "This butterfly has not been evaluated for conservation risk."},
  {label: "Data Deficient", description: "There is not enough data to assess this butterfly's risk."},
  {label: "Least Concern", description: "Currently widespread or stable with low immediate risk."},
  {label: "Near Threatened", description: "Close to qualifying as threatened; continued monitoring is needed."},
  {label: "Vulnerable", description: "Facing a high risk of decline without protection."},
  {label: "Endangered", description: "Facing a very high risk of extinction in the wild."},
  {label: "Critically Endangered", description: "Facing an extremely high risk of extinction in the wild."},
  {label: "Extinct in the Wild", description: "Known only in captivity or outside its natural range."},
  {label: "Extinct", description: "No known living individuals remain."}
]

const TOOLTIP_RENDER_ORDER = 5000
const TOOLTIP_LOCAL_POSITION = new vec3(0, -2.6, 0.08)
const TOOLTIP_LOCAL_SCALE = 0.72
const HOVER_COLLIDER_SIZE = new vec3(16, 5, 1)

@component
export class DangerStatusText extends BaseScriptComponent {
  @input
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("No Info", "No Info"),
      new ComboBoxItem("Not Evaluated", "Not Evaluated"),
      new ComboBoxItem("Data Deficient", "Data Deficient"),
      new ComboBoxItem("Least Concern", "Least Concern"),
      new ComboBoxItem("Near Threatened", "Near Threatened"),
      new ComboBoxItem("Vulnerable", "Vulnerable"),
      new ComboBoxItem("Endangered", "Endangered"),
      new ComboBoxItem("Critically Endangered", "Critically Endangered"),
      new ComboBoxItem("Extinct in the Wild", "Extinct in the Wild"),
      new ComboBoxItem("Extinct", "Extinct")
    ])
  )
  status: string = "No Info"

  private textComponent!: Text
  private descriptionObject!: SceneObject
  private statusTooltip!: Tooltip
  private interactable!: Interactable
  private collider!: ColliderComponent
  private appliedSourceText: string = ""
  private appliedStatus: string = ""

  onAwake(): void {
    this.textComponent = this.sceneObject.getComponent("Component.Text") as Text
    this.createDescriptionText()
    this.setupHoverInteraction()
    const currentText = this.textComponent?.text || ""
    if (this.shouldUseInputStatus(currentText)) {
      this.setStatus(this.status)
    } else {
      this.applyColorForText(currentText)
    }
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  public setStatus(value: string): void {
    const normalizedStatus = this.normalizeStatus(value)
    this.status = normalizedStatus
    this.appliedStatus = normalizedStatus
    this.appliedSourceText = normalizedStatus
    if (this.textComponent) {
      this.textComponent.text = normalizedStatus
      this.applyTextColor(this.colorForStatus(normalizedStatus))
      this.updateDescriptionText()
    }
  }

  private onUpdate(): void {
    if (!this.textComponent) {
      return
    }

    if (this.textComponent.text !== this.appliedSourceText) {
      this.applyColorForText(this.textComponent.text)
      return
    }

    if (this.status !== this.appliedStatus) {
      this.setStatus(this.status)
    }
  }

  private applyColorForText(value: string): void {
    const normalizedStatus = this.normalizeStatus(value)
    this.status = normalizedStatus
    this.appliedStatus = normalizedStatus
    this.appliedSourceText = value
    this.applyTextColor(this.colorForStatus(normalizedStatus))
    this.updateDescriptionText()
  }

  private normalizeStatus(value: string): string {
    const normalizedValue = (value || "").toLowerCase().replace(/[_-]/g, " ").trim()
    for (let i = 0; i < BUTTERFLY_ENDANGERMENT_STATUSES.length; i++) {
      const status = BUTTERFLY_ENDANGERMENT_STATUSES[i]
      if (status.label.toLowerCase() === normalizedValue) {
        return status.label
      }
    }

    for (let i = 0; i < DANGER_STATUS_ALIASES.length; i++) {
      const statusAliases = DANGER_STATUS_ALIASES[i]
      for (let j = 0; j < statusAliases.aliases.length; j++) {
        if (statusAliases.aliases[j] === normalizedValue) {
          return statusAliases.label
        }
      }
    }
    return value || "No Info"
  }

  private colorForStatus(label: string): vec4 {
    for (let i = 0; i < DANGER_STATUS_COLORS.length; i++) {
      const statusColor = DANGER_STATUS_COLORS[i]
      if (statusColor.label === label) {
        return statusColor.color
      }
    }
    return DANGER_STATUS_COLORS[0].color
  }

  private applyTextColor(color: vec4): void {
    this.textComponent.textFill.mode = TextFillMode.Solid
    this.textComponent.textFill.color = color
  }

  private createDescriptionText(): void {
    this.descriptionObject = global.scene.createSceneObject("danger_status_description")
    this.descriptionObject.layer = this.sceneObject.layer
    this.descriptionObject.setParent(this.sceneObject)
    this.descriptionObject.getTransform().setLocalPosition(TOOLTIP_LOCAL_POSITION)
    this.descriptionObject.getTransform().setLocalScale(vec3.one().uniformScale(TOOLTIP_LOCAL_SCALE))
    this.statusTooltip = this.descriptionObject.createComponent(Tooltip.getTypeName()) as Tooltip
    this.statusTooltip.renderOrder = TOOLTIP_RENDER_ORDER
    this.statusTooltip.setOn(false)
  }

  private setupHoverInteraction(): void {
    const boxShape = Shape.createBoxShape()
    boxShape.size = HOVER_COLLIDER_SIZE
    this.collider = this.sceneObject.createComponent("ColliderComponent") as ColliderComponent
    this.collider.fitVisual = false
    this.collider.shape = boxShape
    this.interactable = this.sceneObject.createComponent(Interactable.getTypeName()) as Interactable
    this.interactable.targetingMode = TargetingMode.All
    this.interactable.onHoverEnter.add(() => this.showDescription())
    this.interactable.onHoverExit.add(() => this.hideDescription())
    this.interactable.onSyncHoverEnter.add(() => this.showDescription())
    this.interactable.onSyncHoverExit.add(() => this.hideDescription())
  }

  private showDescription(): void {
    this.updateDescriptionText()
    this.statusTooltip?.setOn(true)
  }

  private hideDescription(): void {
    this.statusTooltip?.setOn(false)
  }

  private updateDescriptionText(): void {
    if (!this.statusTooltip) {
      return
    }
    this.statusTooltip.tip = this.appliedStatus + ": " + this.descriptionForStatus(this.appliedStatus)
  }

  private descriptionForStatus(label: string): string {
    for (let i = 0; i < DANGER_STATUS_DESCRIPTIONS.length; i++) {
      const statusDescription = DANGER_STATUS_DESCRIPTIONS[i]
      if (statusDescription.label === label) {
        return statusDescription.description
      }
    }
    return DANGER_STATUS_DESCRIPTIONS[0].description
  }

  private shouldUseInputStatus(value: string): boolean {
    const normalizedValue = (value || "").toLowerCase().trim()
    return normalizedValue === "" || normalizedValue === "text" || normalizedValue === "text2"
  }
}
