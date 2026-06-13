import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractorEvent} from "SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent"
import {TargetingMode} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"

export type ButterflyCollectionEntry = {
  id: string
  commonName: string
  scientificName?: string
  summary?: string
  wingspan?: string
  firstSeen?: string
  timesSeen?: string
  hostPlant?: string
  status?: string
  activeMonths?: string[]
  startMonth?: string
  endMonth?: string
  discovered: boolean
  isNew?: boolean
}

const SLOT_SIZE = new vec2(6, 6)
const CARD_COLOR = new vec4(0.08, 0.1, 0.12, 0.86)
const BORDER_COLOR = new vec4(1, 1, 1, 0.18)
const HOVER_BORDER_COLOR = new vec4(0.55, 0.86, 1, 0.72)
const TEXT_COLOR = new vec4(1, 1, 1, 0.92)
const MUTED_TEXT_COLOR = new vec4(1, 1, 1, 0.54)
const BADGE_COLOR = new vec4(1, 0.34, 0.18, 0.96)
const MODEL_POSITION = new vec3(0, 0.72, 0.2)
const MODEL_SCALE = new vec3(0.72, 0.72, 0.72)
const MODEL_ROTATION = quat.angleAxis(24, vec3.up())
const HOVER_CLIP_NAMES = ["Armature_wingFlap", "Armature|wingFlap", "Armature|wingAction", "body|wingAction"]

@component
export class ButterflyCollectionSlot extends BaseScriptComponent {
  private background: RoundedRectangle | null = null
  private labelText: Text | null = null
  private placeholderText: Text | null = null
  private badgeObject: SceneObject | null = null
  private interactable: Interactable | null = null
  private collider: ColliderComponent | null = null
  private modelRoot: SceneObject | null = null
  private animationPlayer: AnimationPlayer | null = null
  private activeClipName: string | null = null
  private entry: ButterflyCollectionEntry | null = null
  private onSelected: ((entry: ButterflyCollectionEntry) => void) | null = null
  private initialized: boolean = false

  public onAwake(): void {
    this.initializeSlot()
  }

  private initializeSlot(): void {
    if (this.initialized) {
      return
    }
    this.ensureBaseVisuals()
    this.ensureInteraction()
    this.initialized = true
  }

  public configure(
    entry: ButterflyCollectionEntry,
    butterflyPrefab: ObjectPrefab | null,
    onSelected: (entry: ButterflyCollectionEntry) => void
  ): void {
    this.initializeSlot()
    this.entry = entry
    this.onSelected = onSelected
    this.sceneObject.name = "GeneratedButterflySlot_" + entry.id
    this.clearModel()

    if (this.labelText) {
      this.labelText.text = entry.discovered ? entry.commonName : "Undiscovered"
      this.labelText.textFill.color = entry.discovered ? TEXT_COLOR : MUTED_TEXT_COLOR
    }

    if (this.placeholderText) {
      this.placeholderText.enabled = !entry.discovered
      this.placeholderText.text = "?"
    }

    if (this.badgeObject) {
      this.badgeObject.enabled = !!entry.isNew && entry.discovered
    }

    if (entry.discovered && !isNull(butterflyPrefab)) {
      this.modelRoot = butterflyPrefab.instantiate(this.sceneObject)
      this.modelRoot.name = "SlotButterfly_" + entry.id
      this.modelRoot.layer = this.sceneObject.layer
      this.modelRoot.getTransform().setLocalPosition(MODEL_POSITION)
      this.modelRoot.getTransform().setLocalScale(MODEL_SCALE)
      this.modelRoot.getTransform().setLocalRotation(MODEL_ROTATION)
      this.animationPlayer = this.findAnimationPlayer(this.modelRoot)
      this.resetAnimation()
    }
  }

  private ensureBaseVisuals(): void {
    if (!this.background) {
      this.background =
        (this.sceneObject.getComponent(RoundedRectangle.getTypeName()) as RoundedRectangle) ||
        (this.sceneObject.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle)
      this.background.initialize()
      this.background.size = SLOT_SIZE
      this.background.cornerRadius = 0.38
      this.background.border = true
      this.background.borderSize = 0.05
      this.background.backgroundColor = CARD_COLOR
      this.background.borderColor = BORDER_COLOR
      this.background.renderOrder = 20
      this.background.renderMeshVisual.mainPass.depthTest = false
    }

    if (!this.labelText) {
      const labelObject = global.scene.createSceneObject("SlotLabel")
      labelObject.layer = this.sceneObject.layer
      labelObject.setParent(this.sceneObject)
      labelObject.getTransform().setLocalPosition(new vec3(0, -2.08, 0.16))
      this.labelText = labelObject.createComponent("Component.Text") as Text
      this.labelText.sizeToFit = false
      this.labelText.size = 15
      this.labelText.horizontalAlignment = HorizontalAlignment.Center
      this.labelText.verticalAlignment = VerticalAlignment.Center
      this.labelText.textFill.color = TEXT_COLOR
      this.labelText.renderOrder = 24
    }

    if (!this.placeholderText) {
      const placeholderObject = global.scene.createSceneObject("SlotPlaceholder")
      placeholderObject.layer = this.sceneObject.layer
      placeholderObject.setParent(this.sceneObject)
      placeholderObject.getTransform().setLocalPosition(new vec3(0, 0.55, 0.16))
      this.placeholderText = placeholderObject.createComponent("Component.Text") as Text
      this.placeholderText.sizeToFit = false
      this.placeholderText.size = 48
      this.placeholderText.horizontalAlignment = HorizontalAlignment.Center
      this.placeholderText.verticalAlignment = VerticalAlignment.Center
      this.placeholderText.textFill.color = MUTED_TEXT_COLOR
      this.placeholderText.renderOrder = 23
    }

    if (!this.badgeObject) {
      this.badgeObject = global.scene.createSceneObject("NewBadge")
      this.badgeObject.layer = this.sceneObject.layer
      this.badgeObject.setParent(this.sceneObject)
      this.badgeObject.getTransform().setLocalPosition(new vec3(1.72, 1.88, 0.18))
      const badge = this.badgeObject.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
      badge.initialize()
      badge.size = new vec2(1.45, 0.58)
      badge.cornerRadius = 0.2
      badge.backgroundColor = BADGE_COLOR
      badge.border = false
      badge.renderOrder = 25
      badge.renderMeshVisual.mainPass.depthTest = false

      const badgeTextObject = global.scene.createSceneObject("NewBadgeText")
      badgeTextObject.layer = this.sceneObject.layer
      badgeTextObject.setParent(this.badgeObject)
      badgeTextObject.getTransform().setLocalPosition(new vec3(0, 0, 0.04))
      const badgeText = badgeTextObject.createComponent("Component.Text") as Text
      badgeText.sizeToFit = false
      badgeText.size = 10
      badgeText.text = "NEW"
      badgeText.horizontalAlignment = HorizontalAlignment.Center
      badgeText.verticalAlignment = VerticalAlignment.Center
      badgeText.textFill.color = new vec4(1, 1, 1, 1)
      badgeText.renderOrder = 26
      this.badgeObject.enabled = false
    }
  }

  private ensureInteraction(): void {
    this.collider =
      (this.sceneObject.getComponent("ColliderComponent") as ColliderComponent) ||
      (this.sceneObject.createComponent("ColliderComponent") as ColliderComponent)
    this.collider.fitVisual = false
    const shape = Shape.createBoxShape()
    shape.size = new vec3(SLOT_SIZE.x, SLOT_SIZE.y, 2)
    this.collider.shape = shape
    this.collider.enabled = true

    this.interactable =
      (this.sceneObject.getComponent(Interactable.getTypeName()) as Interactable) ||
      (this.sceneObject.createComponent(Interactable.getTypeName()) as Interactable)
    this.interactable.targetingMode = TargetingMode.All
    this.interactable.enabled = true
    this.interactable.onHoverEnter.add(this.onHoverEnter)
    this.interactable.onHoverExit.add(this.onHoverExit)
    this.interactable.onTriggerEnd.add(this.onTriggerEnd)
  }

  private onHoverEnter = (_eventData: InteractorEvent): void => {
    if (this.background) {
      this.background.borderColor = HOVER_BORDER_COLOR
    }
    if (this.entry?.discovered) {
      this.playAnimation()
    }
  }

  private onHoverExit = (_eventData: InteractorEvent): void => {
    if (this.background) {
      this.background.borderColor = BORDER_COLOR
    }
    this.resetAnimation()
  }

  private onTriggerEnd = (_eventData: InteractorEvent): void => {
    if (!this.entry || !this.onSelected) {
      return
    }
    if (this.entry.discovered) {
      this.playAnimation()
    }
    this.onSelected(this.entry)
  }

  private playAnimation(): void {
    if (isNull(this.animationPlayer)) {
      return
    }
    const clipName = this.activeClipName || this.resolveClipName()
    if (clipName === null) {
      return
    }
    this.activeClipName = clipName
    const clip = this.animationPlayer.getClip(clipName)
    if (!isNull(clip)) {
      clip.disabled = false
      clip.playbackSpeed = 0.65
    }
    this.animationPlayer.enabled = true
    this.animationPlayer.playClipAt(clipName, 0)
  }

  private resetAnimation(): void {
    if (isNull(this.animationPlayer)) {
      return
    }
    const clipName = this.activeClipName || this.resolveClipName()
    if (clipName === null) {
      return
    }
    this.activeClipName = clipName
    const clip = this.animationPlayer.getClip(clipName)
    if (!isNull(clip)) {
      clip.disabled = false
      clip.playbackSpeed = 0
    }
    this.animationPlayer.enabled = true
    this.animationPlayer.playClipAt(clipName, 0)
  }

  private resolveClipName(): string | null {
    if (isNull(this.animationPlayer)) {
      return null
    }
    for (let i = 0; i < HOVER_CLIP_NAMES.length; i++) {
      if (!isNull(this.animationPlayer.getClip(HOVER_CLIP_NAMES[i]))) {
        return HOVER_CLIP_NAMES[i]
      }
    }
    return null
  }

  private clearModel(): void {
    if (!isNull(this.modelRoot) && this.modelRoot) {
      this.modelRoot.destroy()
    }
    this.modelRoot = null
    this.animationPlayer = null
    this.activeClipName = null
  }

  private findAnimationPlayer(root: SceneObject): AnimationPlayer | null {
    const player = root.getComponent("AnimationPlayer") as AnimationPlayer
    if (!isNull(player)) {
      return player
    }
    const children = root.children
    for (let i = 0; i < children.length; i++) {
      const playerInChild = this.findAnimationPlayer(children[i])
      if (!isNull(playerInChild)) {
        return playerInChild
      }
    }
    return null
  }
}
