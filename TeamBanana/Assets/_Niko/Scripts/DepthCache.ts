/*
Finds the closest camera frame to a matching depth frame
*/
class ColorCameraFrame {
  public imageFrame: Texture
  public colorTimestampSeconds: number
  constructor(imageFrame: Texture, colorTimestamp: number) {
    this.imageFrame = imageFrame
    this.colorTimestampSeconds = colorTimestamp
  }
}
class DepthColorPair {
  public colorCameraFrame: ColorCameraFrame
  public depthFrameData: Float32Array
  public depthDeviceCamera: DeviceCamera
  public depthTimestampSeconds: number
  public depthCameraPose: mat4
  constructor(
    colorCameraFrame: ColorCameraFrame,
    depthFrameData: Float32Array,
    depthDeviceCamera: DeviceCamera,
    depthTimestampSeconds: number,
    depthCameraPose: mat4
  ) {
    this.colorCameraFrame = colorCameraFrame
    this.depthFrameData = depthFrameData
    this.depthDeviceCamera = depthDeviceCamera
    this.depthTimestampSeconds = depthTimestampSeconds
    this.depthCameraPose = depthCameraPose
  }
}

@component
export class DepthCache extends BaseScriptComponent {
  @input camModule!: CameraModule

  private colorDeviceCamera!: DeviceCamera
  private depthModule = require("LensStudio:DepthModule") as DepthModule
  private depthFrameSession: DepthFrameSession | null = null
  private isEditor = global.deviceInfoSystem.isEditor()
  private camTexture!: Texture
  private camFrameHistory: ColorCameraFrame[] = []

  private latestCameraDepthPair: DepthColorPair | null = null
  private cachedDepthFrames: Map<number, DepthColorPair> = new Map<number, DepthColorPair>()

  onAwake() {
    this.createEvent("OnStartEvent").bind(this.onStart.bind(this))
  }

  private onStart() {
    this.startCameraUpdates()

    // Give the camera stream a short head start so the depth session has frames to pair with.
    const delayedDepthStart = this.createEvent("DelayedCallbackEvent")
    delayedDepthStart.bind(() => {
      this.startDepthUpdate()
    })
    delayedDepthStart.reset(0.5)
  }

  saveDepthFrame(): number {
    if (!this.latestCameraDepthPair) {
      print("DepthCache not ready: no paired color/depth frame available yet")
      return -1
    }

    //create unique ID for depth frame
    const depthFrameID = Date.now()
    this.cachedDepthFrames.set(depthFrameID, this.latestCameraDepthPair)
    return depthFrameID
  }

  isReady(): boolean {
    return this.latestCameraDepthPair != null
  }

  getReadinessDebugString(): string {
    const reasons: string[] = []

    if (!this.camTexture) {
      reasons.push("color camera texture missing")
    }
    if (!this.colorDeviceCamera) {
      reasons.push("tracking color camera missing")
    }
    if (!this.depthFrameSession) {
      reasons.push("depth frame session missing")
    }
    if (!this.latestCameraDepthPair) {
      reasons.push("no paired depth/color frame yet")
    }

    return reasons.length > 0 ? reasons.join(", ") : "ready"
  }

  getCamImageWithID(depthFrameID: number): Texture | null {
    const cachedDepthColorPair = this.cachedDepthFrames.get(depthFrameID)
    if (!cachedDepthColorPair || !cachedDepthColorPair.colorCameraFrame) {
      return null
    }

    return cachedDepthColorPair.colorCameraFrame.imageFrame
  }

  getWorldPositionWithID(pixelPos: vec2, depthFrameID: number): vec3 | null {
    const cachedDepthColorPair = this.cachedDepthFrames.get(depthFrameID)
    if (cachedDepthColorPair != null) {
      //Remap from the color frame to the depth frame since the depth frame is a cropped and downscaled version of the left color frame.
      const normalizedPointOnColorFrame = pixelPos.div(this.colorDeviceCamera.resolution)
      const pointInCameraSpace = this.colorDeviceCamera.unproject(normalizedPointOnColorFrame, 100.0)
      const projectedPointOnDepthFrame = cachedDepthColorPair.depthDeviceCamera.project(pointInCameraSpace)
      const normalizedPointOnDepthFrame = this.clampNormalizedPoint(projectedPointOnDepthFrame)

      if (this.isNormalizedPointInImage(projectedPointOnDepthFrame)) {
        const objectPixelLocationOnDepthFrame = normalizedPointOnDepthFrame.mult(
          cachedDepthColorPair.depthDeviceCamera.resolution
        )
        // Sample depth at pixel location and compute world position of object.
        const depthVal = this.getMedianDepth(
          cachedDepthColorPair.depthFrameData,
          cachedDepthColorPair.depthDeviceCamera.resolution.x,
          cachedDepthColorPair.depthDeviceCamera.resolution.y,
          Math.floor(objectPixelLocationOnDepthFrame.x),
          Math.floor(objectPixelLocationOnDepthFrame.y),
          1
        )

        if (depthVal == null) {
          print("No valid depth samples at: " + normalizedPointOnDepthFrame)
          return null
        }

        const pointInDeviceRef = cachedDepthColorPair.depthDeviceCamera.unproject(normalizedPointOnDepthFrame, depthVal)
        return cachedDepthColorPair.depthCameraPose.multiplyPoint(pointInDeviceRef)
      }

      print("Point is outside of depth frame: " + projectedPointOnDepthFrame + " - clamping to " + normalizedPointOnDepthFrame)

      const objectPixelLocationOnDepthFrame = normalizedPointOnDepthFrame.mult(
        cachedDepthColorPair.depthDeviceCamera.resolution
      )
      const depthVal = this.getMedianDepth(
        cachedDepthColorPair.depthFrameData,
        cachedDepthColorPair.depthDeviceCamera.resolution.x,
        cachedDepthColorPair.depthDeviceCamera.resolution.y,
        Math.floor(objectPixelLocationOnDepthFrame.x),
        Math.floor(objectPixelLocationOnDepthFrame.y),
        1
      )

      if (depthVal == null) {
        print("No valid depth samples after clamping: " + normalizedPointOnDepthFrame)
        return null
      }

      const pointInDeviceRef = cachedDepthColorPair.depthDeviceCamera.unproject(normalizedPointOnDepthFrame, depthVal)
      return cachedDepthColorPair.depthCameraPose.multiplyPoint(pointInDeviceRef)
    }
    print("Invalid depth frame ID: " + depthFrameID)
    return null
  }

  disposeDepthFrame(depthFrameID: number) {
    const depthFrame = this.cachedDepthFrames.get(depthFrameID)
    if (depthFrame != null) {
      this.cachedDepthFrames.delete(depthFrameID)
    }
  }

  private getMedianDepth(
    depthData: Float32Array,
    width: number,
    height: number,
    x: number,
    y: number,
    radius: number
  ): number | null {
    //Radius = 1 → 3×3 window (9 samples)
    //Radius = 2 → 5×5 window (25 samples)
    //Radius = 3 → 7×7 window (49 samples)
    const xi = Math.round(x)
    const yi = Math.round(y)
    const samples: number[] = []

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = xi + dx
        const ny = yi + dy
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const val = depthData[nx + ny * width]
          if (val > 0) samples.push(val) // skip zeros/invalid
        }
      }
    }

    if (samples.length === 0) return null

    samples.sort((a, b) => a - b)
    const mid = Math.floor(samples.length / 2)
    return samples.length % 2 === 0 ? (samples[mid - 1] + samples[mid]) / 2 : samples[mid]
  }

  private startCameraUpdates() {
    print("DepthCache: starting camera updates")
    const camRequest = CameraModule.createCameraRequest()
    camRequest.cameraId = CameraModule.CameraId.Left_Color
    this.camTexture = this.camModule.requestCamera(camRequest)
    if (!this.camTexture) {
      print("DepthCache: failed to request left color camera texture")
      return
    }
    const camTexControl = this.camTexture.control as CameraTextureProvider
    camTexControl.onNewFrame.add((frame: CameraFrame) => {
      const colorCameraFrame = new ColorCameraFrame(this.camTexture.copyFrame(), frame.timestampSeconds)
      //save last half second of camera frames
      this.camFrameHistory.push(colorCameraFrame)
      //cam frame updates at 30hz, depth at 5hz, usually cam frame is 2-3 cam frames behind depth frame
      if (this.camFrameHistory.length > 5) {
        this.camFrameHistory.shift()
      }
    })
    this.colorDeviceCamera = global.deviceInfoSystem.getTrackingCameraForId(CameraModule.CameraId.Left_Color)
    if (!this.colorDeviceCamera) {
      print("DepthCache: failed to get left color tracking camera")
    }
  }

  private startDepthUpdate() {
    print("DepthCache: starting depth updates")
    if (!this.camTexture || !this.colorDeviceCamera) {
      print("DepthCache: cannot start depth updates because the camera stream is not ready")
      return
    }
    this.depthFrameSession = this.depthModule.createDepthFrameSession()
    if (!this.depthFrameSession) {
      print("DepthCache: failed to create depth frame session")
      return
    }
    this.depthFrameSession.onNewFrame.add((depthFrameData: DepthFrameData) => {
      const hadNoPairYet = !this.latestCameraDepthPair
      const closestFrame = this.findClosestCameraFrame(depthFrameData)
      if (closestFrame != null) {
        //Deep copy items here
        this.latestCameraDepthPair = new DepthColorPair(
          closestFrame,
          depthFrameData.depthFrame.slice(),
          depthFrameData.deviceCamera,
          depthFrameData.timestampSeconds,
          mat4.fromColumns(
            depthFrameData.toWorldTrackingOriginFromDeviceRef.column0,
            depthFrameData.toWorldTrackingOriginFromDeviceRef.column1,
            depthFrameData.toWorldTrackingOriginFromDeviceRef.column2,
            depthFrameData.toWorldTrackingOriginFromDeviceRef.column3
          )
        )
        if (hadNoPairYet) {
          print("DepthCache: paired the first depth frame successfully")
        }
      }
    })
    this.depthFrameSession.start()
  }

  private findClosestCameraFrame(depthFrame: DepthFrameData, maxOffset = 0.001): ColorCameraFrame | null {
    if (!this.camFrameHistory || this.camFrameHistory.length === 0) {
      return null
    }
    const closestColorFrame = this.camFrameHistory.reduce((closest, current) => {
      const currentDelta = Math.abs(current.colorTimestampSeconds - depthFrame.timestampSeconds)
      const closestDelta = Math.abs(closest.colorTimestampSeconds - depthFrame.timestampSeconds)
      return currentDelta < closestDelta ? current : closest
    })

    return Math.abs(closestColorFrame.colorTimestampSeconds - depthFrame.timestampSeconds) <= maxOffset
      ? closestColorFrame
      : this.camFrameHistory[this.camFrameHistory.length - 1]
  }

  private isNormalizedPointInImage(normalizedPoint: vec2) {
    return normalizedPoint.x >= 0.0 && normalizedPoint.x <= 1.0 && normalizedPoint.y >= 0.0 && normalizedPoint.y <= 1.0
  }

  private clampNormalizedPoint(normalizedPoint: vec2): vec2 {
    return new vec2(
      Math.max(0.01, Math.min(0.99, normalizedPoint.x)),
      Math.max(0.01, Math.min(0.99, normalizedPoint.y))
    )
  }
}
