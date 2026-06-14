import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import { findAllComponentsInSelfOrChildren } from "SpectaclesInteractionKit.lspkg/Utils/SceneObjectUtils"
import { GridLayout, LayoutDirection } from "SpectaclesUIKit.lspkg/Scripts/Components/GridLayout/GridLayout"
import { IMAGE_MATERIAL_ASSET, StateName } from "SpectaclesUIKit.lspkg/Scripts/Components/Element"
import { ScrollWindow } from "SpectaclesUIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow"
import { RectangleButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/RectangleButton"
import { SupabaseDBManager } from "../../_Boon/SupabaseInfoStoring&Retrieving/Scripts/SupabaseDBManager"

// This script is the experimental dynamic collection/archive manager.
//
// Important safety notes for future AI/engineers:
// - This is separate from ButterflyCollectionLiteManager, which is the stable fallback.
// - Do not run this and ButterflyCollectionLiteManager at the same time; both populate the same GridLayout.
// - This manager intentionally reuses the existing Button objects under:
//   Collection > Content > ScrollWindow > GridLayout
// - It instantiates only the safe butterfly_low preview prefab when assigned.
// - It does NOT instantiate the old crashing collection slot prefab.
// - It injects lightweight child preview/Text objects into existing Button slots.
type DynamicTestEntry = {
  id: string
  name: string
  discovered: boolean
  isNew?: boolean
  // suggestion is used for the single "Find Next" recommendation/action card.
  // Multiple undiscovered test entries are collapsed into exactly one suggestion card.
  suggestion?: boolean
  wingTexture?: Texture | null
  wingOpacityMap?: Texture | null
}

// Runtime state for one animated label.
// The Text component does not need a separate script; this manager updates alpha + Y position each frame.
type HoverLabelState = {
  label: Text
  transform: Transform
  baseY: number
  hiddenY: number
  alpha: number
  idleAlpha: number
  hoverAlpha: number
  targetAlpha: number
}

// One card owns one label state and one preview animation state.
// This keeps the butterfly tied to the correct species instead of using any shared/global animation.
type CardInteractionState = {
  entry: DynamicTestEntry
  labelState: HoverLabelState | null
  badgeState: NewBadgeState | null
  previewAnimationPlayer: AnimationPlayer | null
  previewClipName: string | null
}

type PreviewInteractionLock = {
  preview: SceneObject
  untilTime: number
}

type NewBadgeState = {
  entryId: string
  badgeObject: SceneObject
  transform: Transform
  basePosition: vec3
  baseScale: vec3
  baseRotation: quat
  topLeftPivotOffset: vec3
  startTime: number
  active: boolean
}

const TAG = "ButterflyCollectionDynamicTestManager"
const GENERATED_PREFIX = "DynamicTestButterflySlot_"
const COLUMNS = 3
const CELL_WIDTH = 9.1
const CELL_HEIGHT = 8.8
const CELL_GAP = 0.55
const VIEWPORT_MARGIN_X = 1.2
const VIEWPORT_MARGIN_Y = 1.2
const NAME_TEXT_SIZE = 42
const FIND_NEXT_TEXT_SIZE = NAME_TEXT_SIZE
const PLACEHOLDER_TEXT_SIZE = 42
const BADGE_WIDTH = 2.25
const BADGE_HEIGHT = 2.25
const BADGE_Z = 0.34
const LABEL_HIDDEN_OFFSET = -0.34
const LABEL_FADE_SPEED = 7.5
const LABEL_TEXT_COLOR = new vec4(1, 1, 1, 0.94)
const PLACEHOLDER_IDLE_ALPHA = 0.45
const PLACEHOLDER_HOVER_ALPHA = 0.9
const BADGE_WIGGLE_SPEED = 3.6
const BADGE_WIGGLE_DEGREES = 3.5
const BADGE_PULSE_SPEED = 2.8
const BADGE_PULSE_AMOUNT = 0.035
const PREVIEW_OBJECT_NAME = "DynamicButterflyPreview"
const PREVIEW_POSITION = new vec3(0, 0.55, 0.5)
const PREVIEW_SCALE = new vec3(0.38, 0.38, 0.38)
// Apply a stable preview tilt so the butterfly reads better inside the card.
// If the orientation looks off, tweak these angles in small steps.
function deg(v: number) {
  return (v * Math.PI) / 180
}
const PREVIEW_ROTATION = quat.fromEulerAngles(deg(90), deg(0), deg(90))
const PREVIEW_RENDER_ORDER = 29
const SILHOUETTE_COLOR = new vec4(0.08, 0.08, 0.08, 1)
const HOVER_CLIP_NAMES = ["Armature_wingFlap", "Armature|wingFlap", "Armature|wingAction", "body|wingAction"]

// Test data deliberately includes two undiscovered species.
// createDisplayEntries() filters these down to one Find Next suggestion card.
const TEST_ENTRIES: DynamicTestEntry[] = [
  { id: "monarch", name: "Monarch", discovered: true, isNew: true },
  { id: "painted-lady", name: "Painted Lady", discovered: true },
  { id: "cloudless-sulphur", name: "Cloudless Sulphur", discovered: true },
  { id: "swallowtail", name: "Swallowtail", discovered: false },
  { id: "red-admiral", name: "Red Admiral", discovered: true, isNew: true },
  { id: "gray-hairstreak", name: "Gray Hairstreak", discovered: false },
]

@component
export class ButterflyCollectionDynamicTestManagerNew extends BaseScriptComponent {
  @input
  @hint("Leave false until you are ready to test. The stable lite manager should stay attached as fallback.")
  buildOnStart: boolean = false

  @input
  @allowUndefined
  @hint("Optional butterfly_low prefab used as the centered card preview.")
  butterflyPrefab!: ObjectPrefab

  @input
  @allowUndefined
  @hint("PNG/texture used for the per-card NEW badge. Assign this in the Inspector to swap badge art without code changes.")
  newBadgeTexture!: Texture

  @input
  @allowUndefined
  @hint("Optional scene object used only as a NEW badge placement template. Put it under a Button/card, move/rotate/scale it in the editor, then assign it here.")
  newBadgeTemplate!: SceneObject

  @input
  @allowUndefined
  @hint("Optional opacity/cutout texture for the gray suggestion butterfly. If empty, the prefab material's original opacityTex is reused.")
  suggestionOpacityTexture!: Texture

  @input
  @allowUndefined
  @hint("Optional nearby butterflies / recommended local species window opened by the Find Next card.")
  nearbyButterfliesWindow!: SceneObject

  @input
  @allowUndefined
  @hint("SupabaseDBManager component. When assigned, getMySightings() replaces the static TEST_ENTRIES.")
  supabaseDBManager!: SupabaseDBManager

  private gridObject: SceneObject | null = null
  private gridLayout: GridLayout | null = null
  private scrollWindow: ScrollWindow | null = null
  private hoverLabelStates: HoverLabelState[] = []
  private newBadgeStates: NewBadgeState[] = []
  private seenNewByEntryId: { [key: string]: boolean } = {}
  private previewInteractionLocks: PreviewInteractionLock[] = []

  onAwake(): void {
    // buildOnStart is the kill switch for this experimental manager.
    // If false, this script generates zero cards even if it is attached/enabled.
    this.createEvent("OnStartEvent").bind(() => {
      if (!this.buildOnStart) {
        this.warn("Dynamic test is attached but buildOnStart is false, so no slots were generated.")
        return
      }
      this.warn("Dynamic test manager is active. ButterflyCollectionLiteManager should be disabled while testing this manager.")

      // Wait one frame so scene/UI components can finish their own OnStart work first.
      // This also lets us clear any children created by another manager if somebody forgot to disable it.
      const buildEvent = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
      buildEvent.bind(() => {
        this.hideNewBadgeTemplate()
        this.buildTestCollection()
      })
      buildEvent.reset(0)
    })
    this.createEvent("UpdateEvent").bind(() => {
      this.updatePreviewInteractionLocks()
      this.updateHoverLabels()
      this.updateNewBadgeAnimations()
    })
  }

  public async buildTestCollection(): Promise<void> {
    // Resolve the existing hierarchy every build instead of caching blindly.
    // If a designer moves Collection children around, we warn and exit instead of crashing Lens.
    if (!this.resolveHierarchy()) {
      return
    }
    if (!this.gridObject || isNull(this.gridLayout)) {
      this.warn("GridLayout was not found. Attach this script to Collection, then use Collection > Content > ScrollWindow > GridLayout.")
      return
    }

    this.hoverLabelStates = []
    this.newBadgeStates = []
    this.previewInteractionLocks = []

    let displayEntries: DynamicTestEntry[]
    if (!isNull(this.supabaseDBManager)) {
      this.warn("Fetching sightings from Supabase...")
      const sightings = await this.supabaseDBManager.getMySightings()
      this.warn("Got " + sightings.length + " sightings.")
      displayEntries = this.createDisplayEntriesFromSightings(sightings)
    } else {
      displayEntries = this.createDisplayEntries()
    }

    // These logs are intentionally verbose while this manager is experimental.
    // They make it obvious when duplicate managers or old placeholder buttons are present.
    const beforeClearCount = this.getGridChildCount()
    this.warn("GridLayout child count before clearing: " + beforeClearCount)
    if (beforeClearCount > 0) {
      this.warn("Existing GridLayout children found. Another collection manager or placeholder slots may be active; dynamic test will clear them before generating.")
    }

    // Keep existing Button/RectangleButton slots and remove extras/old generated content.
    // This is the key difference from the lite fallback: the visual button style comes from the scene.
    const slotObjects = this.prepareButtonSlots(displayEntries.length)
    this.warn("GridLayout child count after clearing: " + this.getGridChildCount())
    if (slotObjects.length < displayEntries.length) {
      this.warn("Only found " + slotObjects.length + " existing Button slot objects. Dynamic test needs " + displayEntries.length + ". No fallback lite cards will be generated.")
      return
    }

    const rows = Math.max(1, Math.ceil(displayEntries.length / COLUMNS))
    this.gridLayout.columns = COLUMNS
    this.gridLayout.rows = rows
    this.gridLayout.cellSize = new vec2(CELL_WIDTH, CELL_HEIGHT)
    this.gridLayout.cellPadding = new vec4(CELL_GAP, CELL_GAP, CELL_GAP, CELL_GAP)
    this.gridLayout.layoutBy = LayoutDirection.Row

    // Configure exactly one slot per display entry.
    // displayEntries is discovered species + one suggestion card.
    let normalCardsGenerated = 0
    let suggestionCardsGenerated = 0
    for (let i = 0; i < displayEntries.length; i++) {
      const entry = displayEntries[i]
      this.configureButtonSlot(slotObjects[i], entry)
      if (entry.suggestion) {
        suggestionCardsGenerated++
      } else {
        normalCardsGenerated++
      }
    }
    this.warn("Normal cards generated: " + normalCardsGenerated)
    this.warn("Suggestion cards generated: " + suggestionCardsGenerated)

    if (!this.gridLayout.isInitialized) {
      this.gridLayout.initialize()
    }
    this.positionGrid(rows)
    this.gridLayout.layout()
    this.updateScrollWindow(rows)
    this.removeGeneratedScrollBar()
    this.warn("GridLayout child count after generating: " + this.getGridChildCount())
  }

  public clearTestCollection(): void {
    // Public helper for manual cleanup from Lens callbacks/debugging.
    // Leaves the original Button slots in place and removes only dynamic label/badge children.
    if (!this.resolveHierarchy() || !this.gridObject) {
      return
    }
    this.hoverLabelStates = []
    this.newBadgeStates = []
    this.previewInteractionLocks = []
    this.removeGeneratedScrollBar()
    this.clearDynamicSlotContent()
    this.warn("GridLayout child count after clearTestCollection: " + this.getGridChildCount())
  }

  private configureButtonSlot(slotObject: SceneObject, entry: DynamicTestEntry): void {
    // Rename the existing Button object so later rebuilds know this slot is owned by this manager.
    slotObject.name = GENERATED_PREFIX + entry.id
    slotObject.enabled = true
    slotObject.getTransform().setLocalPosition(vec3.zero())
    slotObject.getTransform().setLocalRotation(quat.quatIdentity())
    slotObject.getTransform().setLocalScale(vec3.one())

    const button = slotObject.getComponent(RectangleButton.getTypeName()) as RectangleButton
    if (isNull(button)) {
      this.warn(slotObject.name + " has no RectangleButton component; keeping object but only adding label children.")
    } else {
      // Reuse the real scene Button style, but enforce consistent physical size for the grid.
      button.enabled = true
      button.size = new vec3(CELL_WIDTH, CELL_HEIGHT, 3)
      // Make the button hitbox a little larger than the visual card so the butterfly preview
      // stays inside the card's hover target instead of creating a dead spot in the middle.
      button.colliderFitElement = false
      button.colliderSize = new vec3(CELL_WIDTH + 0.35, CELL_HEIGHT + 0.35, 4)
      button.colliderCenter = vec3.zero()
    }

    // Rebuild generated children idempotently. This prevents duplicate previews/labels/badges on reload or manual rebuild.
    this.clearSlotTextChildren(slotObject)
    const cardState: CardInteractionState = {
      entry: entry,
      labelState: null,
      badgeState: null,
      previewAnimationPlayer: null,
      previewClipName: null,
    }
    this.createButterflyPreview(slotObject, entry, cardState)
    const labelState = this.createLabel(slotObject, entry)
    if (labelState) {
      cardState.labelState = labelState
      this.hoverLabelStates.push(labelState)
      if (!isNull(button)) {
        this.bindButtonHover(button, cardState)
        this.bindButtonClick(button, cardState)
      }
    }

    if (this.shouldShowNewBadge(entry)) {
      const badgeState = this.createNewBadge(slotObject, entry)
      if (badgeState) {
        cardState.badgeState = badgeState
        this.newBadgeStates.push(badgeState)
      }
    }
  }

  private createButterflyPreview(slotObject: SceneObject, entry: DynamicTestEntry, cardState: CardInteractionState): void {
    // Center the butterfly_low preview in the card.
    // The preview remains visible even when the label is hidden.
    // Suggestion cards use the same prefab with cloned dark materials for a locked silhouette.
    if (isNull(this.butterflyPrefab)) {
      this.warn("butterflyPrefab is not assigned; card preview skipped for " + slotObject.name)
      return
    }

    const preview = this.butterflyPrefab.instantiate(slotObject)
    if (isNull(preview)) {
      this.warn("butterflyPrefab failed to instantiate for " + slotObject.name)
      return
    }

    preview.name = PREVIEW_OBJECT_NAME
    preview.layer = slotObject.layer
    preview.getTransform().setLocalPosition(PREVIEW_POSITION)
    preview.getTransform().setLocalRotation(PREVIEW_ROTATION)
    preview.getTransform().setLocalScale(PREVIEW_SCALE)
    this.applyPreviewRenderSettings(preview, !!entry.suggestion)
    if (!entry.suggestion) {
      this.applyWingTexturesToPreview(preview, entry)
    }
    this.lockPreviewInteraction(preview)
    this.previewInteractionLocks.push({ preview: preview, untilTime: getTime() + 1.0 })
    this.scheduleDelayedPreviewLock(preview)
    this.cachePreviewFlutterState(preview, cardState)
    this.resetPreviewFlutterAnimation(cardState)
  }

  private lockPreviewInteraction(preview: SceneObject): void {
    // Run all preview interaction shutdown in one place. The card owns hover/click;
    // the butterfly preview is visual-only inside the button.
    this.disablePreviewInteraction(preview)
    this.disablePreviewHoverScripts(preview)
  }

  private scheduleDelayedPreviewLock(preview: SceneObject): void {
    // Some prefab scripts create colliders/interactables during their own OnStart/OnAwake.
    // A next-frame cleanup catches those late-created hit targets so they cannot steal hover.
    const delayedLock = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    delayedLock.bind(() => {
      if (!isNull(preview)) {
        this.lockPreviewInteraction(preview)
      }
    })
    delayedLock.reset(0)
  }

  private updatePreviewInteractionLocks(): void {
    if (this.previewInteractionLocks.length === 0) {
      return
    }

    const now = getTime()
    for (let i = this.previewInteractionLocks.length - 1; i >= 0; i--) {
      const lock = this.previewInteractionLocks[i]
      if (isNull(lock.preview) || now > lock.untilTime) {
        this.previewInteractionLocks.splice(i, 1)
        continue
      }

      this.lockPreviewInteraction(lock.preview)
    }
  }

  private cachePreviewFlutterState(previewRoot: SceneObject, cardState: CardInteractionState): void {
    // Cache the butterfly's animation player per-card so hover can drive the correct preview only.
    const animationPlayer = this.findAnimationPlayer(previewRoot)
    cardState.previewAnimationPlayer = animationPlayer
    cardState.previewClipName = this.resolveFlutterClipName(animationPlayer)
    if (isNull(animationPlayer)) {
      this.warn("No AnimationPlayer found under butterfly preview for " + cardState.entry.name)
      return
    }
  }

  private disablePreviewInteraction(root: SceneObject): void {
    // The preview is visual-only. The parent button should own hover and click for the whole card.
    // Disable every collider/interactable in the prefab subtree so the card collider remains the only hit target.
    const colliders = findAllComponentsInSelfOrChildren(root, "ColliderComponent")
    for (let i = 0; i < colliders.length; i++) {
      colliders[i].enabled = false
    }

    const interactables = findAllComponentsInSelfOrChildren(root, Interactable.getTypeName())
    for (let i = 0; i < interactables.length; i++) {
      interactables[i].enabled = false
    }

    const buttons = findAllComponentsInSelfOrChildren(root, RectangleButton.getTypeName())
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].enabled = false
    }
  }

  private disablePreviewHoverScripts(root: SceneObject): void {
    // Some butterfly prefabs carry their own hover controller script.
    // That script is useful for standalone previews, but inside a collection card it can fight the card hover state.
    this.disableScriptsRecursively(root)
  }

  private disableScriptsRecursively(root: SceneObject): void {
    const scripts = root.getComponents("ScriptComponent")
    for (let i = 0; i < scripts.length; i++) {
      scripts[i].enabled = false
    }

    const children = root.children
    for (let i = 0; i < children.length; i++) {
      this.disableScriptsRecursively(children[i])
    }
  }

  private applyPreviewRenderSettings(root: SceneObject, silhouette: boolean): void {
    const mesh = root.getComponent("RenderMeshVisual") as RenderMeshVisual
    if (!isNull(mesh)) {
      mesh.renderOrder = PREVIEW_RENDER_ORDER
      if (silhouette && !isNull(mesh.mainMaterial)) {
        mesh.mainMaterial = this.createGraySilhouetteMaterial(mesh.mainMaterial)
      }
    }

    const children = root.children
    for (let i = 0; i < children.length; i++) {
      children[i].layer = root.layer
      this.applyPreviewRenderSettings(children[i], silhouette)
    }
  }

  private applyWingTexturesToPreview(root: SceneObject, entry: DynamicTestEntry): void {
    if (!entry.wingTexture && !entry.wingOpacityMap) return
    const wingObject = this.findChildByName(root, "wing")
    if (!wingObject) {
      this.warn("No child named 'wing' found under butterfly preview for " + entry.name)
      return
    }
    const mesh = wingObject.getComponent("RenderMeshVisual") as RenderMeshVisual
    if (isNull(mesh) || isNull(mesh.mainMaterial)) {
      this.warn("No RenderMeshVisual on 'wing' object for " + entry.name)
      return
    }
    const mat = mesh.mainMaterial.clone()
    const pass = mat.mainPass as any
    if (entry.wingTexture && pass.baseTex !== undefined) {
      pass.baseTex = entry.wingTexture
    }
    if (entry.wingOpacityMap && pass.opacityTex !== undefined) {
      pass.opacityTex = entry.wingOpacityMap
    }
    mesh.mainMaterial = mat
  }

  private createGraySilhouetteMaterial(sourceMaterial: Material): Material {
    // Suggestion/unknown butterflies should read as locked silhouettes, not recolored real butterflies.
    // Clone the prefab material so discovered cards keep their normal textures.
    //
    // Important Lens Studio note:
    // The wing material has ENABLE_BASE_TEX enabled. Setting baseTex to null makes Lens show a
    // broken/missing texture placeholder. To avoid that, the silhouette uses the opacity/cutout
    // texture in both opacityTex and baseTex, then tints it gray with baseColor.
    const silhouetteMaterial = sourceMaterial.clone()
    const pass = silhouetteMaterial.mainPass as any
    const sourcePass = sourceMaterial.mainPass as any
    const opacityTexture = isNull(this.suggestionOpacityTexture) ? sourcePass.opacityTex : this.suggestionOpacityTexture

    pass.baseColor = SILHOUETTE_COLOR
    if (pass.baseTex !== undefined && opacityTexture !== undefined) {
      pass.baseTex = opacityTexture
    }
    if (pass.opacityTex !== undefined && opacityTexture !== undefined) {
      pass.opacityTex = opacityTexture
    }
    if (sourcePass.opacityTexTransform !== undefined) {
      pass.opacityTexTransform = sourcePass.opacityTexTransform
    }

    return silhouetteMaterial
  }

  private findAnimationPlayer(root: SceneObject): AnimationPlayer | null {
    const animationPlayer = root.getComponent("AnimationPlayer") as AnimationPlayer
    if (!isNull(animationPlayer)) {
      return animationPlayer
    }

    const children = root.children
    for (let i = 0; i < children.length; i++) {
      const found = this.findAnimationPlayer(children[i])
      if (!isNull(found)) {
        return found
      }
    }

    return null
  }

  private resolveFlutterClipName(animationPlayer: AnimationPlayer | null): string | null {
    if (isNull(animationPlayer)) {
      return null
    }

    for (let i = 0; i < HOVER_CLIP_NAMES.length; i++) {
      const clip = animationPlayer.getClip(HOVER_CLIP_NAMES[i])
      if (!isNull(clip)) {
        return HOVER_CLIP_NAMES[i]
      }
    }

    return null
  }

  private playPreviewFlutterAnimation(cardState: CardInteractionState): void {
    const animationPlayer = cardState.previewAnimationPlayer
    const clipName = cardState.previewClipName
    if (isNull(animationPlayer) || clipName === null) {
      return
    }

    const clip = animationPlayer.getClip(clipName)
    if (!isNull(clip)) {
      clip.disabled = false
      clip.playbackSpeed = 1.0
    }

    animationPlayer.enabled = true
    animationPlayer.playClipAt(clipName, 0.0)
  }

  private resetPreviewFlutterAnimation(cardState: CardInteractionState): void {
    const animationPlayer = cardState.previewAnimationPlayer
    const clipName = cardState.previewClipName
    if (isNull(animationPlayer) || clipName === null) {
      return
    }

    const clip = animationPlayer.getClip(clipName)
    if (!isNull(clip)) {
      clip.disabled = false
      clip.playbackSpeed = 0.0
    }

    animationPlayer.enabled = true
    animationPlayer.playClipAt(clipName, 0.0)
  }

  private createLabel(slotObject: SceneObject, entry: DynamicTestEntry): HoverLabelState | null {
    // The name/action label is a child of the Button slot.
    // Species labels start invisible near the bottom; hover fades and slides them up.
    // The suggestion card says "Find Next" so it reads as an action, not a locked species.
    const labelObject = global.scene.createSceneObject("DynamicLabel")
    labelObject.layer = slotObject.layer
    labelObject.setParent(slotObject)
    const baseY = entry.discovered ? CELL_HEIGHT * -0.34 : 0
    const hiddenY = baseY + LABEL_HIDDEN_OFFSET
    const idleAlpha = entry.suggestion ? PLACEHOLDER_IDLE_ALPHA : 0
    const hoverAlpha = entry.suggestion ? PLACEHOLDER_HOVER_ALPHA : LABEL_TEXT_COLOR.w
    labelObject.getTransform().setLocalPosition(new vec3(0, hiddenY, 0.15))
    labelObject.getTransform().setLocalRotation(quat.quatIdentity())
    labelObject.getTransform().setLocalScale(vec3.one())

    const label = labelObject.createComponent("Component.Text") as Text
    if (isNull(label)) {
      this.warn("Text label could not be created for " + slotObject.name)
      return null
    }

    label.text = entry.suggestion ? "Find Next" : entry.name
    label.size = entry.suggestion ? FIND_NEXT_TEXT_SIZE : NAME_TEXT_SIZE
    label.sizeToFit = false
    label.horizontalAlignment = HorizontalAlignment.Center
    label.verticalAlignment = VerticalAlignment.Center
    label.textFill.color = new vec4(LABEL_TEXT_COLOR.x, LABEL_TEXT_COLOR.y, LABEL_TEXT_COLOR.z, idleAlpha)
    label.renderOrder = 30

    return {
      label: label,
      transform: labelObject.getTransform(),
      baseY: baseY,
      hiddenY: hiddenY,
      alpha: idleAlpha,
      idleAlpha: idleAlpha,
      hoverAlpha: hoverAlpha,
      targetAlpha: idleAlpha,
    }
  }

  private bindButtonHover(button: RectangleButton, cardState: CardInteractionState): void {
    // Use the button's own state machine instead of a separate hover collider.
    // That keeps the butterfly preview part of the card instead of creating a second hit target.
    button.onStateChanged.add((stateName: StateName) => {
      if (!cardState.labelState) {
        return
      }

      const isHovered = stateName === StateName.hovered || stateName === StateName.triggered || stateName === StateName.toggledHovered || stateName === StateName.toggledTriggered

      cardState.labelState.targetAlpha = isHovered ? cardState.labelState.hoverAlpha : cardState.labelState.idleAlpha
      if (isHovered) {
        this.playPreviewFlutterAnimation(cardState)
      } else {
        this.resetPreviewFlutterAnimation(cardState)
      }
    })
  }

  private bindButtonClick(button: RectangleButton, cardState: CardInteractionState): void {
    // TriggerUp is the normal "button click finished" event in Spectacles UIKit.
    // Suggestion is an action card, not a butterfly entry, so it opens the nearby/recommended window.
    // Normal discovered cards keep the per-species NEW badge behavior.
    button.onTriggerUp.add(() => {
      if (cardState.entry.suggestion) {
        this.openNearbyButterfliesWindow()
        return
      }

      this.markNewBadgeSeen(cardState)
    })
  }

  private openNearbyButterfliesWindow(): void {
    if (isNull(this.nearbyButterfliesWindow)) {
      this.warn("Find Next card clicked, but nearbyButterfliesWindow is not assigned.")
      return
    }

    this.nearbyButterfliesWindow.enabled = true
  }

  private updateHoverLabels(): void {
    // Per-frame label tween. This avoids adding a separate tween package or slot script.
    // Alpha approaches targetAlpha, while the local Y position follows the same normalized progress.
    if (this.hoverLabelStates.length === 0) {
      return
    }

    const t = Math.min(1, getDeltaTime() * LABEL_FADE_SPEED)
    for (let i = 0; i < this.hoverLabelStates.length; i++) {
      const state = this.hoverLabelStates[i]
      state.alpha = state.alpha + (state.targetAlpha - state.alpha) * t
      const normalizedAlpha = state.hoverAlpha <= 0 ? 0 : state.alpha / state.hoverAlpha
      const y = state.hiddenY + (state.baseY - state.hiddenY) * normalizedAlpha
      state.transform.setLocalPosition(new vec3(0, y, 0.15))
      state.label.textFill.color = new vec4(LABEL_TEXT_COLOR.x, LABEL_TEXT_COLOR.y, LABEL_TEXT_COLOR.z, state.alpha)
    }
  }

  private shouldShowNewBadge(entry: DynamicTestEntry): boolean {
    return !!entry.discovered && !!entry.isNew && this.seenNewByEntryId[entry.id] !== true
  }

  private createNewBadge(slotObject: SceneObject, entry: DynamicTestEntry): NewBadgeState | null {
    // Badge root owns animation and removal.
    // The visible badge is a flat PNG/texture assigned through the Inspector, so artists can swap it
    // without touching code and we avoid Lens Studio procedural mesh generation risk.
    // Keep all generated objects named with DynamicNewBadge* so rebuild cleanup removes them safely.
    if (isNull(this.newBadgeTexture)) {
      this.warn("newBadgeTexture is not assigned; NEW badge skipped for " + entry.name)
      return null
    }

    const badgeObject = global.scene.createSceneObject("DynamicNewBadge")
    badgeObject.layer = slotObject.layer
    badgeObject.setParent(slotObject)
    const badgeTransform = badgeObject.getTransform()
    const badgePlacement = this.applyNewBadgeTemplateTransform(badgeObject, badgeTransform)

    if (!this.createNewBadgeImageVisual(badgeObject, entry)) {
      badgeObject.destroy()
      return null
    }

    return {
      entryId: entry.id,
      badgeObject: badgeObject,
      transform: badgeTransform,
      basePosition: badgeTransform.getLocalPosition(),
      baseScale: badgePlacement.baseScale,
      baseRotation: badgePlacement.baseRotation,
      topLeftPivotOffset: new vec3(badgePlacement.baseScale.x * 0.5, badgePlacement.baseScale.y * -0.5, 0),
      startTime: getTime(),
      active: true,
    }
  }

  private createNewBadgeImageVisual(badgeObject: SceneObject, entry: DynamicTestEntry): boolean {
    // Use the assigned NEW tag PNG/texture.
    // Keep this as a single Component.Image only: no Unit Plane mesh and no fallback visual behind it.
    let badgeImage: any = null
    try {
      badgeImage = badgeObject.createComponent("Component.Image") as any
    } catch (_error) {
      this.warn("NEW badge Image component could not be created for " + entry.name)
      return false
    }

    if (isNull(badgeImage)) {
      this.warn("NEW badge Image component is null for " + entry.name)
      return false
    }

    if (badgeImage.mainMaterial === undefined || isNull(badgeImage.mainMaterial)) {
      badgeImage.mainMaterial = IMAGE_MATERIAL_ASSET.clone()
    } else {
      badgeImage.mainMaterial = badgeImage.mainMaterial.clone()
    }

    const pass =
      badgeImage.mainPass !== undefined && !isNull(badgeImage.mainPass)
        ? badgeImage.mainPass
        : badgeImage.mainMaterial !== undefined && !isNull(badgeImage.mainMaterial)
          ? badgeImage.mainMaterial.mainPass
          : null

    if (pass === null || isNull(pass)) {
      this.warn("NEW badge Image component has no usable material pass for " + entry.name)
      return false
    }

    pass.baseTex = this.newBadgeTexture
    pass.baseColor = new vec4(1, 1, 1, 1)
    pass.depthTest = false
    badgeImage.renderOrder = 33
    return true
  }

  private applyNewBadgeTemplateTransform(badgeObject: SceneObject, badgeTransform: Transform): { baseScale: vec3; baseRotation: quat } {
    // If a template object is assigned, it becomes the designer-authored placement guide.
    // Put the template as a child of any card/Button slot, adjust it in Scene Editor, then assign it.
    // The template stays hidden at runtime; generated per-card badges copy its local transform.
    if (!isNull(this.newBadgeTemplate)) {
      const templateTransform = this.newBadgeTemplate.getTransform()
      const templateScale = templateTransform.getLocalScale()
      const templateRotation = templateTransform.getLocalRotation()
      badgeTransform.setLocalPosition(templateTransform.getLocalPosition())
      badgeTransform.setLocalRotation(templateRotation)
      badgeTransform.setLocalScale(templateScale)

      // Lens Image/Screen Image objects are often moved in the editor through ScreenTransform,
      // not the regular Transform. If the template has one, copy it onto the generated badge too;
      // otherwise the normal Transform copy above would put the badge at the card center.
      this.copyTemplateScreenTransformIfPresent(badgeObject)
      return { baseScale: templateScale, baseRotation: templateRotation }
    }

    // Fallback placement when no template is assigned: overlap the card's top-right corner.
    const fallbackScale = new vec3(BADGE_WIDTH, BADGE_HEIGHT, 1)
    const fallbackRotation = quat.quatIdentity()
    badgeTransform.setLocalPosition(new vec3(CELL_WIDTH * 0.48, CELL_HEIGHT * 0.48, BADGE_Z))
    badgeTransform.setLocalRotation(fallbackRotation)
    badgeTransform.setLocalScale(fallbackScale)
    return { baseScale: fallbackScale, baseRotation: fallbackRotation }
  }

  private copyTemplateScreenTransformIfPresent(badgeObject: SceneObject): void {
    if (isNull(this.newBadgeTemplate)) {
      return
    }

    const templateScreenTransform = this.newBadgeTemplate.getComponent("ScreenTransform") as ScreenTransform
    if (isNull(templateScreenTransform)) {
      return
    }

    const badgeScreenTransform = badgeObject.createComponent("ScreenTransform") as ScreenTransform
    if (isNull(badgeScreenTransform)) {
      this.warn("NEW badge template has ScreenTransform, but generated badge could not create one.")
      return
    }

    badgeScreenTransform.anchors = templateScreenTransform.anchors
    badgeScreenTransform.offsets = templateScreenTransform.offsets
    badgeScreenTransform.position = templateScreenTransform.position
    this.copyTemplateScreenPivot(templateScreenTransform, badgeScreenTransform)
    badgeScreenTransform.enableDebugRendering = false
  }

  private copyTemplateScreenPivot(templateScreenTransform: ScreenTransform, badgeScreenTransform: ScreenTransform): void {
    // Different Lens Studio versions expose Image/ScreenTransform pivot presets with slightly different
    // generated typings. Use guarded dynamic access so the script still imports when a property is absent.
    const templateScreen = templateScreenTransform as any
    const badgeScreen = badgeScreenTransform as any

    if (templateScreen.pivot !== undefined) {
      badgeScreen.pivot = templateScreen.pivot
    }
    if (templateScreen.pivotPreset !== undefined) {
      badgeScreen.pivotPreset = templateScreen.pivotPreset
    }
  }

  private hideNewBadgeTemplate(): void {
    // The template is only an editor placement/size reference.
    // Disable it so users do not see an extra static badge in addition to generated per-card badges.
    if (!isNull(this.newBadgeTemplate)) {
      this.newBadgeTemplate.enabled = false
    }
  }

  private updateNewBadgeAnimations(): void {
    if (this.newBadgeStates.length === 0) {
      return
    }

    const now = getTime()
    for (let i = this.newBadgeStates.length - 1; i >= 0; i--) {
      const badgeState = this.newBadgeStates[i]
      if (!badgeState.active || isNull(badgeState.badgeObject)) {
        this.newBadgeStates.splice(i, 1)
        continue
      }

      const wiggleDegrees = Math.sin((now - badgeState.startTime) * BADGE_WIGGLE_SPEED) * BADGE_WIGGLE_DEGREES
      const pulse = 1 + Math.sin((now - badgeState.startTime) * BADGE_PULSE_SPEED) * BADGE_PULSE_AMOUNT
      const wiggleRotation = quat.fromEulerAngles(0, 0, deg(wiggleDegrees))
      const animatedRotation = badgeState.baseRotation.multiply(wiggleRotation)
      const animatedScale = new vec3(badgeState.baseScale.x * pulse, badgeState.baseScale.y * pulse, badgeState.baseScale.z)

      // Keep the PNG's top-left corner visually pinned while the badge wiggles.
      // The visual's origin is still its center, so we offset the center by the difference between
      // the unanimated center-to-pivot vector and the rotated/scaled center-to-pivot vector.
      const baseOffset = badgeState.baseRotation.multiplyVec3(badgeState.topLeftPivotOffset)
      const animatedOffset = animatedRotation.multiplyVec3(new vec3(badgeState.topLeftPivotOffset.x * pulse, badgeState.topLeftPivotOffset.y * pulse, 0))
      const positionDelta = animatedOffset.sub(baseOffset)
      badgeState.transform.setLocalPosition(badgeState.basePosition.add(positionDelta))
      badgeState.transform.setLocalRotation(animatedRotation)
      badgeState.transform.setLocalScale(animatedScale)
    }
  }

  private markNewBadgeSeen(cardState: CardInteractionState): void {
    const entry = cardState.entry
    if (!entry.discovered || !entry.isNew || this.seenNewByEntryId[entry.id] === true) {
      return
    }

    this.seenNewByEntryId[entry.id] = true
    const badgeState = cardState.badgeState
    if (badgeState && badgeState.active) {
      badgeState.active = false
      if (!isNull(badgeState.badgeObject)) {
        badgeState.badgeObject.destroy()
      }
    }
    cardState.badgeState = null
  }

  private positionGrid(rows: number): void {
    // GridLayout centers its cells around its own origin.
    // Move the GridLayout object so the first row appears near the top-left of ScrollWindow.
    if (!this.gridObject || isNull(this.gridLayout) || isNull(this.scrollWindow)) {
      return
    }

    const totalCellSize = this.gridLayout.totalCellSize
    const rowCenterFromGridOrigin = rows > 1 ? (rows - 1) * totalCellSize.y * 0.5 : 0
    const desiredFirstRowCenterY = this.scrollWindow.windowSize.y * 0.5 - VIEWPORT_MARGIN_Y - CELL_HEIGHT * 0.5
    const desiredGridY = desiredFirstRowCenterY - rowCenterFromGridOrigin
    const desiredGridX = -this.scrollWindow.windowSize.x * 0.5 + VIEWPORT_MARGIN_X + COLUMNS * totalCellSize.x * 0.5

    const transform = this.gridObject.getTransform()
    transform.setLocalPosition(new vec3(desiredGridX, desiredGridY, 0))
    transform.setLocalRotation(quat.quatIdentity())
    transform.setLocalScale(vec3.one())
  }

  private updateScrollWindow(rows: number): void {
    // Keep ScrollWindow vertical-only and make its content dimensions match generated rows.
    if (isNull(this.scrollWindow) || isNull(this.gridLayout)) {
      return
    }

    const totalCellSize = this.gridLayout.totalCellSize
    const width = Math.max(this.scrollWindow.windowSize.x, COLUMNS * totalCellSize.x)
    const height = Math.max(this.scrollWindow.windowSize.y, rows * totalCellSize.y)
    this.scrollWindow.horizontal = false
    this.scrollWindow.vertical = height > this.scrollWindow.windowSize.y
    this.scrollWindow.scrollSnapping = false
    this.scrollWindow.scrollDimensions = new vec2(width, height)
    this.scrollWindow.scrollPosition = vec2.zero()
  }

  private prepareButtonSlots(requiredCount: number): SceneObject[] {
    // Reuse existing Button objects as templates/slots.
    // We keep only as many Button slots as needed, in existing GridLayout order.
    // Any extra children are removed so old placeholders or previous dynamic slots do not remain visible.
    if (!this.gridObject) {
      return []
    }

    const usableSlots: SceneObject[] = []
    const children = this.gridObject.children
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      const isButtonSlot = child.name === "Button" || child.name.indexOf(GENERATED_PREFIX) === 0
      if (isButtonSlot && usableSlots.length < requiredCount && !isNull(child.getComponent(RectangleButton.getTypeName()))) {
        usableSlots.push(child)
      }
    }
    for (let i = children.length - 1; i >= 0; i--) {
      if (usableSlots.indexOf(children[i]) < 0) {
        children[i].destroy()
      }
    }
    for (let i = 0; i < usableSlots.length; i++) {
      this.clearSlotTextChildren(usableSlots[i])
    }
    return usableSlots
  }

  private createDisplayEntries(): DynamicTestEntry[] {
    // Rule: display all discovered species, then append exactly one Find Next suggestion card.
    // Do not create one suggestion card per undiscovered species.
    const entries: DynamicTestEntry[] = []
    for (let i = 0; i < TEST_ENTRIES.length; i++) {
      if (TEST_ENTRIES[i].discovered) {
        entries.push(TEST_ENTRIES[i])
      }
    }
    entries.push({ id: "find-next", name: "Find Next", discovered: false, suggestion: true })
    return entries
  }

  private createDisplayEntriesFromSightings(sightings: any[]): DynamicTestEntry[] {
    const entries: DynamicTestEntry[] = []
    for (let i = 0; i < sightings.length; i++) {
      const r = sightings[i]
      const commonNames = r.species_common_names as string[] | null
      const name = commonNames && commonNames.length > 0 ? commonNames[0] : ((r.species_scientific_name as string | null) ?? "Unknown")
      entries.push({
        id: r.id as string,
        name: name,
        discovered: true,
        isNew: r.is_new as boolean,
        wingTexture: r.wing_texture as Texture | null,
        wingOpacityMap: r.wing_opacity_map as Texture | null,
      })
    }
    entries.push({ id: "find-next", name: "Find Next", discovered: false, suggestion: true })
    return entries
  }

  private clearDynamicSlotContent(): void {
    // Reset generated slots back to plain Button names and remove dynamic text children.
    // This is useful if switching back to the stable lite manager.
    if (!this.gridObject) {
      return
    }

    const children = this.gridObject.children
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i]
      if (child.name.indexOf(GENERATED_PREFIX) === 0) {
        this.clearSlotTextChildren(child)
        child.name = "Button"
      }
    }
  }

  private removeGeneratedScrollBar(): void {
    // Cleanup for the temporary generated scrollbar experiment.
    // Safe to keep while old scene objects may still exist from prior test builds.
    if (isNull(this.scrollWindow)) {
      return
    }

    const oldScrollBar = this.findChildByName(this.scrollWindow.sceneObject, "DynamicArchiveScrollBar")
    if (oldScrollBar && !isNull(oldScrollBar)) {
      oldScrollBar.destroy()
    }
  }

  private clearSlotTextChildren(slotObject: SceneObject): void {
    // Only remove children this dynamic manager created.
    // Do not destroy built-in Button visuals/components.
    const children = slotObject.children
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i]
      if (child.name === "DynamicLabel" || child.name === "DynamicNewBadge" || child.name === PREVIEW_OBJECT_NAME) {
        child.destroy()
      }
    }
  }

  private getGridChildCount(): number {
    return this.gridObject ? this.gridObject.children.length : 0
  }

  private resolveHierarchy(): boolean {
    // This script should be attached to Collection.
    // It expects the existing hierarchy: Collection > Content > ScrollWindow > GridLayout.
    const content = this.findChildByName(this.sceneObject, "Content")
    if (!content) {
      this.warn("Content was not found under " + this.sceneObject.name)
      return false
    }

    const scrollObject = this.findChildByName(content, "ScrollWindow")
    if (!scrollObject) {
      this.warn("ScrollWindow was not found under Content.")
      return false
    }

    this.gridObject = this.findChildByName(scrollObject, "GridLayout")
    if (!this.gridObject) {
      this.warn("GridLayout was not found under ScrollWindow.")
      return false
    }

    this.gridLayout = this.gridObject.getComponent(GridLayout.getTypeName()) as GridLayout
    if (isNull(this.gridLayout)) {
      this.warn("GridLayout component is missing from the GridLayout object.")
      return false
    }

    this.scrollWindow = scrollObject.getComponent(ScrollWindow.getTypeName()) as ScrollWindow
    if (isNull(this.scrollWindow)) {
      this.warn("ScrollWindow component is missing from the ScrollWindow object.")
      return false
    }

    return true
  }

  private findChildByName(root: SceneObject, name: string): SceneObject | null {
    // Small recursive helper kept local to avoid bringing in extra utilities.
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

  private warn(message: string): void {
    // Lens Studio supports print(). Prefix messages so logs are easy to filter.
    print(TAG + ": " + message)
  }
}
