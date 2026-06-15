import { LSTween } from "Spectacles3DHandHints.lspkg/LSTween/LSTween"
import Easing from "LSTween.lspkg/TweenJS/Easing"
import { CustomHandHintAnimation } from "./CustomHandHintAnimation"

@component
export class InstructionManager extends BaseScriptComponent {
  @input text!: Text
  @input handHint!: CustomHandHintAnimation
  @input onboardingVisual!: SceneObject

  private selfTransform!: Transform

  onAwake() {
    this.selfTransform = this.sceneObject.getTransform()
    this.selfTransform.setLocalScale(vec3.zero())
    this.onboardingVisual.getTransform().setLocalScale(vec3.zero())

    this.createEvent("OnStartEvent").bind(() => {
      LSTween.scaleToLocal(this.onboardingVisual.getTransform(), new vec3(0.5, 0.5, 0.5), 1000)
        .easing(Easing.Sinusoidal.Out)
        .start()

      LSTween.scaleToLocal(this.selfTransform, vec3.one(), 1000).easing(Easing.Sinusoidal.Out).start()
      timeManager.setTimeout(() => {
        this.handHint.play()
        timeManager.setTimeout(() => {
          this.text.text = ""
        }, 6000)
      }, 1000)
    })
  }
}
