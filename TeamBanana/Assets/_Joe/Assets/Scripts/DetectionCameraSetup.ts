import { MLSpatializer } from "_Aggy/Scripts/MLSpatializer"

/**
 * DetectionCameraSetup — drop this on the SAME SceneObject as MLSpatializer.
 *
 * Requests the left RGB camera feed at runtime and auto-wires it to the sibling
 * MLSpatializer (.inputTexture).
 *
 * Wire the MLSpatializer reference in the Inspector.
 *
 * ⚠️ DEVICE ONLY: CameraModule.requestCamera works on Spectacles hardware.
 * Returns null in Lens Studio Preview.
 */

const CAMERA_MODULE = require("LensStudio:CameraModule")

@component
export class DetectionCameraSetup extends BaseScriptComponent {
  @input
  @hint("MLSpatializer component on the same SceneObject")
  mlSpatializer: MLSpatializer | null = null

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      try {
        const camRequest = CameraModule.createCameraRequest()
        camRequest.cameraId = CameraModule.CameraId.Left_Color
        const cameraTexture = CAMERA_MODULE.requestCamera(camRequest)

        if (cameraTexture) {
          print("DetectionCameraSetup: Camera texture ready")
        } else {
          print("DetectionCameraSetup: WARNING — camera texture null (expected in Preview)")
        }

        // Wire to MLSpatializer
        if (this.mlSpatializer && this.mlSpatializer.inputTexture !== undefined) {
          this.mlSpatializer.inputTexture = cameraTexture
          print("DetectionCameraSetup: Wired inputTexture to MLSpatializer")
        } else if (!this.mlSpatializer) {
          print("DetectionCameraSetup: WARNING — MLSpatializer not assigned in Inspector")
        }
      } catch (e) {
        print("DetectionCameraSetup: ERROR — " + e)
      }
    })
  }
}
