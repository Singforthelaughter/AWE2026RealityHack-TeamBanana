import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractorEvent} from "SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent"
import {TargetingMode} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import NativeLogger from "SpectaclesInteractionKit.lspkg/Utils/NativeLogger"

const TAG = "ButterflyHoverAnimationController"
const HOVER_CLIP_NAMES = ["Armature|ArmatureAction", "Armature|wingAction", "body|wingAction"]
const HOVER_COLLIDER_SIZE = new vec3(6.0, 4.5, 4.5)

const log = new NativeLogger(TAG)

@component
export class ButterflyHoverAnimationController extends BaseScriptComponent {
  private animationPlayer: AnimationPlayer | null = null
  private interactable: Interactable | null = null
  private collider: ColliderComponent | null = null
  private colliderShape: BoxShape | null = null
  private activeClipName: string | null = null

  onAwake() {
    this.animationPlayer = this.sceneObject.getComponent("AnimationPlayer")
    if (isNull(this.animationPlayer)) {
      log.e(`AnimationPlayer not found on ${this.sceneObject.name}`)
      return
    }

    this.animationPlayer.enabled = false

    this.collider = this.sceneObject.getComponent("ColliderComponent") || this.sceneObject.createComponent("ColliderComponent")
    this.collider.fitVisual = false
    this.colliderShape = Shape.createBoxShape()
    this.colliderShape.size = HOVER_COLLIDER_SIZE
    this.collider.shape = this.colliderShape
    this.collider.enabled = true

    this.interactable = this.sceneObject.getComponent(Interactable.getTypeName()) || this.sceneObject.createComponent(Interactable.getTypeName())
    this.interactable.targetingMode = TargetingMode.All
    this.interactable.enabled = true

    this.interactable.onHoverEnter.add(this.onHoverEnter)
    this.interactable.onHoverExit.add(this.onHoverExit)
  }

  private onHoverEnter = (_eventData: InteractorEvent) => {
    if (isNull(this.animationPlayer)) {
      return
    }

    const clipName = this.resolveHoverClipName()
    if (clipName === null) {
      log.e(`No hover clip found on ${this.sceneObject.name}`)
      return
    }

    this.activeClipName = clipName
    this.animationPlayer.enabled = true

    const clip = this.animationPlayer.getClip(clipName)
    if (!isNull(clip)) {
      clip.disabled = false
      clip.playbackSpeed = 1.0
    }

    this.animationPlayer.playClipAt(clipName, 0.0)
  }

  private onHoverExit = (_eventData: InteractorEvent) => {
    if (isNull(this.animationPlayer) || this.activeClipName === null) {
      return
    }

    const clip = this.animationPlayer.getClip(this.activeClipName)
    if (!isNull(clip)) {
      clip.disabled = false
      clip.playbackSpeed = 0.0
    }

    this.animationPlayer.enabled = true
    this.animationPlayer.playClipAt(this.activeClipName, 0.0)
  }

  private resolveHoverClipName(): string | null {
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
}
