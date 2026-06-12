import {InteractorEvent} from "SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent"
import {StateName} from "SpectaclesUIKit.lspkg/Scripts/Components/Element"
import {VisualElement} from "SpectaclesUIKit.lspkg/Scripts/Components/VisualElement"
import {SnapOS2Styles} from "SpectaclesUIKit.lspkg/Scripts/Themes/SnapOS-2.0/SnapOS2"
import {Tooltip} from "SpectaclesUIKit.lspkg/Scripts/Tooltip"
import {GradientParameters} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {
  RoundedRectangleVisual,
  RoundedRectangleVisualParameters
} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangleVisual"

type SeasonRecord = {
  [key: string]: unknown
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
const SEASON_RECORD_FIELDS = ["activeMonths", "seasonMonths", "months", "inViewMonths", "flightMonths"]
const SEASON_START_FIELDS = ["startMonth", "seasonStart", "start", "flightStart"]
const SEASON_END_FIELDS = ["endMonth", "seasonEnd", "end", "flightEnd"]
const TOOLTIP_RENDER_ORDER = 5000
const TOOLTIP_LOCAL_Z_OFFSET = 1.25
const ACTIVE_TEXT_COLOR = new vec4(1, 1, 1, 0.96)
const INACTIVE_TEXT_COLOR = new vec4(0.72, 0.72, 0.72, 0.42)
const GRID_WIDTH_RATIO = 0.82
const GRID_HEIGHT_RATIO = 0.72
const MONTH_TEXT_HEIGHT_RATIO = 10.0
const BLOB_ROW_WIDTH_PADDING_RATIO = 0.24
const BLOB_ROW_HEIGHT_RATIO = 0.5
const BLOB_ANIMATION_SPEED = 0.09
const BLOB_CORE_ALPHA = 0.28

const GRADIENT_BLUE = new vec4(0.15, 0.7, 1, 1)
const GRADIENT_GREEN = new vec4(0.25, 1, 0.5, 1)

const HIT_AREA_STYLE: Partial<RoundedRectangleVisualParameters> = {
  default: {
    baseType: "Color",
    baseColor: new vec4(0, 0, 0, 0),
    hasBorder: false
  },
  hovered: {
    baseColor: new vec4(1, 1, 1, 0.035)
  },
  triggered: {
    baseColor: new vec4(1, 1, 1, 0.055)
  },
  inactive: {
    baseColor: new vec4(0, 0, 0, 0)
  }
}

const SEASON_BLOB_STYLE: Partial<RoundedRectangleVisualParameters> = {
  default: {
    baseType: "Gradient",
    baseGradient: {
      type: "Linear",
      start: new vec2(-0.9, 0),
      end: new vec2(0.9, 0),
      stop0: {enabled: true, percent: 0, color: new vec4(0.25, 1, 0.5, BLOB_CORE_ALPHA)},
      stop1: {enabled: true, percent: 0.48, color: new vec4(0.15, 0.7, 1, BLOB_CORE_ALPHA)},
      stop2: {enabled: true, percent: 0.82, color: new vec4(0.25, 1, 0.5, BLOB_CORE_ALPHA)},
      stop3: {enabled: true, percent: 1, color: new vec4(0.25, 1, 0.5, BLOB_CORE_ALPHA)}
    },
    hasBorder: false
  },
  hovered: {
    baseType: "Gradient"
  },
  triggered: {
    baseType: "Gradient"
  },
  inactive: {
    baseType: "Gradient"
  }
}

@component
export class SeasonCalendar extends VisualElement {
  protected _style: SnapOS2Styles = SnapOS2Styles.Custom

  @input
  activeMonths: string[] = ["mar", "apr", "may", "jun", "jul", "aug", "sep", "oct"]

  @input
  startMonth: string = ""

  @input
  endMonth: string = ""

  private monthTexts: Text[] = []
  private seasonBlobObject!: SceneObject
  private seasonBlobPieces: RoundedRectangleVisual[] = []
  private calendarTooltipObject!: SceneObject
  private calendarTooltip!: Tooltip
  private calendarTooltipTransform!: Transform
  private hideTooltipEvent!: DelayedCallbackEvent
  private appliedSeasonKey: string = ""
  private activeMonthFlags: boolean[] = []

  public onAwake() {
    super.onAwake()
    this.hideTooltipEvent = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    this.hideTooltipEvent.bind(() => {
      this.calendarTooltip?.setOn(false)
    })
  }

  public initialize(): void {
    this.inactive = false
    this.hasShadow = false
    this.createTooltip()
    super.initialize()
    this.buildMonthGrid()
    this.refreshCalendar()
  }

  public setActiveMonths(months: string[]): void {
    this.activeMonths = months || []
    this.startMonth = ""
    this.endMonth = ""
    this.refreshCalendar()
  }

  public setActiveMonthRange(startMonth: string, endMonth: string): void {
    this.startMonth = startMonth || ""
    this.endMonth = endMonth || ""
    this.activeMonths = this.monthRange(this.startMonth, this.endMonth)
    this.refreshCalendar()
  }

  public setSeasonFromDatabase(value: unknown): void {
    if (value === null || value === undefined || value === "") {
      this.clearSeason()
      return
    }

    if (Array.isArray(value)) {
      this.setActiveMonths(value.map((month) => String(month)))
      return
    }

    if (typeof value === "string") {
      this.setActiveMonths(this.parseMonthString(value))
      return
    }

    if (typeof value === "object") {
      this.setSeasonFromDatabaseRecord(value as SeasonRecord)
      return
    }

    this.clearSeason()
  }

  public setSeasonFromDatabaseRecord(record: SeasonRecord): void {
    if (!record) {
      this.clearSeason()
      return
    }

    const start = this.firstRecordField(record, SEASON_START_FIELDS)
    const end = this.firstRecordField(record, SEASON_END_FIELDS)
    if (start !== undefined && end !== undefined) {
      this.setActiveMonthRange(String(start), String(end))
      return
    }

    for (let i = 0; i < SEASON_RECORD_FIELDS.length; i++) {
      const field = SEASON_RECORD_FIELDS[i]
      if (record[field] !== undefined && record[field] !== null && record[field] !== "") {
        this.setSeasonFromDatabase(record[field])
        return
      }
    }

    this.clearSeason()
  }

  public clearSeason(): void {
    this.activeMonths = []
    this.startMonth = ""
    this.endMonth = ""
    this.refreshCalendar()
  }

  public getActiveMonths(): string[] {
    return this.activeMonthFlags
      .map((isActive, index) => (isActive ? MONTHS[index] : ""))
      .filter((month) => month !== "")
  }

  protected createDefaultVisual(): void {
    if (!this.visual) {
      const hitArea = new RoundedRectangleVisual({
        sceneObject: this.sceneObject,
        style: HIT_AREA_STYLE
      })
      hitArea.cornerRadius = Math.max(0.25, this.size.y * 0.08)
      this.visual = hitArea
    }
  }

  protected setState(stateName: StateName): void {
    super.setState(stateName)
    for (let i = 0; i < this.seasonBlobPieces.length; i++) {
      this.seasonBlobPieces[i].setState(stateName)
    }
  }

  protected update(): void {
    const seasonKey = this.getSeasonKey()
    if (seasonKey !== this.appliedSeasonKey) {
      this.relayoutMonthGrid()
      this.refreshCalendar()
    }
    this.animateSeasonBlob()
    this.positionTooltip()
  }

  protected onTriggerUpHandler(event: InteractorEvent): void {
    super.onTriggerUpHandler(event)
    this.showTooltipForTap()
  }

  private buildMonthGrid(): void {
    if (this.monthTexts.length > 0) {
      return
    }

    const gridWidth = this.gridWidth
    const gridHeight = this.gridHeight
    const cellWidth = gridWidth / 4
    const cellHeight = gridHeight / 3
    const firstX = -gridWidth * 0.5 + cellWidth * 0.5
    const firstY = this.gridCenterY + gridHeight * 0.5 - cellHeight * 0.5

    this.seasonBlobObject = global.scene.createSceneObject("SeasonBlob")
    this.seasonBlobObject.layer = this.sceneObject.layer
    this.seasonBlobObject.setParent(this.sceneObject)
    this.managedSceneObjects.add(this.seasonBlobObject)

    for (let i = 0; i < MONTHS.length; i++) {
      const column = i % 4
      const row = Math.floor(i / 4)
      const x = firstX + column * cellWidth
      const y = firstY - row * cellHeight

      const textObject = global.scene.createSceneObject("SeasonMonthText")
      textObject.layer = this.sceneObject.layer
      textObject.setParent(this.sceneObject)
      this.managedSceneObjects.add(textObject)
      textObject.getTransform().setLocalPosition(new vec3(x, y, 0.03))
      const textComponent = textObject.createComponent("Component.Text") as Text
      textComponent.text = MONTHS[i]
      textComponent.sizeToFit = false
      textComponent.size = this.monthTextSize
      textComponent.horizontalAlignment = HorizontalAlignment.Center
      textComponent.verticalAlignment = VerticalAlignment.Center
      textComponent.textFill.color = INACTIVE_TEXT_COLOR
      textComponent.renderOrder = this.renderOrder + 4
      this.monthTexts.push(textComponent)
    }
  }

  private refreshCalendar(): void {
    this.activeMonthFlags = this.getActiveMonthFlags()

    for (let i = 0; i < MONTHS.length; i++) {
      const isActive = this.activeMonthFlags[i]
      this.monthTexts[i].textFill.color = isActive ? ACTIVE_TEXT_COLOR : INACTIVE_TEXT_COLOR
    }

    this.updateSeasonBlob()

    this.updateTooltipText()
    this.appliedSeasonKey = this.getSeasonKey()
  }

  private relayoutMonthGrid(): void {
    if (this.monthTexts.length === 0) {
      return
    }

    const gridWidth = this.gridWidth
    const gridHeight = this.gridHeight
    const cellWidth = gridWidth / 4
    const cellHeight = gridHeight / 3
    const firstX = -gridWidth * 0.5 + cellWidth * 0.5
    const firstY = this.gridCenterY + gridHeight * 0.5 - cellHeight * 0.5

    for (let i = 0; i < this.monthTexts.length; i++) {
      const column = i % 4
      const row = Math.floor(i / 4)
      const x = firstX + column * cellWidth
      const y = firstY - row * cellHeight
      this.monthTexts[i].getSceneObject().getTransform().setLocalPosition(new vec3(x, y, 0.03))
      this.monthTexts[i].size = this.monthTextSize
    }
  }

  private getActiveMonthFlags(): boolean[] {
    const flags = MONTHS.map(() => false)
    const months = this.startMonth && this.endMonth ? this.monthRange(this.startMonth, this.endMonth) : this.activeMonths

    for (let i = 0; i < months.length; i++) {
      const index = this.monthIndex(months[i])
      if (index >= 0) {
        flags[index] = true
      }
    }

    return flags
  }

  private updateSeasonBlob(): void {
    const gridWidth = this.gridWidth
    const gridHeight = this.gridHeight
    const cellWidth = gridWidth / 4
    const cellHeight = gridHeight / 3
    const rowRuns: {row: number; startColumn: number; endColumn: number}[] = []

    for (let row = 0; row < 3; row++) {
      let column = 0
      while (column < 4) {
        const monthIndex = row * 4 + column
        if (!this.activeMonthFlags[monthIndex]) {
          column++
          continue
        }

        const startColumn = column
        while (column + 1 < 4 && this.activeMonthFlags[row * 4 + column + 1]) {
          column++
        }
        rowRuns.push({row, startColumn, endColumn: column})
        column++
      }
    }

    let pieceIndex = 0
    for (let i = 0; i < rowRuns.length; i++) {
      const run = rowRuns[i]
      const startX = this.monthCenterX(run.startColumn, cellWidth, gridWidth)
      const endX = this.monthCenterX(run.endColumn, cellWidth, gridWidth)
      const centerX = (startX + endX) * 0.5
      const centerY = this.monthCenterY(run.row, cellHeight, gridHeight)
      const width = endX - startX + cellWidth * (1 + BLOB_ROW_WIDTH_PADDING_RATIO * 2)
      const height = cellHeight * BLOB_ROW_HEIGHT_RATIO
      pieceIndex = this.placeBlobPiece(pieceIndex, centerX, centerY, width, height)
    }

    for (let i = pieceIndex; i < this.seasonBlobPieces.length; i++) {
      this.seasonBlobPieces[i].disable()
    }
  }

  private placeBlobPiece(index: number, x: number, y: number, width: number, height: number): number {
    const blobPiece = this.getBlobPiece(index)
    blobPiece.enable()
    blobPiece.transform.setLocalPosition(new vec3(x, y, 0.01))
    blobPiece.size = new vec3(width, height, this.size.z)
    blobPiece.cornerRadius = height * 0.5
    return index + 1
  }

  private getBlobPiece(index: number): RoundedRectangleVisual {
    if (this.seasonBlobPieces[index]) {
      return this.seasonBlobPieces[index]
    }

    const blobPieceObject = global.scene.createSceneObject("SeasonBlobCore")
    blobPieceObject.layer = this.sceneObject.layer
    blobPieceObject.setParent(this.seasonBlobObject || this.sceneObject)
    this.managedSceneObjects.add(blobPieceObject)
    const blobPiece = new RoundedRectangleVisual({
      sceneObject: blobPieceObject,
      style: SEASON_BLOB_STYLE
    })
    blobPiece.initialize()
    blobPiece.renderMeshVisual.renderOrder = this.renderOrder + 1
    blobPiece.baseType = "Gradient"
    this.seasonBlobPieces[index] = blobPiece
    return blobPiece
  }

  private animateSeasonBlob(): void {
    if (this.seasonBlobPieces.length === 0) {
      return
    }

    const phase = getTime() * BLOB_ANIMATION_SPEED
    for (let i = 0; i < this.seasonBlobPieces.length; i++) {
      const piece = this.seasonBlobPieces[i]
      const gradient = this.seasonGradient(phase + i * 0.08, BLOB_CORE_ALPHA)
      piece.defaultGradient = gradient
      piece.hoveredGradient = gradient
      piece.triggeredGradient = gradient
      piece.inactiveGradient = gradient
    }
  }

  private seasonGradient(phase: number, alpha: number): GradientParameters {
    const green = this.withAlpha(this.blendGradientColor(phase), alpha)
    const blue = this.withAlpha(this.blendGradientColor(phase + 0.42), alpha)
    const greenTail = this.withAlpha(this.blendGradientColor(phase + 0.84), alpha)
    const drift = -Math.sin(phase) * 0.12
    return {
      type: "Linear",
      start: new vec2(-0.9 + drift, 0),
      end: new vec2(0.9 + drift, 0),
      stop0: {enabled: true, percent: 0, color: green},
      stop1: {enabled: true, percent: 0.46, color: blue},
      stop2: {enabled: true, percent: 0.8, color: greenTail},
      stop3: {enabled: true, percent: 1, color: green}
    }
  }

  private blendGradientColor(phase: number): vec4 {
    const normalizedPhase = phase - Math.floor(phase)
    if (normalizedPhase < 0.5) {
      return this.lerpColor(GRADIENT_GREEN, GRADIENT_BLUE, normalizedPhase / 0.5)
    }
    return this.lerpColor(GRADIENT_BLUE, GRADIENT_GREEN, (normalizedPhase - 0.5) / 0.5)
  }

  private lerpColor(from: vec4, to: vec4, t: number): vec4 {
    const clampedT = Math.max(0, Math.min(1, t))
    return new vec4(
      from.x + (to.x - from.x) * clampedT,
      from.y + (to.y - from.y) * clampedT,
      from.z + (to.z - from.z) * clampedT,
      from.w + (to.w - from.w) * clampedT
    )
  }

  private withAlpha(color: vec4, alpha: number): vec4 {
    return new vec4(color.x, color.y, color.z, alpha)
  }

  private monthCenterX(column: number, cellWidth: number, gridWidth: number): number {
    return -gridWidth * 0.5 + cellWidth * 0.5 + column * cellWidth
  }

  private monthCenterY(row: number, cellHeight: number, gridHeight: number): number {
    return this.gridCenterY + gridHeight * 0.5 - cellHeight * 0.5 - row * cellHeight
  }

  private monthRange(startMonth: string, endMonth: string): string[] {
    const startIndex = this.monthIndex(startMonth)
    const endIndex = this.monthIndex(endMonth)
    if (startIndex < 0 || endIndex < 0) {
      return []
    }

    const months: string[] = []
    let index = startIndex
    while (true) {
      months.push(MONTHS[index])
      if (index === endIndex) {
        break
      }
      index = (index + 1) % MONTHS.length
    }
    return months
  }

  private parseMonthString(value: string): string[] {
    const normalizedValue = value.toLowerCase().replace(/\s+to\s+/g, "-").replace(/\s+through\s+/g, "-")
    const rangeMatch = normalizedValue.match(/([a-z]+)\s*-\s*([a-z]+)/)
    if (rangeMatch) {
      return this.monthRange(rangeMatch[1], rangeMatch[2])
    }
    return normalizedValue
      .split(/[,;/\s]+/)
      .map((month) => this.normalizeMonth(month))
      .filter((month) => month !== "")
  }

  private updateTooltipText(): void {
    if (!this.calendarTooltip) {
      return
    }

    const activeMonths = this.getActiveMonths()
    if (activeMonths.length === 0) {
      this.calendarTooltip.tip = "In view season: no common observation months are available."
      return
    }

    this.calendarTooltip.tip =
      "In view season: most commonly observed here from " +
      activeMonths[0] +
      " to " +
      activeMonths[activeMonths.length - 1] +
      "."
  }

  private createTooltip(): void {
    if (this.calendarTooltip) {
      return
    }
    const tooltipObject = global.scene.createSceneObject("SeasonTooltip")
    tooltipObject.layer = this.sceneObject.layer
    tooltipObject.setParent(this.getTooltipParent())
    this.calendarTooltipObject = tooltipObject
    this.calendarTooltipTransform = tooltipObject.getTransform()
    this.calendarTooltipTransform.setLocalScale(vec3.one().uniformScale(0.86))
    this.managedSceneObjects.add(tooltipObject)
    this.calendarTooltip = tooltipObject.createComponent(Tooltip.getTypeName()) as Tooltip
    this.calendarTooltip.renderOrder = TOOLTIP_RENDER_ORDER
    this.registerTooltip(this.calendarTooltip)
  }

  private positionTooltip(): void {
    if (!this.calendarTooltipTransform) {
      return
    }
    const tooltipParent = this.getTooltipParent()
    if (this.calendarTooltipObject.getParent() !== tooltipParent) {
      this.calendarTooltipObject.setParent(tooltipParent)
    }
    const tooltipLocalPosition = new vec3(0, this.size.y * 0.48, TOOLTIP_LOCAL_Z_OFFSET)
    const tooltipWorldPosition = this.transform.getWorldTransform().multiplyPoint(tooltipLocalPosition)
    this.calendarTooltipTransform.setWorldPosition(tooltipWorldPosition)
    this.calendarTooltipTransform.setWorldRotation(this.transform.getWorldRotation())
  }

  private showTooltipForTap(): void {
    this.calendarTooltip?.setOn(true)
    this.hideTooltipEvent?.reset(2.4)
  }

  private getSeasonKey(): string {
    return (
      this.startMonth +
      "|" +
      this.endMonth +
      "|" +
      (this.activeMonths || []).join(",") +
      "|" +
      this.size.x.toFixed(3) +
      "," +
      this.size.y.toFixed(3)
    )
  }

  private get gridWidth(): number {
    return this.size.x * GRID_WIDTH_RATIO
  }

  private get gridHeight(): number {
    return this.size.y * GRID_HEIGHT_RATIO
  }

  private get monthTextSize(): number {
    return this.gridHeight * MONTH_TEXT_HEIGHT_RATIO
  }

  private get gridCenterY(): number {
    return 0
  }

  private normalizeMonth(value: string): string {
    const normalized = (value || "").toLowerCase().trim().substring(0, 3)
    return MONTHS.indexOf(normalized) >= 0 ? normalized : ""
  }

  private monthIndex(value: string): number {
    return MONTHS.indexOf(this.normalizeMonth(value))
  }

  private firstRecordField(record: SeasonRecord, fields: string[]): unknown {
    for (let i = 0; i < fields.length; i++) {
      const value = record[fields[i]]
      if (value !== undefined && value !== null && value !== "") {
        return value
      }
    }
    return undefined
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
