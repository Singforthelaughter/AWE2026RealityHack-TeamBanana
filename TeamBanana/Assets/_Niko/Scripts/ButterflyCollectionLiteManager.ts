import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractorEvent} from "SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent"
import {TargetingMode} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import {GridLayout, LayoutDirection} from "SpectaclesUIKit.lspkg/Scripts/Components/GridLayout/GridLayout"
import {ScrollWindow} from "SpectaclesUIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow"
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"

type LiteButterflyEntry = {
  id: string
  commonName: string
  discovered: boolean
  isNew?: boolean
}

type HoverLabelState = {
  label: Text
  transform: Transform
  baseY: number
  hiddenY: number
  alpha: number
  targetAlpha: number
}

const GENERATED_PREFIX = "GeneratedLiteButterflySlot_"
const COLUMNS = 3
const DEFAULT_CELL_WIDTH = 9.1
const DEFAULT_CELL_HEIGHT = 8.8
const DEFAULT_CELL_GAP = 0.55
const VIEWPORT_MARGIN_X = 1.2
const VIEWPORT_MARGIN_Y = 1.2
const SLOT_TEXT_SIZE = 24
const PLACEHOLDER_TEXT_SIZE = 42
const NEW_BADGE_TEXT_SIZE = 12
const LABEL_BOTTOM_Y_RATIO = -0.34
const LABEL_HIDDEN_OFFSET = -0.34
const LABEL_FADE_SPEED = 7.5
const LABEL_TEXT_COLOR = new vec4(1, 1, 1, 0.94)
const CARD_COLOR_DISCOVERED = new vec4(0.08, 0.1, 0.12, 0.78)
const CARD_COLOR_UNDISCOVERED = new vec4(0.03, 0.04, 0.05, 0.72)
const CARD_BORDER_COLOR = new vec4(1, 1, 1, 0.55)
const CARD_CORNER_RADIUS = 0.65
const CARD_BORDER_SIZE = 0.08
const DEFAULT_DATA =
  '[{"id":"monarch","commonName":"Monarch","discovered":true,"isNew":true},{"id":"painted-lady","commonName":"Painted Lady","discovered":true},{"id":"cloudless-sulphur","commonName":"Cloudless Sulphur","discovered":true},{"id":"swallowtail","commonName":"Swallowtail","discovered":false},{"id":"red-admiral","commonName":"Red Admiral","discovered":true,"isNew":true},{"id":"gray-hairstreak","commonName":"Gray Hairstreak","discovered":false}]'

@component
export class ButterflyCollectionLiteManager extends BaseScriptComponent {
  @input
  collectionDataJson: string = DEFAULT_DATA

  @input
  cellWidth: number = DEFAULT_CELL_WIDTH

  @input
  cellHeight: number = DEFAULT_CELL_HEIGHT

  @input
  cellGap: number = DEFAULT_CELL_GAP

  private gridObject: SceneObject | null = null
  private gridLayout: GridLayout | null = null
  private scrollWindow: ScrollWindow | null = null
  private hoverLabelStates: HoverLabelState[] = []

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.buildCollection()
    })
    this.createEvent("UpdateEvent").bind(() => {
      this.updateHoverLabels()
    })
  }

  public buildCollection(): void {
    this.resolveHierarchy()
    if (!this.gridObject || isNull(this.gridLayout)) {
      return
    }

    const entries = this.parseEntries(this.collectionDataJson)
    this.hoverLabelStates = []
    this.clearGridSlots()
    this.normalizeLayoutInputs()

    const rows = Math.max(1, Math.ceil(entries.length / COLUMNS))
    this.gridLayout.columns = COLUMNS
    this.gridLayout.rows = rows
    this.gridLayout.cellSize = new vec2(this.cellWidth, this.cellHeight)
    this.gridLayout.cellPadding = new vec4(this.cellGap, this.cellGap, this.cellGap, this.cellGap)
    this.gridLayout.layoutBy = LayoutDirection.Row

    for (let i = 0; i < entries.length; i++) {
      this.createTextSlot(entries[i])
    }

    if (!this.gridLayout.isInitialized) {
      this.gridLayout.initialize()
    }
    this.positionGridAtViewportTopLeft(rows)
    this.gridLayout.layout()
    this.updateScrollWindow(rows)
  }

  private createTextSlot(entry: LiteButterflyEntry): void {
    if (!this.gridObject) {
      return
    }

    const slotObject = global.scene.createSceneObject(GENERATED_PREFIX + entry.id)
    slotObject.layer = this.gridObject.layer
    slotObject.setParent(this.gridObject)
    slotObject.getTransform().setLocalPosition(vec3.zero())
    slotObject.getTransform().setLocalRotation(quat.quatIdentity())
    slotObject.getTransform().setLocalScale(vec3.one())

    this.createCardVisual(slotObject, entry.discovered)

    const labelObject = global.scene.createSceneObject("Label")
    labelObject.layer = slotObject.layer
    labelObject.setParent(slotObject)
    const labelBaseY = entry.discovered ? this.cellHeight * LABEL_BOTTOM_Y_RATIO : 0
    const labelHiddenY = labelBaseY + LABEL_HIDDEN_OFFSET
    labelObject.getTransform().setLocalPosition(new vec3(0, entry.discovered ? labelHiddenY : labelBaseY, 0.15))
    labelObject.getTransform().setLocalRotation(quat.quatIdentity())
    labelObject.getTransform().setLocalScale(vec3.one())

    const label = labelObject.createComponent("Component.Text") as Text
    label.text = entry.discovered ? entry.commonName : "?"
    label.size = entry.discovered ? SLOT_TEXT_SIZE : PLACEHOLDER_TEXT_SIZE
    label.sizeToFit = false
    label.horizontalAlignment = HorizontalAlignment.Center
    label.verticalAlignment = VerticalAlignment.Center
    label.textFill.color = entry.discovered ? new vec4(LABEL_TEXT_COLOR.x, LABEL_TEXT_COLOR.y, LABEL_TEXT_COLOR.z, 0) : new vec4(1, 1, 1, 0.45)
    label.renderOrder = 30

    if (entry.discovered) {
      const state: HoverLabelState = {
        label: label,
        transform: labelObject.getTransform(),
        baseY: labelBaseY,
        hiddenY: labelHiddenY,
        alpha: 0,
        targetAlpha: 0
      }
      this.hoverLabelStates.push(state)
      this.addSimpleHover(slotObject, state)
    }

    if (entry.discovered && entry.isNew) {
      const badgeObject = global.scene.createSceneObject("NewBadgeText")
      badgeObject.layer = slotObject.layer
      badgeObject.setParent(slotObject)
      badgeObject.getTransform().setLocalPosition(new vec3(this.cellWidth * 0.28, this.cellHeight * 0.32, 0.18))
      badgeObject.getTransform().setLocalRotation(quat.quatIdentity())
      badgeObject.getTransform().setLocalScale(vec3.one())

      const badge = badgeObject.createComponent("Component.Text") as Text
      badge.text = "NEW"
      badge.size = NEW_BADGE_TEXT_SIZE
      badge.sizeToFit = false
      badge.horizontalAlignment = HorizontalAlignment.Center
      badge.verticalAlignment = VerticalAlignment.Center
      badge.textFill.color = new vec4(1, 0.45, 0.25, 1)
      badge.renderOrder = 31
    }
  }

  private addSimpleHover(slotObject: SceneObject, state: HoverLabelState): void {
    const collider = slotObject.createComponent("ColliderComponent") as ColliderComponent
    collider.fitVisual = false
    const shape = Shape.createBoxShape()
    shape.size = new vec3(this.cellWidth, this.cellHeight, 1.8)
    collider.shape = shape
    collider.enabled = true

    const interactable = slotObject.createComponent(Interactable.getTypeName()) as Interactable
    interactable.targetingMode = TargetingMode.All
    interactable.enabled = true
    interactable.onHoverEnter.add((_eventData: InteractorEvent) => {
      state.targetAlpha = 1
    })
    interactable.onHoverExit.add((_eventData: InteractorEvent) => {
      state.targetAlpha = 0
    })
  }

  private updateHoverLabels(): void {
    if (this.hoverLabelStates.length === 0) {
      return
    }

    const t = Math.min(1, getDeltaTime() * LABEL_FADE_SPEED)
    for (let i = 0; i < this.hoverLabelStates.length; i++) {
      const state = this.hoverLabelStates[i]
      state.alpha = state.alpha + (state.targetAlpha - state.alpha) * t
      const y = state.hiddenY + (state.baseY - state.hiddenY) * state.alpha
      state.transform.setLocalPosition(new vec3(0, y, 0.15))
      state.label.textFill.color = new vec4(LABEL_TEXT_COLOR.x, LABEL_TEXT_COLOR.y, LABEL_TEXT_COLOR.z, LABEL_TEXT_COLOR.w * state.alpha)
    }
  }

  private createCardVisual(slotObject: SceneObject, discovered: boolean): void {
    const card = slotObject.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    card.size = new vec2(this.cellWidth, this.cellHeight)
    card.cornerRadius = CARD_CORNER_RADIUS
    card.backgroundColor = discovered ? CARD_COLOR_DISCOVERED : CARD_COLOR_UNDISCOVERED
    card.border = true
    card.borderSize = CARD_BORDER_SIZE
    card.borderColor = CARD_BORDER_COLOR
    card.renderOrder = 28
    card.initialize()
    card.renderMeshVisual.mainPass.blendMode = BlendMode.PremultipliedAlphaAuto
    card.renderMeshVisual.mainMaterial.mainPass.depthTest = false
  }

  private updateScrollWindow(rows: number): void {
    if (isNull(this.scrollWindow)) {
      return
    }

    const totalCellSize = this.gridLayout ? this.gridLayout.totalCellSize : new vec2(this.cellWidth, this.cellHeight)
    const width = Math.max(this.scrollWindow.windowSize.x, COLUMNS * totalCellSize.x)
    const height = Math.max(this.scrollWindow.windowSize.y, rows * totalCellSize.y)
    this.scrollWindow.horizontal = false
    this.scrollWindow.vertical = height > this.scrollWindow.windowSize.y
    this.scrollWindow.scrollSnapping = false
    this.scrollWindow.scrollDimensions = new vec2(width, height)
    this.scrollWindow.scrollPosition = vec2.zero()
  }

  private positionGridAtViewportTopLeft(rows: number): void {
    if (!this.gridObject || isNull(this.gridLayout) || isNull(this.scrollWindow)) {
      return
    }

    const totalCellSize = this.gridLayout.totalCellSize
    const rowCenterFromGridOrigin = rows > 1 ? ((rows - 1) * totalCellSize.y) * 0.5 : 0
    const desiredFirstRowCenterY = this.scrollWindow.windowSize.y * 0.5 - VIEWPORT_MARGIN_Y - this.cellHeight * 0.5
    const desiredGridY = desiredFirstRowCenterY - rowCenterFromGridOrigin

    const desiredGridX = -this.scrollWindow.windowSize.x * 0.5 + VIEWPORT_MARGIN_X + (COLUMNS * totalCellSize.x) * 0.5
    const transform = this.gridObject.getTransform()
    transform.setLocalPosition(new vec3(desiredGridX, desiredGridY, 0))
    transform.setLocalRotation(quat.quatIdentity())
    transform.setLocalScale(vec3.one())
  }

  private clearGridSlots(): void {
    if (!this.gridObject) {
      return
    }

    const children = this.gridObject.children
    for (let i = children.length - 1; i >= 0; i--) {
      children[i].destroy()
    }
  }

  private resolveHierarchy(): void {
    const content = this.findChildByName(this.sceneObject, "Content")
    const scrollObject = content ? this.findChildByName(content, "ScrollWindow") : null
    this.gridObject = scrollObject ? this.findChildByName(scrollObject, "GridLayout") : null
    this.gridLayout = this.gridObject ? (this.gridObject.getComponent(GridLayout.getTypeName()) as GridLayout) : null
    this.scrollWindow = scrollObject ? (scrollObject.getComponent(ScrollWindow.getTypeName()) as ScrollWindow) : null
  }

  private parseEntries(json: string): LiteButterflyEntry[] {
    try {
      const parsed = JSON.parse(json) as LiteButterflyEntry[]
      return Array.isArray(parsed) ? parsed : []
    } catch (_error) {
      return []
    }
  }

  private normalizeLayoutInputs(): void {
    if (this.cellWidth <= 0) {
      this.cellWidth = DEFAULT_CELL_WIDTH
    }
    if (this.cellHeight <= 0) {
      this.cellHeight = DEFAULT_CELL_HEIGHT
    }
    if (this.cellGap < 0) {
      this.cellGap = DEFAULT_CELL_GAP
    }
  }

  private findChildByName(root: SceneObject, name: string): SceneObject | null {
    if (root.name === name) {
      return root
    }

    const children = root.children
    for (let i = 0; i < children.length; i++) {
      const found = this.findChildByName(children[i], name)
      if (found) {
        return found
      }
    }
    return null
  }
}
