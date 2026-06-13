import {Detection} from "./DetectionHelpers"
import {YOLODetectionProcessor} from "./YOLODetectionProcessor"
import {EventWrapper} from "./EventModule"

/**
 * MLSpatializer — the detection entry point.
 *
 * Owns the MLComponent, runs ButterflyDetection.onnx on the camera texture every frame, decodes the
 * output into Detection boxes (via YOLODetectionProcessor), and broadcasts them through an event.
 *
 * Anything that wants detections subscribes like this:
 *   mlSpatializer.getDetectionsUpdatedEvent().add((detections) => { ... })
 * (BoundingBoxVisualizer does exactly this.)
 *
 * Self-contained: no NativeLogger, no external event module — just print() and the local EventModule.
 */
@component
export class MLSpatializer extends BaseScriptComponent {
  @input
  @hint("ButterflyDetection.onnx model asset")
  model!: MLAsset

  @input
  @hint("Input texture for the model - the Device Camera Texture")
  inputTexture!: Texture

  @input
  @hint("Score threshold (0-1). Lower = more sensitive (more, weaker detections).")
  @widget(new SliderWidget(0, 1, 0.01))
  scoreThreshold: number = 0.2

  @input
  @hint("IoU threshold for non-maximum suppression (0-1). Higher = allow more overlapping boxes.")
  @widget(new SliderWidget(0, 1, 0.01))
  iouThreshold: number = 0.5

  @input
  @hint("Class labels. MUST be a single butterfly class - the model is 1-class (18-channel output). More entries break decoding.")
  classLabels: string[] = ["Butterfly"]

  @input
  @hint("Center crop filter (0-1). 0 = keep all; higher = drop detections near the screen edges.")
  @widget(new SliderWidget(0, 1, 0.01))
  centerThreshold: number = 0

  @input
  @hint("Log detection results to the Logger panel")
  debugLogging: boolean = true

  // ML runtime objects (set once the model finishes loading).
  private mlComponent!: MLComponent
  private outputs!: OutputPlaceholder[]
  private inputs!: InputPlaceholder[]
  private yoloProcessor!: YOLODetectionProcessor

  // Fired every frame with the current Detection[].
  private onDetectionsUpdated = new EventWrapper<Detection[]>()

  private isInitialized: boolean = false
  private isRunning: boolean = false // guard so we don't re-enter onUpdate while still processing

  /** Wait for scene start, then initialize (the camera/model aren't ready in onAwake). */
  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.initialize())
  }

  /** Validate inputs, build the YOLO decoder, and kick off model loading. */
  private initialize(): void {
    if (!this.model) {
      print("[MLSpatializer] ERROR: no model asset assigned")
      return
    }
    if (!this.inputTexture) {
      print("[MLSpatializer] ERROR: no input texture assigned")
      return
    }

    this.yoloProcessor = new YOLODetectionProcessor(
      this.classLabels,
      this.scoreThreshold,
      this.iouThreshold,
      this.debugLogging
    )

    // Create the MLComponent on this object and start building it (async).
    this.mlComponent = this.getSceneObject().createComponent("MLComponent")
    this.mlComponent.model = this.model
    this.mlComponent.onLoadingFinished = () => this.onLoadingFinished()
    this.mlComponent.inferenceMode = MachineLearning.InferenceMode.Accelerator
    this.mlComponent.build([])

    if (this.debugLogging) {
      print("[MLSpatializer] Building model...")
    }
  }

  /** Called once the model is built: wire up I/O, feed the camera texture, run every frame. */
  private onLoadingFinished(): void {
    this.outputs = this.mlComponent.getOutputs()
    this.inputs = this.mlComponent.getInputs()

    this.yoloProcessor.initialize(this.outputs, this.inputs)
    this.inputs[0].texture = this.inputTexture // feed the camera into the model

    // Run the model on every Update frame, and process its output on the same frame.
    this.mlComponent.runScheduled(true, MachineLearning.FrameTiming.Update, MachineLearning.FrameTiming.Update)
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())

    this.isInitialized = true
    if (this.debugLogging) {
      print("[MLSpatializer] Model ready, running per frame.")
    }
  }

  /** Each frame: decode the latest model output, filter, and broadcast the detections. */
  private onUpdate(): void {
    if (this.isRunning || !this.isInitialized) {
      return
    }
    this.isRunning = true
    try {
      const detections = this.filterDetectionsByCenter(this.yoloProcessor.parseYolo7Outputs(this.outputs))
      this.onDetectionsUpdated.trigger(detections)
    } catch (e) {
      print("[MLSpatializer] ML processing failed: " + e)
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Optionally drop detections that are far from screen center.
   * centerThreshold 0 = keep everything. Higher = only keep butterflies near the middle of view
   * (useful to "aim" at one butterfly).
   */
  private filterDetectionsByCenter(detections: Detection[]): Detection[] {
    if (this.centerThreshold <= 0) {
      return detections
    }
    return detections.filter((detection) => {
      // distance 0 = dead center, 1 = at the edge.
      const distanceX = Math.abs(detection.bbox[0] - 0.5) * 2
      const distanceY = Math.abs(detection.bbox[1] - 0.5) * 2
      return Math.max(distanceX, distanceY) < this.centerThreshold
    })
  }

  /** Get the latest detections on demand (e.g. for a one-shot capture), without waiting for the event. */
  public getLatestDetections(): Detection[] {
    if (!this.yoloProcessor || !this.outputs) {
      return []
    }
    try {
      return this.filterDetectionsByCenter(this.yoloProcessor.parseYolo7Outputs(this.outputs))
    } catch (e) {
      return []
    }
  }

  /** Subscribe here to receive Detection[] every frame: getDetectionsUpdatedEvent().add(cb). */
  public getDetectionsUpdatedEvent(): EventWrapper<Detection[]> {
    return this.onDetectionsUpdated
  }
}
