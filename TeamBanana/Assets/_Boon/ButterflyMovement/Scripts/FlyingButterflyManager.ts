import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import {HandInputData} from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandInputData"
import TrackedHand from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/TrackedHand"
import {ButterflyMovementController} from "./ButterflyMovementController"

/**
 * FlyingButterflyManager — spawns butterfly prefabs (each with a ButterflyMovementController),
 * skins their wings with the supplied textures, and coordinates them so that at most ONE butterfly
 * flies to / lands on the user's finger at a time.
 *
 * Selection of the single "landing" butterfly each frame:
 *   1) only butterflies the user is facing (within `facingAngleLimit` of the camera view) are eligible;
 *   2) among those, the one closest to the finger (when the hand is in view) wins — otherwise the one
 *      closest to the camera.
 * The chosen butterfly is permitted to land; all others are forced back into free flight.
 */
@component
export class FlyingButterflyManager extends BaseScriptComponent {
  @input
  @hint("Butterfly prefab. Root must have a ButterflyMovementController; 3rd child is the wing visual.")
  butterflyPrefab!: ObjectPrefab

  @input
  @hint("Main Spectacles camera SceneObject. Passed to each spawned butterfly and used to pick which the user faces.")
  camera!: SceneObject

  @input
  @hint("SIK hand-joint the butterflies land on. Must match the prefab controller's fingerJointName.")
  fingerJointName: string = "indexTip"

  @input
  @hint("A butterfly counts as 'faced' when within this angle (degrees) of the camera's view center.")
  facingAngleLimit: number = 30

  private handProvider: HandInputData = SIK.HandInputData
  private leftHand: TrackedHand = this.handProvider.getHand("left")
  private rightHand: TrackedHand = this.handProvider.getHand("right")
  private butterflies: ButterflyMovementController[] = []

  onAwake(): void {
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /**
   * Spawn a butterfly, skin its wing material, and register it for coordination.
   * @param wingTexture base-color texture for the wing material's `baseTex` (null leaves the prefab default)
   * @param opacityTexture opacity texture for the wing material's `opacityTex` (null leaves the prefab default)
   * @returns the spawned ButterflyMovementController, or null if the prefab is misconfigured
   */
  spawnButterfly(wingTexture: Texture | null, opacityTexture: Texture | null): ButterflyMovementController | null {
    const obj = this.butterflyPrefab.instantiate(this.getSceneObject())

    // Wing visual = 3rd child (Armature, body, wing).
    const rmv =
      obj.getChildrenCount() > 2
        ? (obj.getChild(2).getComponent("Component.RenderMeshVisual") as RenderMeshVisual)
        : null
    if (rmv) {
      // Clone the material so each butterfly carries its own textures instead of sharing one asset.
      const mat = rmv.mainMaterial.clone()
      rmv.mainMaterial = mat
      if (wingTexture) mat.mainPass.baseTex = wingTexture
      if (opacityTexture) mat.mainPass.opacityTex = opacityTexture
    } else {
      print("[FlyingButterflyManager] wing visual (3rd child RenderMeshVisual) not found on prefab")
    }

    const controller = obj.getComponent(ButterflyMovementController.getTypeName()) as ButterflyMovementController
    if (controller) {
      controller.camera = this.camera // ensure the instance flies relative to the scene camera
      this.butterflies.push(controller)
    } else {
      print("[FlyingButterflyManager] spawned prefab has no ButterflyMovementController")
    }
    return controller
  }

  private onUpdate(): void {
    if (this.butterflies.length === 0) return

    const camT = this.camera.getTransform()
    const camPos = camT.getWorldPosition()
    const camForward = camT.back.normalize() // camera looks along -Z
    const cosLimit = Math.cos(this.facingAngleLimit * (Math.PI / 180))
    const fingerPos = this.getFingerInView(camPos, camForward, cosLimit)

    // Pick the single butterfly permitted to land.
    let chosen: ButterflyMovementController | null = null
    let best = Infinity
    for (let i = 0; i < this.butterflies.length; i++) {
      const b = this.butterflies[i]
      const dir = b.getWorldPosition().sub(camPos)
      if (dir.lengthSquared < 1e-6) continue
      // (1) eligible only if the user is facing it
      if (dir.normalize().dot(camForward) < cosLimit) continue
      // (2) closest to the finger if the hand is in view, otherwise closest to the camera
      const metric = fingerPos ? b.getWorldPosition().distance(fingerPos) : dir.length
      if (metric < best) {
        best = metric
        chosen = b
      }
    }

    for (let i = 0; i < this.butterflies.length; i++) {
      this.butterflies[i].setLandingPermitted(this.butterflies[i] === chosen)
    }
  }

  /** Destroy all spawned butterflies. */
  clearAllButterflies(): void {
    for (const b of this.butterflies) {
      if (b && b.getSceneObject()) {
        b.getSceneObject().destroy()
      }
    }
    this.butterflies = []
    print(`[FlyingButterflyManager] All butterflies cleared`)
  }

  /** Finger joint world position when a tracked hand's joint is inside the camera view cone, else null. */
  private getFingerInView(camPos: vec3, camForward: vec3, cosLimit: number): vec3 | null {
    const hand = this.rightHand.isTracked()
      ? this.rightHand
      : this.leftHand.isTracked()
        ? this.leftHand
        : null
    if (!hand) return null
    const joint = (hand as any)[this.fingerJointName]
    if (!joint || !joint.position) return null
    const pos = joint.position as vec3
    const dir = pos.sub(camPos)
    if (dir.lengthSquared < 1e-6) return pos
    return dir.normalize().dot(camForward) >= cosLimit ? pos : null
  }
}
