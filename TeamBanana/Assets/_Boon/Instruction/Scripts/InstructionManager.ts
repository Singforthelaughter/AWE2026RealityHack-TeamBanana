import { LSTween } from "Spectacles3DHandHints.lspkg/LSTween/LSTween"
import Easing from "LSTween.lspkg/TweenJS/Easing"
import { CustomHandHintAnimation } from "./CustomHandHintAnimation"

@component
export class InstructionManager extends BaseScriptComponent {
  @input text!: Text
  @input handHint!: CustomHandHintAnimation

  private selfTransform!: Transform

  onAwake() {
    this.selfTransform = this.sceneObject.getTransform()
    this.selfTransform.setLocalScale(vec3.zero())

    this.createEvent("OnStartEvent").bind(() => {
      LSTween.scaleToLocal(this.selfTransform, vec3.one(), 1000).easing(Easing.Sinusoidal.Out).start()
      timeManager.setTimeout(() => {
        this.handHint.play()
        timeManager.setTimeout(() => {
          this.text.text = 'Try saying \n"Show me a map of all nearby sightings"'
          timeManager.setTimeout(() => {
            this.text.text = ""
          }, 3000)
        }, 4000)
      }, 1000)
    })
  }
}
