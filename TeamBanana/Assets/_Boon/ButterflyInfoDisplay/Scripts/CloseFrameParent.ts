import {Frame} from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"

@component
export class CloseFrameParent extends BaseScriptComponent {
  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      const frame = this.sceneObject.getComponent(Frame.getTypeName()) as Frame
      // The Frame builds its _buttonHandler in its own OnStartEvent (Frame.initialize). Since
      // OnStartEvent order isn't guaranteed — and this card is instantiated at runtime — force
      // initialize() (idempotent) so closeButton's getter doesn't read an undefined handler.
      frame?.initialize()
      frame?.closeButton?.onTriggerUp.add(() => {
        this.sceneObject.destroy()
      })
    })
  }
}
