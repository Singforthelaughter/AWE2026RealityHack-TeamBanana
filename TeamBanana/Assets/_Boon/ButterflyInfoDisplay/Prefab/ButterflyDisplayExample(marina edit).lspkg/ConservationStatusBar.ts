import {InteractorEvent} from "SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent"
import {StateName} from "SpectaclesUIKit.lspkg/Scripts/Components/Element"
import {VisualElement} from "SpectaclesUIKit.lspkg/Scripts/Components/VisualElement"
import {SnapOS2Styles} from "SpectaclesUIKit.lspkg/Scripts/Themes/SnapOS-2.0/SnapOS2"
import {Tooltip} from "SpectaclesUIKit.lspkg/Scripts/Tooltip"
import {
  RoundedRectangleVisual,
  RoundedRectangleVisualParameters
} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangleVisual"

export type ConservationStatus = {
  label: string
  explanation: string
  value: number
}

export type StatusRecord = {
  [key: string]: unknown
}

export const BUTTERFLY_ENDANGERMENT_STATUSES: ConservationStatus[] = [
  {
    label: "No Info",
    explanation: "Conservation status is not available for this butterfly.",
    value: 0.5
  },
  {
    label: "Not Evaluated",
    explanation: "This butterfly has not been evaluated for conservation risk.",
    value: 0.5
  },
  {
    label: "Data Deficient",
    explanation: "There is not enough data to assess this butterfly's conservation risk.",
    value: 0.5
  },
  {
    label: "Least Concern",
    explanation: "Population is stable with low immediate conservation concern.",
    value: 0
  },
  {
    label: "Near Threatened",
    explanation: "Population is close to qualifying for a threatened category.",
    value: 0.18
  },
  {
    label: "Vulnerable",
    explanation: "Population faces a high risk of decline without protection.",
    value: 0.36
  },
  {
    label: "Endangered",
    explanation: "Population faces a very high risk of extinction in the wild.",
    value: 0.58
  },
  {
    label: "Critically Endangered",
    explanation: "Population faces an extremely high risk of extinction in the wild.",
    value: 0.78
  },
  {
    label: "Extinct in the Wild",
    explanation: "This butterfly is known only in captivity or outside its natural range.",
    value: 0.9
  },
  {
    label: "Extinct",
    explanation: "There are no known living individuals of this butterfly.",
    value: 1
  }
]

const STATUSES = BUTTERFLY_ENDANGERMENT_STATUSES

const STATUS_BAR_STYLE: Partial<RoundedRectangleVisualParameters> = {
  default: {
    baseType: "Gradient",
    baseGradient: {
      type: "Linear",
      start: new vec2(-1, 0),
      end: new vec2(1, 0),
      stop0: {enabled: true, percent: 0, color: new vec4(0.12, 0.72, 0.27, 1)},
      stop1: {enabled: true, percent: 0.35, color: new vec4(0.95, 0.86, 0.18, 1)},
      stop2: {enabled: true, percent: 0.65, color: new vec4(0.95, 0.48, 0.12, 1)},
      stop3: {enabled: true, percent: 1, color: new vec4(0.83, 0.12, 0.12, 1)}
    },
    hasBorder: true,
    borderSize: 0.06,
    borderType: "Color",
    borderColor: new vec4(1, 1, 1, 0.38)
  },
  hovered: {
    borderColor: new vec4(1, 1, 1, 0.72)
  },
  triggered: {
    borderColor: new vec4(1, 1, 1, 0.9)
  },
  inactive: {
    borderColor: new vec4(1, 1, 1, 0.38)
  }
}

const NO_INFO_BAR_STYLE: Partial<RoundedRectangleVisualParameters> = {
  default: {
    baseType: "Gradient",
    baseGradient: {
      type: "Linear",
      start: new vec2(-1, 0),
      end: new vec2(1, 0),
      stop0: {enabled: true, percent: 0, color: new vec4(0.28, 0.28, 0.28, 1)},
      stop1: {enabled: true, percent: 0.5, color: new vec4(0.42, 0.42, 0.42, 1)},
      stop2: {enabled: true, percent: 1, color: new vec4(0.28, 0.28, 0.28, 1)}
    },
    hasBorder: true,
    borderSize: 0.06,
    borderType: "Color",
    borderColor: new vec4(1, 1, 1, 0.22)
  },
  hovered: {
    borderColor: new vec4(1, 1, 1, 0.38)
  },
  triggered: {
    borderColor: new vec4(1, 1, 1, 0.48)
  },
  inactive: {
    borderColor: new vec4(1, 1, 1, 0.22)
  }
}

const TOOLTIP_RENDER_ORDER = 5000
const TOOLTIP_LOCAL_Z_OFFSET = 1.25
const STATUS_RECORD_FIELDS = [
  "status",
  "conservationStatus",
  "conservation_status",
  "iucnStatus",
  "iucn_status",
  "redList",
  "red_list",
  "danger",
  "dangerStatus",
  "danger_status",
  "risk",
  "riskLevel",
  "risk_level"
]

const PIN_STYLE: Partial<RoundedRectangleVisualParameters> = {
  default: {
    baseType: "Color",
    baseColor: new vec4(1, 1, 1, 1),
    hasBorder: true,
    borderSize: 0.05,
    borderType: "Color",
    borderColor: new vec4(0.05, 0.05, 0.05, 0.75)
  },
  hovered: {
    baseColor: new vec4(1, 1, 1, 1),
    borderColor: new vec4(0.05, 0.05, 0.05, 0.95)
  },
  triggered: {
    baseColor: new vec4(1, 1, 1, 1),
    borderColor: new vec4(0.05, 0.05, 0.05, 1)
  },
  inactive: {
    baseColor: new vec4(1, 1, 1, 1),
    borderColor: new vec4(0.05, 0.05, 0.05, 0.75)
  }
}

@component
export class ConservationStatusBar extends VisualElement {
  protected _style: SnapOS2Styles = SnapOS2Styles.Custom

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
  status: string = "Least Concern"

  private pinVisual!: RoundedRectangleVisual
  private barVisual!: RoundedRectangleVisual
  private statusTooltipObject!: SceneObject
  private statusTooltip!: Tooltip
  private statusTooltipTransform!: Transform
  private hideTooltipEvent!: DelayedCallbackEvent
  private _currentValue: number = 0
  private appliedStatus: string = ""

  public onAwake() {
    super.onAwake()
    this.hideTooltipEvent = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    this.hideTooltipEvent.bind(() => {
      this.statusTooltip?.setOn(false)
    })
  }

  public initialize(): void {
    this.inactive = false
    this.status = this.statusForLabel(this.status).label
    this.appliedStatus = this.status
    this._currentValue = this.valueForStatus(this.status)
    this.createTooltip()
    super.initialize()
    this.pinVisual.initialize()
    this.pinVisual.renderMeshVisual.renderOrder = this.renderOrder + 2
    this.pinVisual.size = this.pinSize
    this.positionPin()
    this.updateTooltipText()
  }

  public get currentValue(): number {
    return this._currentValue
  }

  public set currentValue(value: number) {
    this.setStatusValue(value)
  }

  public setStatus(label: string): void {
    const status = this.statusForLabel(label)
    this.status = status.label
    this.appliedStatus = status.label
    this._currentValue = status.value
    this.positionPin()
    this.updateTooltipText()
  }

  public setStatusFromDatabase(value: unknown): void {
    if (value === null || value === undefined || value === "") {
      this.clearStatus()
      return
    }

    if (typeof value === "number") {
      this.setStatusValue(value)
      return
    }

    if (typeof value === "string") {
      this.setStatus(this.normalizeDatabaseStatus(value))
      return
    }

    this.clearStatus()
  }

  public setStatusFromDatabaseRecord(record: StatusRecord): void {
    if (!record) {
      this.clearStatus()
      return
    }

    for (let i = 0; i < STATUS_RECORD_FIELDS.length; i++) {
      const field = STATUS_RECORD_FIELDS[i]
      if (record[field] !== undefined && record[field] !== null && record[field] !== "") {
        this.setStatusFromDatabase(record[field])
        return
      }
    }

    this.clearStatus()
  }

  public clearStatus(): void {
    this.setStatus("No Info")
  }

  public getStatusLabel(): string {
    return this.statusForLabel(this.status).label
  }

  public getStatusValue(): number {
    return this._currentValue
  }

  public setStatusValue(value: number): void {
    const status = this.nearestRiskStatus(value)
    this._currentValue = status.value
    this.status = status.label
    this.appliedStatus = this.status
    this.positionPin()
    this.updateTooltipText()
  }

  protected createDefaultVisual(): void {
    if (!this.visual) {
      const barVisual = new RoundedRectangleVisual({
        sceneObject: this.sceneObject,
        style: STATUS_BAR_STYLE
      })
      barVisual.cornerRadius = this.size.y * 0.35
      this.barVisual = barVisual
      this.visual = barVisual
    }

    if (!this.pinVisual) {
      const pinObject = global.scene.createSceneObject("StatusPin")
      pinObject.layer = this.sceneObject.layer
      pinObject.setParent(this.sceneObject)
      this.managedSceneObjects.add(pinObject)
      this.pinVisual = new RoundedRectangleVisual({
        sceneObject: pinObject,
        style: PIN_STYLE
      })
      this.pinVisual.cornerRadius = this.pinSize.x * 0.5
    }
  }

  protected setState(stateName: StateName): void {
    super.setState(stateName)
    this.pinVisual?.setState(stateName)
  }

  protected update(): void {
    if (this.status !== this.appliedStatus) {
      this.setStatus(this.status)
    }
    this.positionTooltip()
  }

  protected onTriggerUpHandler(event: InteractorEvent): void {
    super.onTriggerUpHandler(event)
    this.showTooltipForTap()
  }

  private createTooltip(): void {
    if (this.statusTooltip) {
      return
    }
    const tooltipObject = global.scene.createSceneObject("StatusTooltip")
    tooltipObject.layer = this.sceneObject.layer
    tooltipObject.setParent(this.getTooltipParent())
    this.statusTooltipObject = tooltipObject
    this.statusTooltipTransform = tooltipObject.getTransform()
    this.statusTooltipTransform.setLocalScale(vec3.one().uniformScale(0.72))
    this.managedSceneObjects.add(tooltipObject)
    this.statusTooltip = tooltipObject.createComponent(Tooltip.getTypeName()) as Tooltip
    this.statusTooltip.renderOrder = TOOLTIP_RENDER_ORDER
    this.registerTooltip(this.statusTooltip)
  }

  private positionPin(): void {
    if (!this.pinVisual) {
      return
    }
    if (this.isNoInfoStatus()) {
      this.pinVisual.disable()
      this.applyBarStyle(NO_INFO_BAR_STYLE)
      this.positionTooltip()
      return
    }
    this.pinVisual.enable()
    this.applyBarStyle(STATUS_BAR_STYLE)
    const pinX = MathUtils.remap(this._currentValue, 0, 1, -this.size.x * 0.5, this.size.x * 0.5)
    this.pinVisual.transform.setLocalPosition(new vec3(pinX, 0, 0.02))
    this.positionTooltip()
  }

  private positionTooltip(): void {
    if (!this.statusTooltipTransform) {
      return
    }
    const tooltipParent = this.getTooltipParent()
    if (this.statusTooltipObject.getParent() !== tooltipParent) {
      this.statusTooltipObject.setParent(tooltipParent)
    }
    const pinX = this.isNoInfoStatus()
      ? 0
      : MathUtils.remap(this._currentValue, 0, 1, -this.size.x * 0.5, this.size.x * 0.5)
    const tooltipLocalPosition = new vec3(pinX, this.size.y * 1.25, TOOLTIP_LOCAL_Z_OFFSET)
    const tooltipWorldPosition = this.transform.getWorldTransform().multiplyPoint(tooltipLocalPosition)
    this.statusTooltipTransform.setWorldPosition(tooltipWorldPosition)
    this.statusTooltipTransform.setWorldRotation(this.transform.getWorldRotation())
  }

  private updateTooltipText(): void {
    if (!this.statusTooltip) {
      return
    }
    const status = this.statusForLabel(this.status)
    this.statusTooltip.tip = status.label + ": " + status.explanation
  }

  private showTooltipForTap(): void {
    this.statusTooltip?.setOn(true)
    this.hideTooltipEvent?.reset(2.4)
  }

  private get pinSize(): vec3 {
    return new vec3(Math.max(0.45, this.size.y * 0.28), this.size.y * 1.35, this.size.z)
  }

  private valueForStatus(label: string): number {
    return this.statusForLabel(label).value
  }

  private applyBarStyle(style: Partial<RoundedRectangleVisualParameters>): void {
    if (!this.barVisual) {
      return
    }
    const defaultState = style.default
    if (defaultState.baseGradient) {
      this.barVisual.defaultGradient = defaultState.baseGradient
      this.barVisual.hoveredGradient = defaultState.baseGradient
      this.barVisual.triggeredGradient = defaultState.baseGradient
    }
    if (defaultState.borderColor) {
      this.barVisual.borderDefaultColor = defaultState.borderColor
    }
    const hoveredState = style.hovered
    if (hoveredState?.borderColor) {
      this.barVisual.borderHoveredColor = hoveredState.borderColor
    }
    const triggeredState = style.triggered
    if (triggeredState?.borderColor) {
      this.barVisual.borderTriggeredColor = triggeredState.borderColor
    }
  }

  private statusForLabel(label: string): ConservationStatus {
    const normalizedLabel = (label || "").toLowerCase()
    for (let i = 0; i < STATUSES.length; i++) {
      if (STATUSES[i].label.toLowerCase() === normalizedLabel) {
        return STATUSES[i]
      }
    }
    return STATUSES[0]
  }

  private normalizeDatabaseStatus(value: string): string {
    const normalizedValue = value.toLowerCase().replace(/[_-]/g, " ").trim()

    if (
      normalizedValue === "no info" ||
      normalizedValue === "unknown" ||
      normalizedValue === "not available" ||
      normalizedValue === "n/a" ||
      normalizedValue === "na"
    ) {
      return "No Info"
    }

    if (normalizedValue === "not evaluated" || normalizedValue === "ne") {
      return "Not Evaluated"
    }

    if (normalizedValue === "data deficient" || normalizedValue === "dd") {
      return "Data Deficient"
    }

    if (normalizedValue === "least concern" || normalizedValue === "secure" || normalizedValue === "lc") {
      return "Least Concern"
    }

    if (normalizedValue === "near threatened" || normalizedValue === "watch" || normalizedValue === "nt") {
      return "Near Threatened"
    }

    if (normalizedValue === "threatened" || normalizedValue === "vulnerable" || normalizedValue === "vu") {
      return "Vulnerable"
    }

    if (normalizedValue === "endangered" || normalizedValue === "en") {
      return "Endangered"
    }

    if (normalizedValue === "critically endangered" || normalizedValue === "critical" || normalizedValue === "cr") {
      return "Critically Endangered"
    }

    if (
      normalizedValue === "extinct in the wild" ||
      normalizedValue === "extinct wild" ||
      normalizedValue === "ew"
    ) {
      return "Extinct in the Wild"
    }

    if (normalizedValue === "extinct" || normalizedValue === "ex") {
      return "Extinct"
    }

    return value
  }

  private nearestRiskStatus(value: number): ConservationStatus {
    const clampedValue = MathUtils.clamp(value, 0, 1)
    let nearest = STATUSES[3]
    let nearestDistance = Math.abs(clampedValue - nearest.value)
    for (let i = 4; i < STATUSES.length; i++) {
      const distance = Math.abs(clampedValue - STATUSES[i].value)
      if (distance < nearestDistance) {
        nearest = STATUSES[i]
        nearestDistance = distance
      }
    }
    return nearest
  }

  private isNoInfoStatus(): boolean {
    const label = this.statusForLabel(this.status).label
    return label === "No Info" || label === "Not Evaluated" || label === "Data Deficient"
  }

  private getTooltipParent(): SceneObject {
    let parent = this.sceneObject.getParent()
    while (parent) {
      if (parent.name === "Butterfly Info Object") {
        return parent
      }
      parent = parent.getParent()
    }
    return this.sceneObject.getParent() || this.sceneObject
  }
}
