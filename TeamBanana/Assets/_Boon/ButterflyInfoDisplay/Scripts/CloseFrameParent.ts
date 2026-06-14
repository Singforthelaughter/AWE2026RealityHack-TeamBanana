import {Frame} from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"

@component
export class CloseFrameParent extends BaseScriptComponent {
  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      const frame = this.sceneObject.getComponent(Frame.getTypeName()) as Frame
      frame?.closeButton?.onTriggerUp.add(() => {
        this.sceneObject.destroy()
      })
    })
  }
}
