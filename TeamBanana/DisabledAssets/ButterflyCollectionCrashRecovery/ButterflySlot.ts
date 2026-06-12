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

const HOVER_CLIP_NAMES = ["Armature|ArmatureAction", "Armature|wingAction", "body|wingAction"]
const SLOT_SIZE = new vec2(8.1, 8.9)
const CARD_COLOR = new vec4(0.1, 0.11, 0.14, 0.9)
const CARD_BORDER_COLOR = new vec4(1, 1, 1, 0.14)
const CARD_HOVER_BORDER_COLOR = new vec4(0.53, 0.86, 1, 0.6)
const TITLE_COLOR = new vec4(1, 1, 1, 0.92)
const TITLE_MUTED_COLOR = new vec4(1, 1, 1, 0.5)
const PLACEHOLDER_COLOR = new vec4(1, 1, 1, 0.54)
const BADGE_COLOR = new vec4(1, 0.34, 0.18, 0.96)
const BADGE_TEXT_COLOR = new vec4(1, 1, 1, 1)
const MODEL_POSITION = new vec3(0, 0.95, 0.16)
const MODEL_SCALE = new vec3(1.12, 1.12, 1.12)
const MODEL_BASE_ROTATION = quat.angleAxis(24, vec3.up())
const HOVER_COLLIDER_SIZE = new vec3(7.7, 8.5, 2.2)

@component
export class ButterflySlot extends BaseScriptComponent {
  private background: RoundedRectangle | null = null
  private badgeBackground: RoundedRectangle | null = null
  private labelText: Text | null = null
  private badgeText: Text | null = null
  private placeholderText: Text | null = null
  private interactable: Interactable | null = null
  private collider: ColliderComponent | null = null
  private colliderShape: BoxShape | null = null
  private modelRoot: SceneObject | null = null
  private animationPlayer: AnimationPlayer | null = null
  private activeClipName: string | null = null
  private entry: ButterflyCollectionEntry | null = null
  private onSelected: ((entry: ButterflyCollectionEntry) => void) | null = null

  onAwake() {
    this.ensureBackground()
    this.ensureTexts()
    this.ensureInteraction()
  }

  public configure(
    entry: ButterflyCollectionEntry,
    butterflyPrefab: ObjectPrefab,
    onSelected: (entry: ButterflyCollectionEntry) => void
  ): void {
    this.entry = entry
    this.onSelected = onSelected

    this.sceneObject.name = `ButterflySlot_${entry.id}`
    this.sceneObject.getTransform().setLocalScale(vec3.one())

    this.updateVisualState()
    this.clearModel()

    if (entry.discovered) {
      const instance = butterflyPrefab.instantiate(this.sceneObject)
      instance.name = `ButterflyModel_${entry.id}`
      instance.layer = this.sceneObject.layer
      instance.getTransform().setLocalPosition(MODEL_POSITION)
      instance.getTransform().setLocalScale(MODEL_SCALE)
      instance.getTransform().setLocalRotation(MODEL_BASE_ROTATION)
      this.modelRoot = instance
      this.animationPlayer = this.findAnimationPlayer(instance)
      this.resetAnimationPose()
      if (this.placeholderText) {
        this.placeholderText.enabled = false
      }
    } else {
      this.animationPlayer = null
      if (this.placeholderText) {
        this.placeholderText.enabled = true
        this.placeholderText.text = "?"
      }
    }
  }

  private ensureBackground(): void {
    if (this.background) {
      return
    }

    this.background =
      (this.sceneObject.getComponent(RoundedRectangle.getTypeName()) as RoundedRectangle) ||
      (this.sceneObject.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle)
    this.background.initialize()
    this.background.size = SLOT_SIZE
    this.background.cornerRadius = 0.72
    this.background.border = true
    this.background.borderSize = 0.06
    this.background.backgroundColor = CARD_COLOR
    this.background.borderColor = CARD_BORDER_COLOR
    this.background.renderOrder = 20
    this.background.renderMeshVisual.mainPass.depthTest = false
  }

  private ensureTexts(): void {
    if (!this.labelText) {
      const textObject = global.scene.createSceneObject("SlotLabel")
      textObject.layer = this.sceneObject.layer
      textObject.setParent(this.sceneObject)
      textObject.getTransform().setLocalPosition(new vec3(0, -2.92, 0.12))
      this.labelText = textObject.createComponent("Component.Text") as Text
      this.labelText.sizeToFit = false
      this.labelText.size = 18
      this.labelText.text = ""
      this.labelText.horizontalAlignment = HorizontalAlignment.Center
      this.labelText.verticalAlignment = VerticalAlignment.Center
      this.labelText.textFill.color = TITLE_COLOR
      this.labelText.renderOrder = 25
    }

    if (!this.placeholderText) {
      const placeholderObject = global.scene.createSceneObject("SlotPlaceholder")
      placeholderObject.layer = this.sceneObject.layer
      placeholderObject.setParent(this.sceneObject)
      placeholderObject.getTransform().setLocalPosition(new vec3(0, 0.9, 0.14))
      this.placeholderText = placeholderObject.createComponent("Component.Text") as Text
      this.placeholderText.sizeToFit = false
      this.placeholderText.size = 56
      this.placeholderText.text = "?"
      this.placeholderText.horizontalAlignment = HorizontalAlignment.Center
      this.placeholderText.verticalAlignment = VerticalAlignment.Center
      this.placeholderText.textFill.color = PLACEHOLDER_COLOR
      this.placeholderText.renderOrder = 24
      this.placeholderText.enabled = false
    }

    if (!this.badgeBackground) {
      const badgeObject = global.scene.createSceneObject("SlotBadge")
      badgeObject.layer = this.sceneObject.layer
      badgeObject.setParent(this.sceneObject)
      badgeObject.getTransform().setLocalPosition(new vec3(2.35, 2.92, 0.14))
      this.badgeBackground = badgeObject.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
      this.badgeBackground.initialize()
      this.badgeBackground.size = new vec2(2.3, 0.92)
      this.badgeBackground.cornerRadius = 0.34
      this.badgeBackground.border = false
      this.badgeBackground.backgroundColor = BADGE_COLOR
      this.badgeBackground.renderOrder = 26
      this.badgeBackground.renderMeshVisual.mainPass.depthTest = false

      const badgeTextObject = global.scene.createSceneObject("SlotBadgeText")
      badgeTextObject.layer = this.sceneObject.layer
      badgeTextObject.setParent(badgeObject)
      badgeTextObject.getTransform().setLocalPosition(new vec3(0, 0, 0.05))
      this.badgeText = badgeTextObject.createComponent("Component.Text") as Text
      this.badgeText.sizeToFit = false
      this.badgeText.size = 13
      this.badgeText.text = "NEW"
      this.badgeText.horizontalAlignment = HorizontalAlignment.Center
      this.badgeText.verticalAlignment = VerticalAlignment.Center
      this.badgeText.textFill.color = BADGE_TEXT_COLOR
      this.badgeText.renderOrder = 27
    }
  }

  private ensureInteraction(): void {
    this.collider =
      (this.sceneObject.getComponent("ColliderComponent") as ColliderComponent) ||
      (this.sceneObject.createComponent("ColliderComponent") as ColliderComponent)
    this.collider.fitVisual = false
    this.colliderShape = Shape.createBoxShape()
    this.colliderShape.size = HOVER_COLLIDER_SIZE
    this.collider.shape = this.colliderShape
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

  private updateVisualState(): void {
    if (!this.entry || !this.background || !this.labelText || !this.badgeBackground || !this.badgeText) {
      return
    }

    this.labelText.text = this.entry.discovered ? this.entry.commonName : "Undiscovered"
    this.labelText.textFill.color = this.entry.discovered ? TITLE_COLOR : TITLE_MUTED_COLOR
    this.badgeBackground.enabled = !!this.entry.isNew && this.entry.discovered
    this.badgeText.enabled = !!this.entry.isNew && this.entry.discovered
  }

  private clearModel(): void {
    if (!isNull(this.modelRoot) && this.modelRoot) {
      this.modelRoot.destroy()
    }
    this.modelRoot = null
    this.animationPlayer = null
    this.activeClipName = null
  }

  private onHoverEnter = (_eventData: InteractorEvent) => {
    if (this.background) {
      this.background.borderColor = CARD_HOVER_BORDER_COLOR
    }
    this.playHoverAnimation()
  }

  private onHoverExit = (_eventData: InteractorEvent) => {
    if (this.background) {
      this.background.borderColor = CARD_BORDER_COLOR
    }
    this.resetAnimationPose()
  }

  private onTriggerEnd = (_eventData: InteractorEvent) => {
    if (!this.entry || !this.onSelected) {
      return
    }
    this.playHoverAnimation()
    this.onSelected(this.entry)
  }

  private playHoverAnimation(): void {
    if (isNull(this.animationPlayer)) {
      return
    }

    const clipName = this.resolveHoverClipName()
    if (clipName === null) {
      return
    }

    this.activeClipName = clipName
    this.animationPlayer.enabled = true
    const clip = this.animationPlayer.getClip(clipName)
    if (!isNull(clip)) {
      clip.disabled = false
      clip.playbackSpeed = 0.55
    }
    this.animationPlayer.playClipAt(clipName, 0.0)
  }

  private resetAnimationPose(): void {
    if (isNull(this.animationPlayer)) {
      return
    }

    const clipName = this.resolveHoverClipName()
    if (clipName === null) {
      return
    }

    this.activeClipName = clipName
    const clip = this.animationPlayer.getClip(clipName)
    if (!isNull(clip)) {
      clip.disabled = false
      clip.playbackSpeed = 0.0
    }
    this.animationPlayer.enabled = true
    this.animationPlayer.playClipAt(clipName, 0.0)
  }

  private resolveHoverClipName(): string | null {
    if (this.activeClipName) {
      return this.activeClipName
    }

    if (isNull(this.animationPlayer)) {
      return null
    }

    for (let i = 0; i < HOVER_CLIP_NAMES.length; i++) {
      const clip = this.animationPlayer.getClip(HOVER_CLIP_NAMES[i])
      if (!isNull(clip)) {
        return HOVER_CLIP_NAMES[i]
      }
    }

    return null
  }

  private findAnimationPlayer(root: SceneObject): AnimationPlayer | null {
    const player = root.getComponent("AnimationPlayer") as AnimationPlayer
    if (!isNull(player)) {
      return player
    }

    const children = root.children
    for (let i = 0; i < children.length; i++) {
      const childPlayer = this.findAnimationPlayer(children[i])
      if (!isNull(childPlayer)) {
        return childPlayer
      }
    }

    return null
  }
}
