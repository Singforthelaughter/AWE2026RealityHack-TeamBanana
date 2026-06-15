import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import {HandInputData} from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandInputData"
import TrackedHand from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/TrackedHand"
import {LSTween} from "LSTween.lspkg/Examples/Scripts/LSTween"
import Easing from "LSTween.lspkg/TweenJS/Easing"

/**
 * ButterflyMovementController — spawns a butterfly in front of the camera and gives it
 * a lifelike, fluttery flight that stays inside the user's field of view. When a hand is
 * tracked the butterfly lands on the configured finger joint; when tracking is lost it
 * takes off again and resumes free flight.
 *
 * Attach this to the butterfly SceneObject itself (the object it moves IS this object).
 *
 * FLIGHT MODEL:
 *   - Free flight picks wander targets in camera-relative spherical coordinates (within the
 *     horizontal/vertical angle bounds and the min/max distance band) so the butterfly is
 *     always somewhere in view, no matter where the user looks.
 *   - Steering is velocity-based with a limited turn rate, plus high-frequency perpendicular
 *     "wing wobble" so the path looks erratic and alive rather than a straight glide.
 *
 * ⚠️ DEVICE ONLY for landing: hand tracking runs on real Spectacles, not in Preview.
 */
@component
export class ButterflyMovementController extends BaseScriptComponent {
  @input
  @hint("Main Spectacles camera SceneObject. Used as the origin/orientation for flight and spawning.")
  camera!: SceneObject

  @input
  @hint(
    "SIK hand-joint property to land on, e.g. indexTip, thumbTip, middleTip, ringTip, pinkyTip, wrist."
  )
  fingerJointName: string = "indexTip"

  @input
  @hint("Only land when the finger is within this angle (degrees) of the camera's view center. Larger = lands even when the hand is near the edge of view.")
  handViewAngleLimit: number = 30

  @input
  @hint("How smoothly/slowly the butterfly eases onto the finger (per second). Lower = slower, gentler landing; higher = snappier.")
  landingSmoothing: number = 3

  @input
  @hint("Perch offset from the finger joint, camera-relative in cm: x = right, y = up, z = forward. e.g. (0,1,0) sits 1cm above the fingertip.")
  landPositionOffset: vec3 = new vec3(0, 0, 0)

  @input
  @hint("Base flight speed in cm/s.")
  speed: number = 25

  @input
  @hint("Final butterfly scale. Spawns at 0 and tweens up to this.")
  scale: number = 1

  @input
  @hint("Spawn offset relative to the camera, in cm. x = right, y = up, z = forward (in front).")
  spawnPositionOffset: vec3 = new vec3(0, -5, 60)

  @input
  @hint("Spawn rotation offset relative to the camera, in degrees (x, y, z).")
  spawnRotation: vec3 = new vec3(0, 0, 0)

  @input
  @hint("Nearest distance from the camera the butterfly will wander to, in cm.")
  minDistance: number = 40

  @input
  @hint("Farthest distance from the camera the butterfly will wander to, in cm.")
  maxDistance: number = 90

  @input
  @hint("Half horizontal field of view the butterfly stays within, in degrees.")
  horizontalAngle: number = 22

  @input
  @hint("Half vertical field of view the butterfly stays within, in degrees.")
  verticalAngle: number = 16

  @input
  @hint("Scale-in tween duration on spawn, in milliseconds.")
  spawnScaleDuration: number = 700

  @input
  @hint("How much the butterfly flutters off its path, as a fraction of speed. 0 = straight glide, ~0.5 = lively, >1 = frantic.")
  flutterAmount: number = 0.55

  @input
  @hint("How fast the wings wobble, in Hz. Higher = quicker, twitchier fluttering.")
  flutterFrequency: number = 11

  @input
  @hint("Randomness in the flutter rate. 0 = steady mechanical wobble, ~0.4 = natural, 1 = very erratic.")
  flutterNoise: number = 0.4

  @input
  @hint("How much the head pitches up/down toward the flight direction. 0 = body stays level when climbing/diving (most butterfly-like), 1 = nose fully follows the direction.")
  headPitchFollow: number = 0.25

  @input
  @hint("Local axis that is the butterfly's nose/front (default 0,1,0). If the head points wrong, try (0,0,1), (1,0,0), or their negatives until the head leads.")
  modelForwardAxis: vec3 = new vec3(0, 1, 0)

  @input
  @hint("Local axis pointing UP out of the butterfly's back (default 0,0,-1, since down=+Z). Adjust if it flies upside-down or banked once the head is correct.")
  modelUpAxis: vec3 = new vec3(0, 0, -1)

  @input
  @hint("Extra rotation applied on top of the heading while flying, in local degrees (x, y, z). Use to nose-down/bank the model to taste.")
  flyingRotationOffset: vec3 = new vec3(0, 0, 0)

  @input
  @hint("Rotation applied while perched on the finger, in local degrees (x, y, z), on top of facing the user.")
  landedRotationOffset: vec3 = new vec3(0, 0, 0)

  @input
  @hint("How much the perched butterfly rotates with the finger. 0 = always face the user, 1 = fully match the finger's orientation. ~0.4 = leans with the finger but stays comfy.")
  fingerRotationFollow: number = 0.4

  @input
  @hint("AnimationPlayer playback speed while flying (fast wing flapping).")
  flyingAnimationSpeed: number = 4

  @input
  @hint("AnimationPlayer playback speed while perched on a finger (slow).")
  landedAnimationSpeed: number = 0.25

  @input
  @hint("DEBUG: hover in place facing straight ahead (no flutter/wander/landing) so you can read off the head direction and fix the model axes. Turn off for normal flight.")
  debugFreezeHeading: boolean = false

  // --- flight tuning (constants) ---
  private readonly DEG2RAD = Math.PI / 180
  private readonly TURN_RATE = 2.5 // how fast velocity steers toward the desired direction (per second)
  private readonly ROT_LERP = 6.0 // how fast the model yaws to face its heading (per second)
  private readonly RETARGET_DISTANCE = 8 // cm — within this of the target, pick a new one
  private readonly RETARGET_MAX_TIME = 4 // s — force a new target even if not reached (avoids stalling)
  private readonly SPEED_PULSE_FREQ = 2.3 // Hz — slow dart/coast variation
  private readonly LAND_ARRIVE_DISTANCE = 3 // cm — close enough to be considered landed
  private readonly IDLE_FREQ = 3.5 // Hz — gentle bob while perched
  private readonly IDLE_AMP = 0.4 // cm — perched bob amplitude

  private handProvider: HandInputData = SIK.HandInputData
  private leftHand: TrackedHand = this.handProvider.getHand("left")
  private rightHand: TrackedHand = this.handProvider.getHand("right")

  private transform!: Transform
  private camPos: vec3 = vec3.zero()
  private camForward: vec3 = vec3.forward()
  private camRight: vec3 = vec3.right()
  private camUp: vec3 = vec3.up()

  private velocity: vec3 = vec3.zero()
  private target: vec3 = vec3.zero()
  private timeSinceRetarget: number = 0
  private state: "flying" | "landing" | "landed" = "flying"

  // Wing-wobble driven by an accumulated phase so the rate can wander (noise) without discontinuities.
  private flutterPhase: number = 0
  private flutterSeed: number = 0

  // AnimationPlayer on the same object — wing-flap speed is fast while flying, slow while perched.
  private animationPlayer: AnimationPlayer | null = null
  private currentAnimSpeed: number = NaN

  onAwake(): void {
    this.transform = this.getTransform()
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  private onStart(): void {
    this.updateCameraBasis()
    this.animationPlayer = this.getSceneObject().getComponent("AnimationPlayer")
    this.applyAnimationSpeed(this.flyingAnimationSpeed) // spawns flying

    // Spawn in front of the camera, accounting for camera rotation, with the configured offsets.
    const spawnPos = this.camPos
      .add(this.camRight.uniformScale(this.spawnPositionOffset.x))
      .add(this.camUp.uniformScale(this.spawnPositionOffset.y))
      .add(this.camForward.uniformScale(this.spawnPositionOffset.z))
    const localRot = quat.fromEulerAngles(
      this.spawnRotation.x * this.DEG2RAD,
      this.spawnRotation.y * this.DEG2RAD,
      this.spawnRotation.z * this.DEG2RAD
    )
    this.transform.setWorldPosition(spawnPos)
    // Start facing the initial heading (camera-forward), then apply the user's rotation offset.
    this.transform.setWorldRotation(this.headingRotation(this.camForward).multiply(localRot))

    // Scale in from 0 -> this.scale.
    this.transform.setLocalScale(vec3.zero())
    LSTween.scaleToLocal(this.transform, new vec3(this.scale, this.scale, this.scale), this.spawnScaleDuration)
      .easing(Easing.Back.Out)
      .start()

    // Set off flying. Randomize the flutter seed/phase so multiple butterflies aren't in sync.
    this.flutterSeed = Math.random() * 1000
    this.flutterPhase = Math.random() * Math.PI * 2
    this.velocity = this.camForward.uniformScale(this.speed * 0.5)
    this.retarget()
  }

  private onUpdate(): void {
    const dt = getDeltaTime()
    if (dt <= 0) return
    this.updateCameraBasis()
    this.advanceFlutter(dt)

    // DEBUG: hold still facing straight ahead so the head direction is unambiguous to read off.
    if (this.debugFreezeHeading) {
      this.transform.setWorldRotation(this.headingRotation(this.camForward))
      return
    }

    const hand = this.getTrackedHand()
    const joint = hand ? this.getJoint(hand) : null
    // Only land when the finger is actually within the camera's view cone, not merely tracked.
    const fingerInView = joint !== null && this.isWithinView(joint.position)

    if (fingerInView) {
      this.flyToFinger(joint, dt)
    } else {
      // No finger in view: make sure we're flying and have a fresh target.
      if (this.state !== "flying") {
        this.state = "flying"
        this.retarget()
      }
      this.flyFree(dt)
    }
  }

  // --- free flight -----------------------------------------------------------

  private flyFree(dt: number): void {
    const pos = this.transform.getWorldPosition()
    this.timeSinceRetarget += dt

    let toTarget = this.target.sub(pos)
    if (toTarget.length < this.RETARGET_DISTANCE || this.timeSinceRetarget > this.RETARGET_MAX_TIME) {
      this.retarget()
      toTarget = this.target.sub(pos)
    }

    const desiredDir = toTarget.normalize()
    const t = getTime()
    // Butterflies dart then coast — vary the cruise speed slowly.
    const speedPulse = this.speed * (0.7 + 0.3 * Math.sin(t * this.SPEED_PULSE_FREQ))
    const desiredVel = desiredDir.uniformScale(speedPulse).add(this.computeFlutter(desiredDir))

    this.velocity = vec3.lerp(this.velocity, desiredVel, Math.min(1, this.TURN_RATE * dt))
    this.transform.setWorldPosition(pos.add(this.velocity.uniformScale(dt)))
    this.faceHeading(this.velocity, dt, this.flyingRotationOffset)
    this.applyAnimationSpeed(this.flyingAnimationSpeed)
  }

  private retarget(): void {
    const yaw = this.randRange(-this.horizontalAngle, this.horizontalAngle) * this.DEG2RAD
    const pitch = this.randRange(-this.verticalAngle, this.verticalAngle) * this.DEG2RAD
    const dist = this.randRange(this.minDistance, this.maxDistance)
    const dir = this.camForward
      .add(this.camRight.uniformScale(Math.tan(yaw)))
      .add(this.camUp.uniformScale(Math.tan(pitch)))
      .normalize()
    this.target = this.camPos.add(dir.uniformScale(dist))
    this.timeSinceRetarget = 0
  }

  /** Advance the wing-wobble phase once per frame, letting the rate wander via smooth noise. */
  private advanceFlutter(dt: number): void {
    const wobbleNoise = this.pseudoNoise(getTime() * 0.6 + this.flutterSeed) // smooth, in ~[-1, 1]
    const instFreq = this.flutterFrequency * Math.max(0.05, 1 + this.flutterNoise * wobbleNoise)
    this.flutterPhase += instFreq * dt
  }

  /** High-frequency wobble perpendicular to the heading — the "fluttering wings" look. */
  private computeFlutter(dir: vec3): vec3 {
    const amp = this.speed * this.flutterAmount
    const right = dir.cross(this.camUp).normalize()
    const up = right.cross(dir).normalize()
    const sideWobble = Math.sin(this.flutterPhase) * amp
    const upWobble = Math.sin(this.flutterPhase * 0.6 + 1.7) * amp * 1.3
    return right.uniformScale(sideWobble).add(up.uniformScale(upWobble))
  }

  /** Smooth pseudo-random signal in ~[-1, 1] from layered incommensurate sines (no noise asset needed). */
  private pseudoNoise(x: number): number {
    return 0.5 * Math.sin(x * 1.3) + 0.35 * Math.sin(x * 2.7 + 1.1) + 0.15 * Math.sin(x * 0.7 + 4.2)
  }

  // --- landing ---------------------------------------------------------------

  private flyToFinger(joint: any, dt: number): void {
    const jointPos = joint.position as vec3
    const pos = this.transform.getWorldPosition()
    // Perch target: the finger joint plus a camera-relative offset.
    const target = jointPos
      .add(this.camRight.uniformScale(this.landPositionOffset.x))
      .add(this.camUp.uniformScale(this.landPositionOffset.y))
      .add(this.camForward.uniformScale(this.landPositionOffset.z))
    const distance = target.distance(pos)

    if (this.state === "flying") this.state = "landing"
    if (distance < this.LAND_ARRIVE_DISTANCE) this.state = "landed"

    if (this.state === "landed") {
      // Track the (moving) finger exactly — no smoothing — with a small perched bob.
      const t = getTime()
      const perch = target.add(this.camUp.uniformScale(Math.sin(t * this.IDLE_FREQ) * this.IDLE_AMP))
      this.transform.setWorldPosition(perch)
      this.facePerched(joint, dt)
      this.applyAnimationSpeed(this.landedAnimationSpeed)
    } else {
      // Approaching: frame-rate-independent exponential ease toward the perch, head along the approach.
      const k = 1 - Math.exp(-this.landingSmoothing * dt)
      this.transform.setWorldPosition(vec3.lerp(pos, target, k))
      this.faceHeading(target.sub(pos), dt, this.flyingRotationOffset)
      this.applyAnimationSpeed(this.flyingAnimationSpeed) // still airborne — keep flapping fast
    }
    this.velocity = vec3.zero()
  }

  // --- helpers ---------------------------------------------------------------

  /** Right hand wins if both are tracked; otherwise whichever is tracked, or null. */
  private getTrackedHand(): TrackedHand | null {
    if (this.rightHand.isTracked()) return this.rightHand
    if (this.leftHand.isTracked()) return this.leftHand
    return null
  }

  /** Resolve the configured joint (SIK Keypoint) by name, or null if unavailable. */
  private getJoint(hand: TrackedHand): any {
    const joint = (hand as any)[this.fingerJointName]
    return joint && joint.position ? joint : null
  }

  /** True when `point` lies within `handViewAngleLimit` degrees of the camera's view center. */
  private isWithinView(point: vec3): boolean {
    const dir = point.sub(this.camPos)
    if (dir.lengthSquared < 1e-6) return true
    return dir.normalize().dot(this.camForward) >= Math.cos(this.handViewAngleLimit * this.DEG2RAD)
  }

  /** Smoothly turn the model to travel along `dir`, kept upright, plus a local rotation offset. */
  private faceHeading(dir: vec3, dt: number, offsetDegrees: vec3): void {
    if (dir.length < 0.01) return
    const target = this.headingRotation(this.levelHeading(dir)).multiply(this.eulerToQuat(offsetDegrees))
    this.transform.setWorldRotation(
      quat.slerp(this.transform.getWorldRotation(), target, Math.min(1, this.ROT_LERP * dt))
    )
  }

  private eulerToQuat(degrees: vec3): quat {
    return quat.fromEulerAngles(degrees.x * this.DEG2RAD, degrees.y * this.DEG2RAD, degrees.z * this.DEG2RAD)
  }

  /**
   * Perched facing: blend between facing the user and matching the finger's orientation by
   * `fingerRotationFollow`, so the butterfly leans with the finger without rigidly copying it.
   */
  private facePerched(joint: any, dt: number): void {
    const faceUser = this.headingRotation(this.levelHeading(this.camPos.sub(this.transform.getWorldPosition())))
    // Finger's own basis, mapped through the model axes so the nose stays correct.
    const fingerAligned = this.alignRotation(this.modelForwardAxis, this.modelUpAxis, joint.forward, joint.up)
    const blend = Math.max(0, Math.min(1, this.fingerRotationFollow))
    const target = quat.slerp(faceUser, fingerAligned, blend).multiply(this.eulerToQuat(this.landedRotationOffset))
    this.transform.setWorldRotation(
      quat.slerp(this.transform.getWorldRotation(), target, Math.min(1, this.ROT_LERP * dt))
    )
  }

  /** Set playback speed on every clip of the AnimationPlayer (no-op if unchanged or absent). */
  private applyAnimationSpeed(speed: number): void {
    if (!this.animationPlayer || speed === this.currentAnimSpeed) return
    const clips = this.animationPlayer.clips
    for (let i = 0; i < clips.length; i++) clips[i].playbackSpeed = speed
    this.currentAnimSpeed = speed
  }

  /** Reduce the vertical (pitch) part of `dir` so the body stays level when climbing/diving. */
  private levelHeading(dir: vec3): vec3 {
    const vertical = this.camUp.dot(dir)
    const leveled = dir.sub(this.camUp.uniformScale(vertical * (1 - this.headPitchFollow)))
    // If the heading is near-vertical and fully flattened, keep the original to avoid a degenerate aim.
    return leveled.lengthSquared < 1e-4 ? dir : leveled
  }

  /**
   * World rotation that points the model's `modelForwardAxis` along the heading `dir`
   * and keeps `modelUpAxis` aligned with the camera up. Works for any model-axis convention,
   * so a wrong head direction is fixed by tweaking those two inputs in the Inspector.
   */
  private headingRotation(dir: vec3): quat {
    let worldUp = this.camUp
    // Avoid a degenerate roll when the heading is nearly vertical.
    if (Math.abs(dir.normalize().dot(worldUp)) > 0.99) worldUp = this.camForward
    return this.alignRotation(this.modelForwardAxis, this.modelUpAxis, dir, worldUp)
  }

  /**
   * Rotation R such that R · sourceForward = targetForward and R · sourceUp ≈ targetUp.
   * Builds an orthonormal basis for each side and maps one to the other (R = T · Sᵀ).
   */
  private alignRotation(sourceForward: vec3, sourceUp: vec3, targetForward: vec3, targetUp: vec3): quat {
    const sf = sourceForward.normalize()
    const su = this.orthonormalUp(sf, sourceUp)
    const sr = sf.cross(su) // source right (already unit: sf⊥su, both unit)

    const tf = targetForward.normalize()
    const tu = this.orthonormalUp(tf, targetUp)
    const tr = tf.cross(tu)

    // Columns of R = T · Sᵀ = tf⊗sf + tu⊗su + tr⊗sr, read out per local axis.
    const col0 = tf.uniformScale(sf.x).add(tu.uniformScale(su.x)).add(tr.uniformScale(sr.x))
    const col1 = tf.uniformScale(sf.y).add(tu.uniformScale(su.y)).add(tr.uniformScale(sr.y))
    const col2 = tf.uniformScale(sf.z).add(tu.uniformScale(su.z)).add(tr.uniformScale(sr.z))
    return this.quatFromBasis(col0, col1, col2)
  }

  /** Component of `up` perpendicular to `forward`, normalized (with a safe fallback). */
  private orthonormalUp(forward: vec3, up: vec3): vec3 {
    let u = up.sub(forward.uniformScale(up.dot(forward)))
    if (u.lengthSquared < 1e-6) {
      const ref = Math.abs(forward.y) < 0.9 ? vec3.up() : vec3.right()
      u = ref.sub(forward.uniformScale(ref.dot(forward)))
    }
    return u.normalize()
  }

  /** Rotation whose columns are the world directions of the model's local X, Y, Z axes. */
  private quatFromBasis(x: vec3, y: vec3, z: vec3): quat {
    const m00 = x.x, m10 = x.y, m20 = x.z
    const m01 = y.x, m11 = y.y, m21 = y.z
    const m02 = z.x, m12 = z.y, m22 = z.z
    const trace = m00 + m11 + m22
    if (trace > 0) {
      const s = Math.sqrt(trace + 1.0) * 2
      return new quat(0.25 * s, (m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s)
    } else if (m00 > m11 && m00 > m22) {
      const s = Math.sqrt(1.0 + m00 - m11 - m22) * 2
      return new quat((m21 - m12) / s, 0.25 * s, (m01 + m10) / s, (m02 + m20) / s)
    } else if (m11 > m22) {
      const s = Math.sqrt(1.0 + m11 - m00 - m22) * 2
      return new quat((m02 - m20) / s, (m01 + m10) / s, 0.25 * s, (m12 + m21) / s)
    } else {
      const s = Math.sqrt(1.0 + m22 - m00 - m11) * 2
      return new quat((m10 - m01) / s, (m02 + m20) / s, (m12 + m21) / s, 0.25 * s)
    }
  }

  private updateCameraBasis(): void {
    const t = this.camera.getTransform()
    this.camPos = t.getWorldPosition()
    // Camera looks along its -Z axis, so `back` is the view (forward) direction.
    this.camForward = t.back.normalize()
    this.camRight = t.right.normalize()
    this.camUp = t.up.normalize()
  }

  private randRange(min: number, max: number): number {
    return min + Math.random() * (max - min)
  }
}
