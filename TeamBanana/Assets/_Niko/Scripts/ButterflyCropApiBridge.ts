import NativeLogger from "SpectaclesInteractionKit.lspkg/Utils/NativeLogger"
import {Detection} from "./DetectionHelpers"
import {MLSpatializer} from "./MLSpatializer"

const Events = require("../../Multi-Object Detection [Modified]/Scripts/Modules/EventModule")
const log = new NativeLogger("ButterflyCropApiBridge")

export type ButterflyCropPayload = {
  id: string
  detectionIndex: number
  label: string
  score: number
  bbox: number[]
  imageBase64: string
  mimeType: string
  capturedAtSeconds: number
}

type CropJob = {
  detection: Detection
  detectionIndex: number
  sourceFrame: Texture
  cropTexture: Texture
  payloads: ButterflyCropPayload[]
}

/**
 * Converts 2D detections from MLSpatializer into cropped, Base64 encoded camera images.
 * Attach this to a SceneObject, assign the same camera texture used by best.onnx, and
 * assign up to three Screen Crop Texture assets for concurrent butterfly crops.
 */
@component
export class ButterflyCropApiBridge extends BaseScriptComponent {
  @input
  @hint("MLSpatializer component that emits best.onnx detections")
  mlSpatializer!: MLSpatializer

  @input
  @hint("Camera/input texture aligned with the ML model input")
  sourceTexture!: Texture

  @input
  @hint("Screen Crop Texture assets used to crop detections. Assign 3 for up to 3 simultaneous butterflies.")
  cropTextures: Texture[] = []

  @input
  @hint("Maximum butterfly crops to produce per capture batch")
  @widget(new SliderWidget(1, 3, 1))
  maxCropsPerBatch: number = 3

  @input
  @hint("Extra padding around each detection crop, as a fraction of box size")
  @widget(new SliderWidget(0, 1, 0.05))
  cropPadding: number = 0.15

  @input
  @hint("Minimum seconds between crop batches")
  @widget(new SliderWidget(0.1, 10, 0.1))
  captureIntervalSeconds: number = 2.0

  @input
  @hint("Encode crops as JPG instead of PNG for smaller API payloads")
  encodeJpg: boolean = true

  @input
  @hint("Enable crop encoding and callback dispatch. Disable to keep the component dormant.")
  enabledCapture: boolean = true

  @input
  @hint("Master toggle for crop processing. Disable this when you only want detections without crop generation.")
  enableCropProcessing: boolean = true

  @input
  @hint("Optional scripts to notify when crops are ready")
  payloadCallbacks: any[] = []

  @input
  @hint("Function names on callback scripts. Each function receives ButterflyCropPayload[]")
  payloadCallbackFunctions: string[] = []

  @input
  @hint("Optional authorized Remote Service asset for sending crops to an API")
  remoteServiceModule: RemoteServiceModule | null = null

  @input
  @hint("Authorized Remote Service endpoint name. Leave empty until the butterfly ID API is configured.")
  remoteEndpoint: string = ""

  @input
  @hint("Send crop payloads through RemoteServiceModule when remoteServiceModule and remoteEndpoint are set")
  sendToRemoteWhenConfigured: boolean = false

  @input
  @hint("Log crop activity")
  debugLogging: boolean = false

  private readonly onCropPayloadsReady = new Events.EventWrapper()
  private detectionCallback: ((detections: Detection[]) => void) | null = null
  private lastCaptureTime: number = -9999
  private isEncoding: boolean = false

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.initialize())
  }

  private initialize(): void {
    if (!this.mlSpatializer) {
      this.logMessage("Missing MLSpatializer input")
      return
    }

    const detectionEvent = this.mlSpatializer.getDetectionsUpdatedEvent()
    if (!detectionEvent || !detectionEvent.add) {
      this.logMessage("MLSpatializer does not expose a detection update event")
      return
    }

    this.detectionCallback = (detections: Detection[]) => this.onDetectionsUpdated(detections)
    detectionEvent.add(this.detectionCallback)
    this.logMessage("Subscribed to ML detections")
  }

  private onDetectionsUpdated(detections: Detection[]): void {
    if (!this.enabledCapture || !this.enableCropProcessing || this.isEncoding || !detections || detections.length === 0) {
      return
    }

    const now = getTime()
    if (now - this.lastCaptureTime < this.captureIntervalSeconds) {
      return
    }

    if (!this.sourceTexture) {
      this.logMessage("Missing sourceTexture input")
      return
    }

    const usableCropTextures = this.getUsableCropTextures()
    if (usableCropTextures.length === 0) {
      this.logMessage("Assign at least one Screen Crop Texture")
      return
    }

    const cropCount = Math.min(this.maxCropsPerBatch, 3, detections.length)
    const sourceFrame = this.sourceTexture.copyFrame()
    const jobs: CropJob[] = []

    for (let i = 0; i < cropCount; i++) {
      jobs.push({
        detection: detections[i],
        detectionIndex: i,
        sourceFrame: sourceFrame,
        cropTexture: usableCropTextures[i % usableCropTextures.length],
        payloads: []
      })
    }

    this.lastCaptureTime = now
    this.isEncoding = true
    this.runJobs(jobs, usableCropTextures.length)
  }

  private getUsableCropTextures(): Texture[] {
    const result: Texture[] = []
    for (let i = 0; i < this.cropTextures.length; i++) {
      const texture = this.cropTextures[i]
      if (texture && texture.control) {
        result.push(texture)
      }
    }
    return result
  }

  private runJobs(jobs: CropJob[], parallelCount: number): void {
    const payloads: ButterflyCropPayload[] = []
    const queue = jobs.slice()
    let activeCount = 0

    const startNext = () => {
      while (activeCount < parallelCount && queue.length > 0) {
        const job = queue.shift()!
        job.payloads = payloads
        activeCount++
        this.encodeJob(job, () => {
          activeCount--
          if (queue.length > 0) {
            startNext()
          } else if (activeCount === 0) {
            this.isEncoding = false
            this.dispatchPayloads(payloads)
          }
        })
      }
    }

    startNext()
  }

  private encodeJob(job: CropJob, onDone: () => void): void {
    const cropProvider = job.cropTexture.control as RectCropTextureProvider
    cropProvider.inputTexture = job.sourceFrame
    cropProvider.cropRect = this.detectionToCropRect(job.detection)
    cropProvider.rotation = 0

    Base64.encodeTextureAsync(
      job.cropTexture,
      (encodedTexture: string) => {
        job.payloads.push(this.createPayload(job, encodedTexture))
        onDone()
      },
      () => {
        this.logMessage("Failed to encode crop for detection " + job.detectionIndex)
        onDone()
      },
      this.encodeJpg ? CompressionQuality.HighQuality : CompressionQuality.MaximumQuality,
      this.encodeJpg ? EncodingType.Jpg : EncodingType.Png
    )
  }

  private detectionToCropRect(detection: Detection): Rect {
    const bbox = detection.bbox
    const paddedWidth = bbox[2] * (1 + this.cropPadding * 2)
    const paddedHeight = bbox[3] * (1 + this.cropPadding * 2)
    const centerX = bbox[0] * 2 - 1
    const centerY = 1 - bbox[1] * 2

    const left = this.clamp(centerX - paddedWidth, -1, 1)
    const right = this.clamp(centerX + paddedWidth, -1, 1)
    const bottom = this.clamp(centerY - paddedHeight, -1, 1)
    const top = this.clamp(centerY + paddedHeight, -1, 1)

    return Rect.create(left, right, bottom, top)
  }

  private createPayload(job: CropJob, imageBase64: string): ButterflyCropPayload {
    const detection = job.detection
    return {
      id: "butterfly_" + Math.floor(getTime() * 1000) + "_" + job.detectionIndex,
      detectionIndex: job.detectionIndex,
      label: detection.label,
      score: detection.score,
      bbox: [detection.bbox[0], detection.bbox[1], detection.bbox[2], detection.bbox[3]],
      imageBase64: imageBase64,
      mimeType: this.encodeJpg ? "image/jpeg" : "image/png",
      capturedAtSeconds: getTime()
    }
  }

  private dispatchPayloads(payloads: ButterflyCropPayload[]): void {
    if (payloads.length === 0) {
      return
    }

    this.logMessage("Prepared " + payloads.length + " butterfly crop payload(s)")
    this.onCropPayloadsReady.trigger(payloads)
    this.sendPayloadsToRemote(payloads)

    for (let i = 0; i < this.payloadCallbacks.length; i++) {
      const target = this.payloadCallbacks[i]
      const functionName = this.payloadCallbackFunctions[i]
      if (target && functionName && typeof target[functionName] === "function") {
        try {
          target[functionName](payloads)
        } catch (e) {
          log.e("Payload callback failed: " + e)
        }
      }
    }
  }

  private sendPayloadsToRemote(payloads: ButterflyCropPayload[]): void {
    if (!this.sendToRemoteWhenConfigured) {
      return
    }

    if (!this.remoteServiceModule || !this.remoteEndpoint) {
      this.logMessage("Remote send enabled but remoteServiceModule or remoteEndpoint is missing")
      return
    }

    const request = RemoteApiRequest.create()
    request.endpoint = this.remoteEndpoint
    request.parameters = {}
    request.body = JSON.stringify({
      crops: payloads
    })

    this.remoteServiceModule.performApiRequest(request, (response: RemoteApiResponse) => {
      this.logMessage("Remote API response: " + response.body)
    })
  }

  public getCropPayloadsReadyEvent(): any {
    return this.onCropPayloadsReady
  }

  public getLatestDetectionsAsCropPayloads(): void {
    if (!this.mlSpatializer) {
      this.logMessage("Missing MLSpatializer input")
      return
    }

    if (!this.enableCropProcessing || !this.enabledCapture) {
      this.logMessage("Crop processing is disabled")
      return
    }

    this.onDetectionsUpdated(this.mlSpatializer.getLatestDetections())
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }

  private logMessage(message: string): void {
    if (this.debugLogging) {
      print("ButterflyCropApiBridge: " + message)
    }
  }

  onDestroy(): void {
    if (this.mlSpatializer && this.detectionCallback) {
      const detectionEvent = this.mlSpatializer.getDetectionsUpdatedEvent()
      if (detectionEvent && detectionEvent.remove) {
        detectionEvent.remove(this.detectionCallback)
      }
    }
  }
}
