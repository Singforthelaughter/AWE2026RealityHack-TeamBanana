import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import {HandInputData} from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandInputData"
import TrackedHand from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/TrackedHand"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {GeminiAssistant} from "../../_Joe/Assets/Scripts/Core/GeminiAssistant"
import {ActivityIndicatorController} from "./ActivityIndicatorController"

/**
 * PalmPushToTalk — palm-up "push to talk", inspired by the Agent Center sample's VoiceNoteGesture
 * but trimmed (no send/trash/drag UI) and wired to Joe's Gemini Live.
 *
 * FLOW:
 *   1. Raise an open hand toward your face        -> the hand menu appears, anchored to your hand.
 *   2. Bring index + thumb close ("approaching")  -> the "Pinch to record" tooltip shows.
 *   3. Pinch and HOLD                             -> lights up (indicator on) + streams mic to Gemini.
 *   4. Speak                                      -> live subtitles (Gemini transcribes you).
 *   5. Release the pinch                          -> stops streaming; Gemini answers.
 *
 * You provide the VISUALS as inputs (download the sample prefabs or use your own):
 *   - handMenu          : the object anchored to your hand (e.g. the mic button). The script
 *                         positions it on your palm and shows/hides it. Make the indicator/tooltip
 *                         CHILDREN of this so they follow.
 *   - activityIndicator : the "lights up while recording" glow (e.g. the sample's MicActivityIndicator).
 *   - tooltip           : optional "Pinch to record" hint shown as fingers approach a pinch.
 *   - subtitleText      : optional live caption (gray while partial, white when final).
 *
 * It talks to Joe's GeminiAssistant only via:
 *   - geminiAssistant.streamData(true/false)   start/stop the mic stream
 *   - geminiAssistant.userSpeechEvent          live transcription (the subtitles)
 *
 * ⚠️ DEVICE ONLY: hand tracking + Gemini mic streaming run on real Spectacles, not in Preview.
 */
@component
export class PalmPushToTalk extends BaseScriptComponent {
  @input
  @hint("Joe's GeminiAssistant component (streamData + userSpeechEvent)")
  geminiAssistant!: GeminiAssistant

  @input
  @hint("Hand-anchored root (e.g. the mic button). Script positions it on your palm. Starts hidden.")
  handMenu!: SceneObject

  @input
  @hint("'Lights up while recording' visual (e.g. the sample's MicActivityIndicator). Best a child of handMenu.")
  activityIndicator: SceneObject | null = null

  @input
  @hint("Optional 'Pinch to record' tooltip, shown as fingers approach a pinch. Best a child of handMenu.")
  tooltip: SceneObject | null = null

  @input
  @hint("Text for live subtitles. Make a Text in the editor (a child of HandMenu works well) and assign it.")
  subtitleText: Text | null = null

  @input
  @hint("Log gesture activity to the Logger panel")
  debugLogging: boolean = true

  // --- tuning (from the sample) ---
  private readonly PALM_SHOW_ANGLE = 65 // palm "facing" when angle to camera < this (when idle)
  private readonly PALM_HIDE_ANGLE = 80 // hysteresis: only hides once angle exceeds this (when active)
  private readonly PINCH_DOWN_DISTANCE = 2.0 // cm index<->thumb to count as a pinch down
  private readonly PINCH_UP_DISTANCE = 4.5 // cm index<->thumb to count as released
  private readonly PINCH_MIN_HOLD_S = 0.15 // ignore ultra-short pinches
  private readonly POS_LERP = 0.3
  private readonly ROT_LERP = 0.3
  private readonly PARTIAL_COLOR = new vec4(0.6, 0.6, 0.6, 1) // gray while you're still speaking
  private readonly FINAL_COLOR = new vec4(1, 1, 1, 1) // white once the phrase is finalized
  private readonly LISTENING_PLACEHOLDER = "Listening..."
  // Matches ActivityIndicatorController.transitionDuration — used to delay the tooltip's
  // return until the glow has finished animating out after release.
  private readonly GLOW_FADE_S = 0.5

  private handProvider: HandInputData = SIK.HandInputData
  private leftHand: TrackedHand = this.handProvider.getHand("left")
  private rightHand: TrackedHand = this.handProvider.getHand("right")
  private gestureModule: GestureModule = require("LensStudio:GestureModule")
  private camera = WorldCameraFinderProvider.getInstance()

  private activeHand: TrackedHand | null = null
  private recording: boolean = false
  private tooltipShown: boolean = false
  // Don't re-show the tooltip until this time — lets the glow animate out first after release.
  private tooltipReadyAt: number = 0
  // GestureModule pinch flags per hand (combined with skeleton distance for reliability, like the sample).
  private pinchingLeft: boolean = false
  private pinchingRight: boolean = false
  private fingersPinched: boolean = false
  private pinchStartTime: number = 0
  // Gemini sends transcription in fragments; we accumulate them here so the caption builds up
  // word-by-word during a hold (like the sample), then reset for the next utterance.
  private captionBuffer: string = ""

  onAwake(): void {
    this.handMenu.enabled = false
    this.setIndicator(false)
    this.setTooltip(false)
    this.hideSubtitle()
    this.bindPinchEvents()
    // Live subtitles: Gemini sends transcription in fragments while you speak. Accumulate them so
    // the caption builds up word-by-word, and ignore anything that arrives after you release.
    this.geminiAssistant.userSpeechEvent.add((e: {text: string; isFinal: boolean}) => {
      if (this.debugLogging) print(`[PalmPushToTalk] userSpeech${e.isFinal ? " (FINAL)" : ""}: "${e.text}"`)
      if (!this.recording) return
      this.captionBuffer += e.text
      this.showSubtitle(this.captionBuffer, e.isFinal)
    })
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /** Track GestureModule pinch up/down per hand. */
  private bindPinchEvents(): void {
    this.gestureModule.getPinchDownEvent(GestureModule.HandType.Left).add(() => (this.pinchingLeft = true))
    this.gestureModule.getPinchUpEvent(GestureModule.HandType.Left).add(() => (this.pinchingLeft = false))
    this.gestureModule.getPinchDownEvent(GestureModule.HandType.Right).add(() => (this.pinchingRight = true))
    this.gestureModule.getPinchUpEvent(GestureModule.HandType.Right).add(() => (this.pinchingRight = false))
  }

  private onUpdate(): void {
    this.updateActiveHand()

    // No palm-facing hand -> hide everything, stop recording if we were.
    if (!this.activeHand || !this.activeHand.isTracked()) {
      this.handMenu.enabled = false
      this.setTooltip(false)
      this.tooltipShown = false
      if (this.recording) this.stopRecording()
      this.hideSubtitle()
      return
    }

    this.handMenu.enabled = true
    this.anchorToHand(this.activeHand)
    this.updateTooltip()
    this.checkPinch(this.activeHand)
  }

  /** Pick whichever hand is facing the camera. Hysteresis keeps the current hand while it stays facing. */
  private updateActiveHand(): void {
    if (this.activeHand && this.activeHand.isTracked() && this.isPalmFacing(this.activeHand)) {
      return
    }
    if (this.isPalmFacing(this.leftHand)) {
      this.activeHand = this.leftHand
    } else if (this.isPalmFacing(this.rightHand)) {
      this.activeHand = this.rightHand
    } else {
      this.activeHand = null
    }
  }

  /** Palm faces the camera when the hand's facing-angle is below the threshold (looser while active). */
  private isPalmFacing(h: TrackedHand): boolean {
    if (!h.isTracked()) return false
    const angle = h.getFacingCameraAngle()
    if (angle === null) return false
    const threshold = this.activeHand === h ? this.PALM_HIDE_ANGLE : this.PALM_SHOW_ANGLE
    return angle < threshold
  }

  /**
   * Pinch-and-hold detection (faithful to the sample): requires BOTH the GestureModule pinch flag
   * and the index/thumb tips being close. Down -> start; release (tips apart + min hold) -> stop.
   */
  private checkPinch(h: TrackedHand): void {
    const gesturePinch = h === this.leftHand ? this.pinchingLeft : this.pinchingRight
    const distance = h.indexTip.position.distance(h.thumbTip.position)

    if (!this.fingersPinched && gesturePinch && distance < this.PINCH_DOWN_DISTANCE) {
      this.fingersPinched = true
      this.pinchStartTime = getTime()
      this.startRecording()
    } else if (
      this.fingersPinched &&
      !gesturePinch &&
      distance > this.PINCH_UP_DISTANCE &&
      getTime() - this.pinchStartTime >= this.PINCH_MIN_HOLD_S
    ) {
      this.fingersPinched = false
      this.stopRecording()
    }
  }

  /** Show the "Pinch to record" hint whenever the palm is up and we're not recording. */
  private updateTooltip(): void {
    // Hidden while recording, and held back until the glow has animated out after release.
    const shouldShow = !this.recording && getTime() >= this.tooltipReadyAt
    if (shouldShow === this.tooltipShown) return
    this.tooltipShown = shouldShow
    this.setTooltip(shouldShow)
  }

  /** Smoothly move/rotate the hand menu to the index/thumb midpoint, facing the camera. */
  private anchorToHand(h: TrackedHand): void {
    const midpoint = vec3.lerp(h.indexTip.position, h.thumbTip.position, 0.5)
    const t = this.handMenu.getTransform()
    t.setWorldPosition(vec3.lerp(t.getWorldPosition(), midpoint, this.POS_LERP))

    const toCamera = this.camera.getWorldPosition().sub(t.getWorldPosition()).normalize()
    const targetRot = quat.lookAt(toCamera, vec3.up())
    t.setWorldRotation(quat.slerp(t.getWorldRotation(), targetRot, this.ROT_LERP))
  }

  private startRecording(): void {
    this.recording = true
    this.captionBuffer = "" // fresh utterance
    this.geminiAssistant.streamData(true) // start streaming mic to Gemini Live
    this.setIndicator(true) // light up
    this.setTooltip(false)
    this.tooltipShown = false
    this.showSubtitle(this.LISTENING_PLACEHOLDER, false)
    if (this.debugLogging) print("[PalmPushToTalk] recording started")
  }

  private stopRecording(): void {
    this.recording = false
    this.geminiAssistant.streamData(false) // stop the mic stream; Gemini answers
    this.setIndicator(false) // dim (glow animates out over GLOW_FADE_S)
    this.tooltipReadyAt = getTime() + this.GLOW_FADE_S // bring the tooltip back as the glow finishes
    this.hideSubtitle() // clear the caption immediately on release — don't let it linger
    if (this.debugLogging) print("[PalmPushToTalk] recording stopped")
  }

  /** Live caption: gray while partial, white once finalized (like the sample's transcript label). */
  private showSubtitle(text: string, isFinal: boolean): void {
    if (!this.subtitleText || !text) return
    this.subtitleText.text = text
    this.subtitleText.textFill.color = isFinal ? this.FINAL_COLOR : this.PARTIAL_COLOR
    this.subtitleText.getSceneObject().enabled = true
  }

  /** Clear + hide the caption so old text doesn't reappear when the hand menu shows again. */
  private hideSubtitle(): void {
    this.captionBuffer = ""
    if (!this.subtitleText) return
    this.subtitleText.text = ""
    this.subtitleText.getSceneObject().enabled = false
  }

  private setIndicator(on: boolean): void {
    if (!this.activityIndicator) return
    // If the object has the sample's ActivityIndicatorController, use it for a smooth shader fade.
    // Otherwise just turn the object on/off.
    const controller = this.activityIndicator.getComponent(
      ActivityIndicatorController.getTypeName()
    ) as ActivityIndicatorController
    if (controller) {
      controller.setVisible(on)
    } else {
      this.activityIndicator.enabled = on
    }
  }

  private setTooltip(on: boolean): void {
    if (this.tooltip) this.tooltip.enabled = on
  }
}