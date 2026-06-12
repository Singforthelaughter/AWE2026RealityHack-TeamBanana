import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractorEvent} from "SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent"
import {TargetingMode} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import NativeLogger from "SpectaclesInteractionKit.lspkg/Utils/NativeLogger"

const TAG = "ButterflyHoverAnimationController"
const HOVER_CLIP_NAMES = ["Armature_wingFlap", "Armature|wingFlap", "Armature|wingAction", "body|wingAction"]
const HOVER_COLLIDER_SIZE = new vec3(6.0, 4.5, 4.5)

const log = new NativeLogger(TAG)

@component
export class ButterflyHoverAnimationController extends BaseScriptComponent {
  @input
  clipName: string = ""

  @input
  colliderSize: vec3 = HOVER_COLLIDER_SIZE

  private animationPlayer: AnimationPlayer | null = null
  private interactable: Interactable | null = null
  private collider: ColliderComponent | null = null
  private colliderShape: BoxShape | null = null
  private activeClipName: string | null = null

  onAwake() {
    this.animationPlayer = this.findAnimationPlayer(this.sceneObject)
    if (isNull(this.animationPlayer)) {
      log.e(`AnimationPlayer not found on ${this.sceneObject.name} or its children`)
    }

    this.activeClipName = this.resolveHoverClipName()
    this.resetAnimationToStart()

    this.collider = this.sceneObject.getComponent("ColliderComponent") || this.sceneObject.createComponent("ColliderComponent")
    this.collider.fitVisual = false
    this.colliderShape = Shape.createBoxShape()
    this.colliderShape.size = this.colliderSize
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

    const clipName = this.activeClipName || this.resolveHoverClipName()
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
    this.resetAnimationToStart()
  }

  private resolveHoverClipName(): string | null {
    if (isNull(this.animationPlayer)) {
      return null
    }

    if (this.clipName && !isNull(this.animationPlayer.getClip(this.clipName))) {
      return this.clipName
    }

    for (let i = 0; i < HOVER_CLIP_NAMES.length; i++) {
      const clip = this.animationPlayer.getClip(HOVER_CLIP_NAMES[i])
      if (!isNull(clip)) {
        return HOVER_CLIP_NAMES[i]
      }
    }

    return null
  }

  private resetAnimationToStart(): void {
    if (isNull(this.animationPlayer)) {
      return
    }

    const clipName = this.activeClipName || this.resolveHoverClipName()
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
