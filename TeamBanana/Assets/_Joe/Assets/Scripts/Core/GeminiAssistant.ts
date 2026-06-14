import {Gemini, GeminiLiveWebsocket} from "RemoteServiceGateway.lspkg/HostedExternal/Gemini"

import {AudioProcessor} from "RemoteServiceGateway.lspkg/Helpers/AudioProcessor"
import {DynamicAudioOutput} from "RemoteServiceGateway.lspkg/Helpers/DynamicAudioOutput"
import {MicrophoneRecorder} from "RemoteServiceGateway.lspkg/Helpers/MicrophoneRecorder"
import {VideoController} from "RemoteServiceGateway.lspkg/Helpers/VideoController"
import {GeminiTypes} from "RemoteServiceGateway.lspkg/HostedExternal/GeminiTypes"
import {PinchButton} from "SpectaclesInteractionKit.lspkg/Components/UI/PinchButton/PinchButton"
import {ToggleButton} from "SpectaclesInteractionKit.lspkg/Components/UI/ToggleButton/ToggleButton"
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"

@component
export class GeminiAssistant extends BaseScriptComponent {
  @ui.separator
  @ui.label("Example of connecting to the Gemini Live API. Change various settings in the inspector to customize!")
  @ui.separator
  @ui.separator
  @ui.group_start("Setup")
  @input
  private websocketRequirementsObj!: SceneObject
  @input
  private dynamicAudioOutput!: DynamicAudioOutput
  @input
  private microphoneRecorder!: MicrophoneRecorder
  @ui.group_end
  @ui.separator
  @ui.group_start("Inputs")
  private readonly instructions: string =
    `You are an educational AI tutor. Provide clear, accurate explanations of educational concepts. Keep responses under 300 characters. Be encouraging and supportive. Always respond in English.`
  @input private haveVideoInput: boolean = true
  @ui.group_end
  @ui.separator
  @ui.group_start("Outputs")
  @ui.label(
    '<span style="color: yellow;">To prevent audio feedback loop in Lens Studio Editor, use headphones or manage your microphone input.</span>'
  )
  @input
  private haveAudioOutput: boolean = true
  @input
  @showIf("haveAudioOutput", true)
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Puck", "Puck"),
      new ComboBoxItem("Charon", "Charon"),
      new ComboBoxItem("Kore", "Kore"),
      new ComboBoxItem("Fenrir", "Fenrir"),
      new ComboBoxItem("Aoede", "Aoede"),
      new ComboBoxItem("Leda", "Leda"),
      new ComboBoxItem("Orus", "Orus"),
      new ComboBoxItem("Zephyr", "Zephyr")
    ])
  )
  private voice: string = "Puck"
  @input
  @hint("Enable verbose debug logging to the console")
  enableDebugLogging: boolean = false
  @ui.group_end
  @ui.separator
  private audioProcessor: AudioProcessor = new AudioProcessor()
  private videoController: VideoController = new VideoController(1500, CompressionQuality.HighQuality, EncodingType.Jpg)
  private GeminiLive!: GeminiLiveWebsocket

  public updateTextEvent: Event<{text: string; completed: boolean}> = new Event<{text: string; completed: boolean}>()

  public userSpeechEvent: Event<{text: string; isFinal: boolean}> = new Event<{text: string; isFinal: boolean}>()

  public functionCallEvent: Event<{
    name: string
    args: any
    callId?: string
  }> = new Event<{
    name: string
    args: any
  }>()

  public onSetupComplete: Event<void> = new Event<void>()
  private setupCompleted: boolean = false

  onAwake() {
    if (this.enableDebugLogging) print("GeminiAssistant: Assistant awakening")
    // Initialize Gemini Live session on start to ensure it's available
    this.createEvent("OnStartEvent").bind(() => {
      if (this.websocketRequirementsObj && this.dynamicAudioOutput && this.microphoneRecorder) {
        if (this.enableDebugLogging) print("GeminiAssistant: Initializing Live session with required components")
        this.createGeminiLiveSession()
      } else {
        print("GeminiAssistant: Missing required components for Live session")
        print(`  - websocketRequirementsObj: ${this.websocketRequirementsObj ? "" : ""}`)
        print(`  - dynamicAudioOutput: ${this.dynamicAudioOutput ? "" : ""}`)
        print(`  - microphoneRecorder: ${this.microphoneRecorder ? "" : ""}`)
      }
    })
  }

  createGeminiLiveSession() {
    // Prevent duplicate session creation — reuse existing connection
    if (this.GeminiLive) {
      if (this.enableDebugLogging) print("GeminiAssistant: Live session already exists, reusing existing connection")
      return
    }

    this.websocketRequirementsObj.enabled = true
    this.dynamicAudioOutput.initialize(24000)
    this.microphoneRecorder.setSampleRate(16000)

    // Display internet connection status
    let internetStatus = global.deviceInfoSystem.isInternetAvailable() ? "Websocket connected" : "No internet"

    this.updateTextEvent.invoke({text: internetStatus, completed: true})

    global.deviceInfoSystem.onInternetStatusChanged.add((args) => {
      internetStatus = args.isInternetAvailable ? "Reconnected to internete" : "No internet"

      this.updateTextEvent.invoke({text: internetStatus, completed: true})
    })

    this.GeminiLive = Gemini.liveConnect()

    this.GeminiLive.onOpen.add((event) => {
      if (this.enableDebugLogging) print("Connection opened")
      this.sessionSetup()
    })

    let completedTextDisplay = true

    this.GeminiLive.onMessage.add((message) => {
      if (this.enableDebugLogging) print("Received message: " + JSON.stringify(message))
      // Setup complete, begin sending data
      if (message.setupComplete) {
        message = message as GeminiTypes.Live.SetupCompleteEvent
        if (this.enableDebugLogging) print("Setup complete")
        this.setupCompleted = true
        this.onSetupComplete.invoke()
        this.setupInputs()
      }

      if (message?.serverContent) {
        message = message as GeminiTypes.Live.ServerContentEvent
        const sc = message.serverContent as any

        // Playback audio response (independent — can co-occur with transcriptions in 2.5)
        if (sc.modelTurn?.parts) {
          for (const part of sc.modelTurn.parts) {
            if (part.inlineData?.mimeType && part.inlineData.mimeType.startsWith("audio/pcm")) {
              const audio = Base64.decode(part.inlineData.data)
              if (this.enableDebugLogging) print(`GeminiAssistant: 🔊 Audio frame received (${part.inlineData.mimeType}, ${audio.length} bytes)`)
              this.dynamicAudioOutput.addAudioFrame(audio)
            }
            if (part.text) {
              this.updateTextEvent.invoke({text: part.text, completed: !completedTextDisplay})
              completedTextDisplay = false
            }
          }
        } else if (sc.modelTurn) {
          if (this.enableDebugLogging) print(`GeminiAssistant: modelTurn received but no parts: ${JSON.stringify(sc.modelTurn).substring(0, 100)}`)
        }

        if (sc.interrupted) {
          this.dynamicAudioOutput.interruptAudioOutput()
        }

        // User speech transcription
        if (sc.inputTranscription?.text) {
          const isFinal = sc.inputTranscription.isFinal || sc.inputTranscription.finished || false
          if (this.enableDebugLogging) print(`GeminiAssistant: 🎤 USER SAID${isFinal ? " (FINAL)" : ""}: "${sc.inputTranscription.text}"`)
          this.userSpeechEvent.invoke({text: sc.inputTranscription.text, isFinal: isFinal})
        }

        // AI output transcription
        if (sc.outputTranscription?.text) {
          this.updateTextEvent.invoke({text: sc.outputTranscription.text, completed: false})
          completedTextDisplay = false
        }

        // Turn complete — finalize pending transcription
        if (sc.turnComplete) {
          if (!completedTextDisplay) {
            this.updateTextEvent.invoke({text: "", completed: true})
          }
          completedTextDisplay = true
        }
      }

      if (message.toolCall) {
        message = message as GeminiTypes.Live.ToolCallEvent
        if (this.enableDebugLogging) print(JSON.stringify(message))
        // Handle tool calls
        message.toolCall.functionCalls?.forEach((functionCall) => {
          this.functionCallEvent.invoke({
            name: functionCall.name,
            args: functionCall.args
          })
        })
      }
    })

    this.GeminiLive.onError.add((event) => {
      print("Error: " + event)
    })

    this.GeminiLive.onClose.add((event) => {
      print("Connection closed: " + event.reason)
    })
  }

  public streamData(stream: boolean) {
    if (this.enableDebugLogging) print(`GeminiAssistant: streamData called with stream=${stream}`)

    if (stream) {
      print("🎤 Mic ON")
      this.microphoneRecorder.startRecording()

      if (this.haveVideoInput) {
        this.videoController.startRecording()
      }
    } else {
      print("🎤 Mic OFF")
      this.microphoneRecorder.stopRecording()

      if (this.haveVideoInput) {
        this.videoController.stopRecording()
      }
    }
  }

  private setupInputs() {
    this.audioProcessor.onAudioChunkReady.add((encodedAudioChunk) => {
      const message = {
        realtime_input: {
          media_chunks: [
            {
              mime_type: "audio/pcm",
              data: encodedAudioChunk
            }
          ]
        }
      } as GeminiTypes.Live.RealtimeInput
      this.GeminiLive.send(message)
    })

    // Configure the microphone
    this.microphoneRecorder.onAudioFrame.add((audioFrame) => {
      this.audioProcessor.processFrame(audioFrame)
    })

    if (this.haveVideoInput) {
      // Configure the video controller
      this.videoController.onEncodedFrame.add((encodedFrame) => {
        const message = {
          realtime_input: {
            media_chunks: [
              {
                mime_type: "image/jpeg",
                data: encodedFrame
              }
            ]
          }
        } as GeminiTypes.Live.RealtimeInput
        this.GeminiLive.send(message)
      })
    }

    this.wireMicButton()
  }

  private micActive: boolean = false
  private micToggleButton: ToggleButton | null = null

  private wireMicButton(): void {
    const obj = this.findSceneObjectByName("MicButton")
    if (!obj) { print("GeminiAssistant: MicButton not found — use streamData() to control mic"); return }
    const btn: any = (obj as any).getComponent((PinchButton as any).getTypeName())
      || (obj as any).getComponent("Button")
      || (obj as any).getComponent("Interactable")
    if (!btn) { print("GeminiAssistant: No button component on MicButton"); return }

    this.micToggleButton = (obj as any).getComponent(ToggleButton.getTypeName()) as ToggleButton | null

    if (btn.onTriggerStart && btn.onTriggerStart.add) {
      btn.onTriggerStart.add(() => {
        this.micActive = !this.micActive
        if (this.micToggleButton) this.micToggleButton.isToggledOn = this.micActive
        this.streamData(this.micActive)
      })
    } else if (btn.onButtonPinched && btn.onButtonPinched.add) {
      btn.onButtonPinched.add(() => {
        this.micActive = !this.micActive
        if (this.micToggleButton) this.micToggleButton.isToggledOn = this.micActive
        this.streamData(this.micActive)
      })
    }
    if (this.enableDebugLogging) print("GeminiAssistant: 🎤 MicButton wired for toggle")
  }

  private findSceneObjectByName(name: string): SceneObject | null {
    const count = global.scene.getRootObjectsCount()
    for (let i = 0; i < count; i++) {
      const found = this.searchByName(global.scene.getRootObject(i), name)
      if (found) return found
    }
    return null
  }

  private searchByName(obj: SceneObject, name: string): SceneObject | null {
    if (obj.name === name) return obj
    const n = obj.getChildrenCount()
    for (let i = 0; i < n; i++) {
      const found = this.searchByName(obj.getChild(i), name)
      if (found) return found
    }
    return null
  }

  public sendFunctionCallUpdate(functionName: string, args: string): void {
    const messageToSend = {
      tool_response: {
        function_responses: [
          {
            name: functionName,
            response: {content: args}
          }
        ]
      }
    } as GeminiTypes.Live.ToolResponse

    this.GeminiLive.send(messageToSend)
  }

  /**
   * Send text message directly to Gemini session for text-only generation
   * This bypasses voice streaming and sends conversation messages directly
   */
  public sendTextMessage(content: string): void {
    if (!this.GeminiLive) {
      print("GeminiAssistant: Live session not initialized")
      return
    }

    if (this.enableDebugLogging) print(`GeminiAssistant: 📝 Sending text message: "${content.substring(0, 100)}..."`)

    // Send user message to conversation
    const messageToSend = {
      client_content: {
        turns: [
          {
            role: "user",
            parts: [
              {
                text: content
              }
            ]
          }
        ],
        turn_complete: true
      }
    } as GeminiTypes.Live.ClientContent

    this.GeminiLive.send(messageToSend)

    if (this.enableDebugLogging) print("GeminiAssistant: Text message sent, waiting for AI response")
  }

  /**
   * Send image data along with text message to Gemini Live session
   */
  public sendImageMessage(imageData: string): void {
    if (!this.GeminiLive) {
      print("GeminiAssistant: Live session not initialized")
      return
    }

    if (this.enableDebugLogging) print("GeminiAssistant: Sending image data to Live session")

    // Send image data using realtime_input format
    const imageMessage = {
      realtime_input: {
        media_chunks: [
          {
            mime_type: "image/jpeg",
            data: imageData
          }
        ]
      }
    }

    this.GeminiLive.send(imageMessage)

    if (this.enableDebugLogging) print("GeminiAssistant: Image data sent to Live session")
  }

  /**
   * Returns a promise that resolves when the session setup is complete.
   * Resolves immediately if setup already completed.
   */
  public waitForSetup(): Promise<boolean> {
    if (this.setupCompleted) {
      return Promise.resolve(true)
    }
    return new Promise((resolve) => {
      this.onSetupComplete.add(() => {
        resolve(true)
      })
    })
  }

  private sessionSetup() {
    if (this.enableDebugLogging) print("GeminiAssistant: Setting up Gemini Live session...")

    let generationConfig = {
      responseModalities: ["AUDIO"],
      temperature: 1,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: this.voice
          }
        }
      }
    } as GeminiTypes.Common.GenerationConfig

    // If audio output is disabled, use text-only config
    if (!this.haveAudioOutput) {
      generationConfig = {
        responseModalities: ["TEXT"]
      }
    }

    const modelUri = `models/gemini-2.0-flash-live-preview-04-09`

    const sessionSetupMessage = {
      setup: {
        model: modelUri,
        generation_config: generationConfig,
        system_instruction: {
          parts: [
            {
              text: this.instructions
            }
          ]
        },
        contextWindowCompression: {
          triggerTokens: 20000,
          slidingWindow: {targetTokens: 16000}
        },
        output_audio_transcription: {},
        input_audio_transcription: {},
        realtime_input_config: {
          automatic_activity_detection: {
            silence_duration_ms: 500
          }
        }
      }
    } as any

    if (this.enableDebugLogging) {
      print(`GeminiAssistant: Sending session setup with model: ${modelUri}`)
      print(`GeminiAssistant: Response modalities: ${generationConfig?.responseModalities?.join(", ")}`)
      print(`GeminiAssistant: Audio output enabled: ${this.haveAudioOutput}`)
      print(`GeminiAssistant: 📹 Video input enabled: ${this.haveVideoInput}`)
    }

    this.GeminiLive.send(sessionSetupMessage)
  }

  public interruptAudioOutput(): void {
    if (this.dynamicAudioOutput && this.haveAudioOutput) {
      this.dynamicAudioOutput.interruptAudioOutput()
    } else {
      print("DynamicAudioOutput is not initialized.")
    }
  }

  /**
   * Check if Gemini Live session is available
   */
  public isLiveSessionAvailable(): boolean {
    return this.GeminiLive !== null && this.GeminiLive !== undefined
  }
}
