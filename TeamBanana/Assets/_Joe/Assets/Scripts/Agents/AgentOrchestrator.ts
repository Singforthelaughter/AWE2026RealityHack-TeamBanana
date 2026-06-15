import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {setTimeout, clearTimeout} from "SpectaclesInteractionKit.lspkg/Utils/FunctionTimingUtils"
import {ChatComponent} from "../Components/ChatComponent"
import {GeminiAssistant} from "../Core/GeminiAssistant"
import {OpenAIAssistant} from "../Core/OpenAIAssistant"
import {StorageManager} from "../Storage/StorageManager"
import {AgentLanguageInterface} from "./AgentLanguageInterface"
import {AgentMemorySystem} from "./AgentMemorySystem"
import {ChatMessage, SystemState} from "./AgentTypes"
import {AgentRouter} from "./AgentRouter"
import {AgentCoordinator} from "./AgentCoordinator"
import {ButterflyIdentifier} from "_Aggy/Scripts/ButterflyIdentifier"
import {SupabaseDBManager} from "_Boon/SupabaseInfoStoring&Retrieving/Scripts/SupabaseDBManager"
import {NearbySightingManager} from "_Boon/NearbySighting/Scripts/NearbySightingManager"
import {FlyingButterflyManager} from "_Boon/ButterflyMovement/Scripts/FlyingButterflyManager"
import {MLSpatializer} from "_Aggy/Scripts/MLSpatializer"


/**
 * AgentOrchestrator - Central coordinator for butterfly outdoor education system
 *
 * Enhanced to support two-agent collaborative dialogue:
 * - NaturalistAgent: Gentle Socratic discovery guide
 * - ArchivistAgent: Enthusiastic storyteller and knowledge curator
 *
 * Architecture Flow:
 * User Query → AgentOrchestrator → AgentRouter → Selected Agent
 *                                    ↓
 *                         AgentCoordinator ←→ (Coordination Requests)
 *                                    ↓
 *                         Other Agent Contribution
 *                                    ↓
 *                         Combined Response → User
 */
@component
export class AgentOrchestrator extends BaseScriptComponent {
  // ================================
  // Component References
  // ================================

  @input
  @hint("OpenAI Assistant component for language model integration")
  openAIAssistant: OpenAIAssistant | null = null

  @input
  @hint("Gemini Assistant component for language model integration")
  geminiAssistant: GeminiAssistant | null = null

  @input
  @hint("Chat Layout component for chat integration")
  chatComponent: ChatComponent | null = null

  @input
  @hint("Storage Manager for centralized storage control")
  storageManager: StorageManager | null = null

  @input
  @hint("Text display component for agent usage information")
  toolDisplayText: Text = null!

  @input
  @hint("Text display component for current agent indicator")
  agentDisplayText: Text = null!

  @input
  @hint("SupabaseDBManager — enables nearby sightings tool for agents")
  dbManager: SupabaseDBManager | null = null

  @input
  @hint("NearbySightingManager — triggers AR map display when nearby sightings are queried")
  nearbySightingManager: NearbySightingManager | null = null

  @input
  @hint("ButterflyIdentifier — enables butterfly species identification tool for agents")
  butterflyIdentifier: ButterflyIdentifier | null = null

  @input
  @hint("MLSpatializer — enables on-device YOLO butterfly detection tool for agents")
  mlSpatializer: MLSpatializer | null = null

  @input
  @hint("FlyingButterflyManager — spawns 3D animated butterflies for the collection")
  flyingButterflyManager: FlyingButterflyManager | null = null

  // ================================
  // Configuration
  // ================================

  @ui.group_start("System Configuration")
  @input
  enableSystem: boolean = true
  @input
  @hint("Enable butterfly agent system vs. legacy tool router")
  enableAgentSystem: boolean = true
  @input
  enableDebugLogging: boolean = true
  @ui.group_end

  @ui.group_start("Agent Configuration")
  @input
  conversationContextMessages: number = 10
  @input
  defaultAgent: string = "naturalist" // Start with discovery focus
  @input
  enableCoordination: boolean = true
  @input
  coordinationDepthLimit: number = 3
  @ui.group_end

  @ui.group_start("AI Provider Configuration")
  @input
  @widget(new ComboBoxWidget([new ComboBoxItem("openai", "OpenAI"), new ComboBoxItem("gemini", "Gemini")]))
  defaultProvider: string = "openai"
  @input
  enableVoiceOutput: boolean = true
  @ui.group_end

  // ================================
  // Core System Components
  // ================================
  private languageInterface: AgentLanguageInterface | null = null
  private memorySystem: AgentMemorySystem | null = null

  // New Agent System Components
  private agentRouter: AgentRouter | null = null
  private agentCoordinator: AgentCoordinator | null = null

  // ================================
  // State Management
  // ================================

  private systemState: SystemState | null = null
  private isProcessingQuery: boolean = false
  private currentSessionId: string = ""
  private initialized: boolean = false

  // Voice completion tracking
  private currentQuery: string = ""
  private currentResponse: string = ""
  private accumulatedTranscription: string = ""
  private transcriptionSilenceTimer: any = null
  private lastTranscriptionTime: number = 0
  private suppressNextAutoResponse: boolean = false

  // Agent UI state
  private currentAgentColor: string = "#4CAF50" // Default: Naturalist green
  private currentAgentTone: string = "gentle"

  // ================================
  // Events
  // ================================

  public onQueryReceived: Event<string> = new Event()
  public onQueryProcessed: Event<{
    query: string
    response: string
    agent: string
  }> = new Event()
  public onVoiceCompleted: Event<{
    query: string
    response: string
  }> = new Event()
  public onAgentChanged: Event<{
    agent: string
    color: string
    reason: string
  }> = new Event()
  public onCoordinationStarted: Event<{
    fromAgent: string
    toAgent: string
  }> = new Event()
  public onCoordinationCompleted: Event<{
    fromAgent: string
    toAgent: string
    response: string
  }> = new Event()
  public onSystemStateChanged: Event<SystemState> = new Event()
  public onError: Event<string> = new Event()
  public onSystemReset: Event<void> = new Event()

  // Agent color configuration
  private readonly AGENT_COLORS = {
    naturalist: "#4CAF50", // Green for discovery
    archivist: "#FF5722" // Orange for knowledge
  }

  // ================================
  // Lifecycle Methods
  // ================================

  onAwake() {
    if (this.enableDebugLogging) {
      print("AgentOrchestrator: Butterfly outdoor education orchestrator awakening")
    }

    this.enableVoiceOutput = true
    print("AgentOrchestrator: Voice output explicitly enabled at startup")

    this.createEvent("OnStartEvent").bind(this.initialize)
  }

  // ================================
  // Initialization
  // ================================

  private initialize = (): void => {
    if (!this.enableSystem) {
      print("AgentOrchestrator: System disabled, skipping initialization")
      return
    }

    try {
      this.initializeComponents()
      this.setupConnections()
      this.initializeSystemState()
      this.initialized = true

      if (this.enableDebugLogging) {
        print("AgentOrchestrator: Butterfly system initialized successfully")
        print(`AgentOrchestrator: Agent system enabled: ${this.enableAgentSystem}`)
        print(`AgentOrchestrator: Default agent: ${this.defaultAgent}`)
      }
    } catch (error) {
      this.handleError(`Initialization failed: ${error}`)
    }
  }

  private initializeComponents(): void {
    // Validate AI assistants
    if (!this.openAIAssistant && !this.geminiAssistant) {
      throw new Error("No AI assistants configured. Please assign either OpenAI or Gemini assistant in inspector.")
    }

    if (this.enableDebugLogging) {
      print(
        `AgentOrchestrator: 🔍 Available assistants - OpenAI: ${this.openAIAssistant ? "available" : "not assigned"}, Gemini: ${this.geminiAssistant ? "available" : "not assigned"}`
      )
    }

    // Initialize language interface
    if (!this.languageInterface) {
      try {
        this.languageInterface = new AgentLanguageInterface(this.openAIAssistant ?? undefined, this.geminiAssistant ?? undefined)
        this.languageInterface.setDefaultProvider(this.defaultProvider as "openai" | "gemini")
        this.languageInterface.enableDebugLogging = this.enableDebugLogging
        if (this.enableDebugLogging) print("AgentOrchestrator: Language interface created successfully")
      } catch (error) {
        print(`AgentOrchestrator: Language interface initialization failed: ${error}`)
        throw new Error(`Language interface initialization failed: ${error}`)
      }
    }

    // Initialize memory system
    if (!this.memorySystem) {
      this.memorySystem = new AgentMemorySystem()
    }

    // Initialize agent system if enabled
    if (this.enableAgentSystem && this.languageInterface) {
      this.initializeAgentSystem()
    }

    if (this.enableDebugLogging) {
      print("AgentOrchestrator: Core components initialized")
    }
  }

  private initializeAgentSystem(): void {
    if (!this.languageInterface) {
      throw new Error("Language interface must be initialized before agent system")
    }

    try {
      // DEBUG: Log which dependencies are wired for agent tool registration
      print(`AgentOrchestrator: 🔧 Agent dependencies — dbManager: ${this.dbManager ? "YES" : "MISSING"}, mlSpatializer: ${this.mlSpatializer ? "YES" : "MISSING"}, butterflyIdentifier: ${this.butterflyIdentifier ? "YES" : "MISSING"}, flyingButterflyManager: ${this.flyingButterflyManager ? "YES" : "MISSING"}`)

      // Initialize agent router
      this.agentRouter = new AgentRouter(this.languageInterface, {
        fallbackAgent: this.defaultAgent,
        enableCoordination: this.enableCoordination,
        debugRouting: this.enableDebugLogging
      }, this.dbManager ?? undefined, this.nearbySightingManager ?? undefined, this.butterflyIdentifier ?? undefined, this.mlSpatializer ?? undefined, this.flyingButterflyManager ?? undefined)

      // Initialize agent coordinator
      this.agentCoordinator = new AgentCoordinator(this.agentRouter, {
        maxCoordinationDepth: this.coordinationDepthLimit,
        enableSpeakerAnnouncements: true,
        dialogueTimeout: 5000
      })

      // Wire tool display callback to each agent so tool usage appears on UI
      const toolDisplayCb = (toolName: string, args: Record<string, unknown>) => {
        if (this.toolDisplayText) {
          this.toolDisplayText.text = `${toolName}(${JSON.stringify(args)})`
        }
        if (this.enableDebugLogging) {
          print(`AgentOrchestrator: 🛠️ Tool used: ${toolName}`)
        }
      }
      for (const agent of this.agentRouter.getAllAgents()) {
        agent.setToolDisplayCallback(toolDisplayCb)
      }

      print("AgentOrchestrator: 🦋 Agent system initialized")
      print(`AgentOrchestrator: Registered agents: ${this.agentRouter?.getAllAgents().length}`)
    } catch (error) {
      print(`AgentOrchestrator: Agent system initialization failed: ${error}`)
      throw error
    }
  }

  private setupConnections(): void {
    // Setup language interface events
    if (this.languageInterface) {
      this.languageInterface.onTextUpdate.add((data) => {
        this.handleTextUpdate(data)
      })

      this.languageInterface.onError.add((data) => {
        this.handleError(`LLM Error (${data.provider}): ${data.error}`)
      })
    }

    // Setup Gemini Live user speech → chat cards
    if (this.geminiAssistant) {
      this.geminiAssistant.userSpeechEvent.add((data) => {
        this.handleUserSpeech(data)
      })
    }

    // Setup agent router events
    if (this.agentRouter) {
      this.agentRouter.onRoutingDecision.add((decision) => {
        this.handleRoutingDecision(decision)
      })
    }

    // Setup agent coordinator events
    if (this.agentCoordinator) {
      this.agentCoordinator.onCoordinationRequested.add((data) => {
        this.handleCoordinationRequest(data)
      })

      this.agentCoordinator.onSpeakerChanged.add((data) => {
        this.handleSpeakerChange(data)
      })

      this.agentCoordinator.onDialogueStateChanged.add((state) => {
        this.handleDialogueStateChange(state)
      })
    }

    if (this.enableDebugLogging) {
      print("AgentOrchestrator: Component connections established")
    }
  }

  private initializeSystemState(): void {
    this.currentSessionId = `session_${Date.now()}`

    this.systemState = {
      currentStep: "idle",
      chatHistory: [],
      sessionId: this.currentSessionId,
      timestamp: Date.now()
    }

    if (this.enableDebugLogging) {
      print(`AgentOrchestrator: 📋 System state initialized (Session: ${this.currentSessionId})`)
    }
  }

  // ================================
  // Public API - Main Query Processing
  // ================================

  /**
   * Main entry point for processing user queries
   * Routes to agent system if enabled, otherwise uses legacy behavior
   */
  public async processUserQuery(query: string, context?: any): Promise<string> {
    if (!this.initialized || !this.enableSystem) {
      const error = "System not initialized or disabled"
      this.handleError(error)
      return error
    }

    if (this.isProcessingQuery) {
      if (this.enableDebugLogging) {
        print("AgentOrchestrator: ⏳ Already processing a query, queuing...")
      }
      return "System busy, please wait..."
    }

    this.isProcessingQuery = true
    this.onQueryReceived.invoke(query)

    // Reset voice transcription tracking
    this.currentQuery = query
    this.currentResponse = ""
    this.accumulatedTranscription = ""
    this.voiceTranscriptionCompleted = false

    // Clear pending transcription timer
    if (this.transcriptionSilenceTimer) {
      clearTimeout(this.transcriptionSilenceTimer)
      this.transcriptionSilenceTimer = null
    }

    try {
      if (this.enableDebugLogging) {
        print(`AgentOrchestrator: 📥 Processing query: "${query.substring(0, 100)}..."`)
      }

      // Update system state
      this.systemState!.currentStep = "chat"
      this.systemState!.timestamp = Date.now()

      let response: string

      // Route to agent system if enabled
      if (this.enableAgentSystem && this.agentRouter) {
        print(`AgentOrchestrator: 🤖 Routing to agent system — agentRouter present, enableAgentSystem=${this.enableAgentSystem}`)
        response = await this.processWithAgentSystem(query, context)
      } else {
        // Fallback to legacy processing if agent system disabled
        print(`AgentOrchestrator: ⚠️ Agent system DISABLED — enableAgentSystem=${this.enableAgentSystem}, agentRouter=${this.agentRouter ? "present" : "NULL"}`)
        response = await this.processLegacy(query, context)
      }

      // Handle voice mode
      let isVoicePlaceholder = false
      if (response === "[Voice response - transcription pending]" && this.enableVoiceOutput) {
        isVoicePlaceholder = true
        response = "" // Empty for voice mode
      }

      // Store conversation
      if (!isVoicePlaceholder) {
        this.storeConversation(query, response)
      } else {
        // Store only user query for voice mode
        this.storeUserQueryOnly(query)
      }

      // Fire completion event
      this.onQueryProcessed.invoke({
        query: query,
        response: response,
        agent: this.currentAgentTone
      })

      // Agent has finished — but keep suppression alive briefly so the agent's
      // Gemini response can start streaming before auto-VAD gets a chance to fire.
      // Without this delay, Gemini's auto-VAD races ahead and overrides the agent.
      setTimeout(() => {
        this.suppressNextAutoResponse = false
        if (this.geminiAssistant) {
          this.geminiAssistant.setMuteAudio(false)
        }
      }, 500)

      if (this.enableDebugLogging) {
        print(`AgentOrchestrator: Query processed successfully`)
      }

      return response
    } catch (error) {
      setTimeout(() => {
        this.suppressNextAutoResponse = false
        if (this.geminiAssistant) {
          this.geminiAssistant.setMuteAudio(false)
        }
      }, 500)
      print(`AgentOrchestrator: ERROR — ${error}`)
      const errorMessage = `Query processing failed: ${error}`
      this.handleError(errorMessage)
      return errorMessage
    } finally {
      this.isProcessingQuery = false

      // Delay clearing current conversation — must outlast full voice response cycle
      // (audio playback ~5-10s + 2s silence timer + 1s completion timer)
      setTimeout(() => {
        this.currentQuery = ""
        this.currentResponse = ""

        if (this.accumulatedTranscription.length > 0) {
          print(
            `AgentOrchestrator: Clearing unused transcription: "${this.accumulatedTranscription.substring(0, 50)}..."`
          )
          this.accumulatedTranscription = ""
          this.voiceTranscriptionCompleted = false
        }
      }, 20000)
    }
  }

  /**
   * Process query using new agent system
   */
  private async processWithAgentSystem(query: string, context?: any): Promise<string> {
    if (!this.agentRouter || !this.agentCoordinator) {
      throw new Error("Agent system not initialized")
    }

    try {
      // Route query to appropriate agent
      const routingDecision = await this.agentRouter.routeQuery(query, this.getConversationContext())

      // Update agent display
      this.updateAgentDisplay(routingDecision.selectedAgent)

      // Get selected agent
      const selectedAgent = this.agentRouter.getAgent(routingDecision.selectedAgent)
      if (!selectedAgent) {
        throw new Error(`Selected agent '${routingDecision.selectedAgent}' not found`)
      }

      // Execute agent
      const args = {
        query: query,
        context: this.getConversationContext(),
        maxLength: 300,
        isCoordination: false
      }

      const agentResponse = await selectedAgent.execute(args)

      if (!agentResponse.success) {
        throw new Error(agentResponse.message)
      }

      let responseText = agentResponse.message

      // Handle coordination requests
      if (agentResponse.requiresCoordination && this.enableCoordination) {
        const coordinationResponse = await this.handleAgentCoordination(
          agentResponse.requiresCoordination,
          selectedAgent.name
        )

        if (coordinationResponse) {
          // Combine primary response with coordination
          responseText = this.combineResponses(responseText, coordinationResponse)
        }
      }

      return responseText
    } catch (error) {
      print(`AgentOrchestrator: Agent system processing failed: ${error}`)
      throw error
    }
  }

  /**
   * Handle agent coordination
   */
  private async handleAgentCoordination(
    request: {
      targetAgent: string
      context: string
      priority: number
    },
    requestingAgent: string
  ): Promise<string | null> {
    if (!this.agentCoordinator) return null

    try {
      // Queue coordination request
      this.agentCoordinator.queueCoordination(
        requestingAgent,
        request.targetAgent,
        request.context,
        request.priority
      )

      // Wait for coordination completion (with timeout)
      const coordinationTimeout = 8000 // 8 seconds for coordination

      // In a real implementation, we'd wait for the coordination event
      // For now, we'll return null and let the coordinator handle it asynchronously
      return null
    } catch (error) {
      print(`AgentOrchestrator: Coordination handling failed: ${error}`)
      return null
    }
  }

  /**
   * Combine primary and coordination responses
   */
  private combineResponses(primary: string, coordination: string): string {
    // Simple concatenation with separator
    // In a more sophisticated implementation, we might:
    // - Remove duplicates
    // - Merge related topics
    // - Ensure consistent tone
    // - Add transition phrases

    const combined = `${primary} ${coordination}`

    // Trim to character limit
    return combined.length > 300 ? combined.substring(0, 300) + "..." : combined
  }

  /**
   * Legacy processing fallback (for when agent system is disabled)
   */
  private async processLegacy(query: string, context?: any): Promise<string> {
    // This would implement the original tool router logic
    // For now, return a simple response
    return "Legacy processing is not implemented. Please enable agent system."
  }

  // ================================
  // Event Handlers
  // ================================

  /**
   * Handle LLM text updates
   */
  private handleTextUpdate(data: {text: string; completed: boolean; provider: string}): void {
    if (this.enableDebugLogging) {
      print(
        `AgentOrchestrator: 📝 LLM text update - completed: ${data.completed}, text: "${data.text?.substring(0, 50)}..."`
      )
    }

    // Accumulate transcription when voice is enabled
    if (this.enableVoiceOutput && data.text && data.text.length > 0) {
      const isSystemMessage =
        data.text.includes("Websocket connected") ||
        data.text.includes("Session initialized") ||
        data.text.toLowerCase().includes("websocket")

      // Skip Gemini's auto-response — agent system will provide the real response.
      // Don't reset the flag here — it gets cleared when the agent finishes in processUserQuery.
      if (this.suppressNextAutoResponse) {
        this.accumulatedTranscription = "" // discard any partial text already gathered
        return
      }

      if (!isSystemMessage) {
        // Accumulate text
        if (
          this.accumulatedTranscription.length > 0 &&
          !this.accumulatedTranscription.endsWith(" ") &&
          !data.text.startsWith(" ")
        ) {
          this.accumulatedTranscription += " "
        }
        this.accumulatedTranscription += data.text
        this.lastTranscriptionTime = Date.now()

        // Reset silence timer
        if (this.transcriptionSilenceTimer) {
          clearTimeout(this.transcriptionSilenceTimer)
        }

        this.transcriptionSilenceTimer = setTimeout(() => {
          if (this.accumulatedTranscription.length > 0) {
            const finalTranscription = this.accumulatedTranscription.trim()
            this.completeVoiceTranscription(finalTranscription)
          }
        }, 2000) // 2 seconds of silence
      }
    }

    // Check for completion signals
    if (data.completed && this.enableVoiceOutput && this.accumulatedTranscription.length > 0) {
      setTimeout(() => {
        if (this.accumulatedTranscription.length > 0) {
          const finalTranscription = this.accumulatedTranscription.trim()
          this.completeVoiceTranscription(finalTranscription)
        }

        if (this.transcriptionSilenceTimer) {
          clearTimeout(this.transcriptionSilenceTimer)
          this.transcriptionSilenceTimer = null
        }
      }, 1000)
    }
  }

  /**
   * Handle user speech transcription from Gemini Live.
   * On final transcript: route through the agent system (naturalist/archivist)
   * so the response uses the selected agent's persona.
   */
  private handleUserSpeech(data: {text: string; isFinal: boolean}): void {
    if (!data.text?.trim()) return
    if (!data.isFinal) {
      print(`AgentOrchestrator: 🎤 User speaking: "${data.text.substring(0, 50)}..."`)
      return
    }
    const query = data.text.trim()
    print(`AgentOrchestrator: 🎤 User speech FINAL: "${query}" — routing to agent system`)

    // Interrupt Gemini's VAD auto-response immediately. The agent system will
    // generate a richer response (potentially with tool context) instead.
    this.suppressNextAutoResponse = true
    if (this.geminiAssistant) {
      this.geminiAssistant.setMuteAudio(true)
      this.geminiAssistant.interruptAudioOutput()
    }
    if (this.openAIAssistant) {
      this.openAIAssistant.interruptAudioOutput()
    }

    // Route through agent system for naturalist/archivist persona
    this.processUserQuery(query)
  }

  /**
   * Complete voice transcription
   */
  private voiceTranscriptionCompleted: boolean = false

  private completeVoiceTranscription(transcription: string): void {
    // Prevent duplicate calls from overlapping silence/completion timers
    if (this.voiceTranscriptionCompleted || !transcription) return
    this.voiceTranscriptionCompleted = true

    if (this.enableDebugLogging) {
      print(`AgentOrchestrator: 🔇 Transcription completed: "${transcription.substring(0, 50)}..."`)
    }

    // Clear accumulated text so next response starts fresh
    this.accumulatedTranscription = ""

    // Store bot message
    const botMessage: ChatMessage = {
      id: `msg_${Date.now()}_bot`,
      type: "bot",
      content: transcription,
      timestamp: Date.now(),
      cardIndex: -1,
      relatedTools: ["agent_system"]
    }

    // Store in memory
    if (this.memorySystem) {
      this.memorySystem.addChatMessage(botMessage)
      this.systemState!.chatHistory = this.memorySystem.getChatHistory()
      this.onSystemStateChanged.invoke(this.systemState!)
    }

    // Store in storage
    if (this.storageManager) {
      const chatStorage = this.storageManager.getChatStorage()
      if (chatStorage) {
        chatStorage.addMessage({
          id: botMessage.id,
          type: botMessage.type,
          content: botMessage.content,
          timestamp: botMessage.timestamp,
          cardIndex: botMessage.cardIndex,
          relatedTools: botMessage.relatedTools
        })
      }
    }

    // Fire voice completion event
    this.onVoiceCompleted.invoke({
      query: this.currentQuery,
      response: transcription
    })
  }

  /**
   * Handle routing decisions
   */
  private handleRoutingDecision(decision: {
    selectedAgent: string
    confidence: number
    reasoning: string
  }): void {
    if (this.enableDebugLogging) {
      print(`AgentOrchestrator: 🎯 Routing to: ${decision.selectedAgent} (confidence: ${decision.confidence.toFixed(2)})`)
    }

    // Update agent display
    this.updateAgentDisplay(decision.selectedAgent)
  }

  /**
   * Handle coordination requests
   */
  private handleCoordinationRequest(data: {
    from: string
    to: string
    context: string
  }): void {
    if (this.enableDebugLogging) {
      print(`AgentOrchestrator: 🤝 Coordination: ${data.from} → ${data.to}`)
    }

    // Update agent display to show coordination
    this.updateAgentDisplay(data.to)

    // Fire coordination started event
    this.onCoordinationStarted.invoke({
      fromAgent: data.from,
      toAgent: data.to
    })
  }

  /**
   * Handle speaker changes
   */
  private handleSpeakerChange(data: {from: string; to: string; reason: string}): void {
    if (this.enableDebugLogging) {
      print(`AgentOrchestrator: 🔄 Speaker change: ${data.from} → ${data.to}`)
    }

    // Update agent display
    this.updateAgentDisplay(data.to)

    // Fire agent changed event
    this.onAgentChanged.invoke({
      agent: data.to,
      color: this.getAgentColor(data.to),
      reason: data.reason
    })
  }

  /**
   * Handle dialogue state changes
   */
  private handleDialogueStateChange(state: {
    currentSpeaker: string
    lastSpoken: string | null
    coordinationCount: number
    dialogueDepth: number
  }): void {
    if (this.enableDebugLogging) {
      print(`AgentOrchestrator: 🗣️ Dialogue state: ${state.currentSpeaker}, depth: ${state.dialogueDepth}`)
    }

    this.currentAgentTone = state.currentSpeaker
  }

  // ================================
  // Display Management
  // ================================

  /**
   * Update agent display with color and indicator
   */
  private updateAgentDisplay(agentName: string): void {
    // Get agent color
    const color = this.getAgentColor(agentName)

    // Update current agent color
    this.currentAgentColor = color
    this.currentAgentTone = agentName

    // Update text display
    if (this.agentDisplayText) {
      const label = this.getAgentLabel(agentName)
      this.agentDisplayText.text = label

      // In a real implementation, we'd also update color
      // this.agentDisplayText.color = color
    }

    if (this.enableDebugLogging) {
      print(`AgentOrchestrator: 🎨 Agent display updated: ${agentName} (${color})`)
    }

    // Fire agent changed event
    this.onAgentChanged.invoke({
      agent: agentName,
      color: color,
      reason: "routing"
    })
  }

  /**
   * Get agent color based on name
   */
  private getAgentColor(agentName: string): string {
    return this.AGENT_COLORS[agentName as keyof typeof this.AGENT_COLORS] || "#666666"
  }

  /**
   * Get agent display label
   */
  private getAgentLabel(agentName: string): string {
    const labels: Record<string, string> = {
      naturalist: "🌿 Naturalist",
      archivist: "📚 Archivist"
    }

    return labels[agentName] || agentName
  }

  /**
   * Update tool display with routing information
   */
  private updateToolDisplay(query: string, result: any): void {
    if (!this.toolDisplayText) return

    try {
      let toolDisplay = "Agent System"

      // Determine which tool/agent was used
      if (result.success && result.result) {
        if (result.agent === "naturalist") {
          toolDisplay = "🌿 Naturalist"
        } else if (result.agent === "archivist") {
          toolDisplay = "📚 Archivist"
        } else {
          toolDisplay = "Agent System"
          }
      }

      this.toolDisplayText.text = toolDisplay

      if (this.enableDebugLogging) {
        print(`AgentOrchestrator: 📺 Tool/Agen: ${toolDisplay}`)
      }
    } catch (error) {
      if (this.enableDebugLogging) {
        print(`AgentOrchestrator: Failed to update display: ${error}`)
      }
    }
  }

  // ================================
  // Context Management
  // ================================

  private getConversationContext(): ChatMessage[] {
    if (!this.memorySystem) {
      return []
    }

    return this.memorySystem.getChatHistory().slice(-this.conversationContextMessages)
  }

  /**
   * Store conversation in memory and storage
   */
  private storeConversation(query: string, response: string): void {
    const timestamp = Date.now()

    // Store user message
    const userMessage: ChatMessage = {
      id: `msg_${timestamp}_user`,
      type: "user",
      content: query,
      timestamp: timestamp,
      cardIndex: -1,
      relatedTools: []
    }

    // Store bot response
    const botMessage: ChatMessage = {
      id: `msg_${timestamp}_bot`,
      type: "bot",
      content: response,
      timestamp: timestamp + 1,
      cardIndex: -1,
      relatedTools: ["agent_system"]
    }

    // Store in memory
    if (this.memorySystem) {
      this.memorySystem.addChatMessage(userMessage)
      this.memorySystem.addChatMessage(botMessage)
      this.systemState!.chatHistory = this.memorySystem.getChatHistory()
      this.onSystemStateChanged.invoke(this.systemState!)
    }

    // Store in storage
    if (this.storageManager) {
      const chatStorage = this.storageManager.getChatStorage()
      if (chatStorage) {
        chatStorage.addMessage({
          id: userMessage.id,
          type: userMessage.type,
          content: userMessage.content,
          timestamp: userMessage.timestamp,
          cardIndex: userMessage.cardIndex,
          relatedTools: userMessage.relatedTools
        })

        chatStorage.addMessage({
          id: botMessage.id,
          type: botMessage.type,
          content: botMessage.content,
          timestamp: botMessage.timestamp,
          cardIndex: botMessage.cardIndex,
          relatedTools: botMessage.relatedTools
        })

        if (this.enableDebugLogging) {
          print(`AgentOrchestrator: 💾 Stored conversation in ChatStorage`)
        }
      }
    }
  }

  /**
   * Store only user query (for voice mode)
   */
  private storeUserQueryOnly(query: string): void {
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      type: "user",
      content: query,
      timestamp: Date.now(),
      cardIndex: -1,
      relatedTools: []
    }

    // Store in memory
    if (this.memorySystem) {
      this.memorySystem.addChatMessage(userMessage)
      this.systemState!.chatHistory = this.memorySystem.getChatHistory()
    }

    // Store in storage
    if (this.storageManager) {
      const chatStorage = this.storageManager.getChatStorage()
      if (chatStorage) {
        chatStorage.addMessage({
          id: userMessage.id,
          type: userMessage.type,
          content: userMessage.content,
          timestamp: userMessage.timestamp,
          cardIndex: userMessage.cardIndex,
          relatedTools: userMessage.relatedTools
        })
      }
    }
  }

  // ================================
  // System Management
  // ================================

  public getSystemState(): SystemState | null {
    return this.systemState
  }

  public isSystemReady(): boolean {
    return this.initialized && this.enableSystem && !this.isProcessingQuery
  }

  public resetSystem(): void {
    // Reset agent system
    if (this.agentRouter) {
      this.agentRouter.clearHistory()
    }

    if (this.agentCoordinator) {
      this.agentCoordinator.resetDialogueState()
      this.agentCoordinator.clearQueue()
    }

    // Reset system state
    this.initializeSystemState()

    // Reset storage
    if (this.storageManager) {
      this.storageManager.resetAllStorage()
      if (this.enableDebugLogging) {
        print("AgentOrchestrator: Using StorageManager for system reset")
      }
    } else if (this.memorySystem) {
      this.memorySystem.clearStorage()
    }

    // Fire reset event
    this.onSystemReset.invoke()

    if (this.enableDebugLogging) {
      print("AgentOrchestrator: System reset completed")
    }
  }

  // ================================
  // Error Handling
  // ================================

  private handleError(error: string): void {
    print(`AgentOrchestrator: ${error}`)
    this.onError.invoke(error)

    if (this.systemState) {
      this.systemState.currentStep = "idle"
      this.onSystemStateChanged.invoke(this.systemState)
    }
  }
}
