import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {setTimeout} from "SpectaclesInteractionKit.lspkg/Utils/FunctionTimingUtils"
import {AgentRouter} from "./AgentRouter"
import {IOutdoorAgent, OutdoorAgentResponse} from "./OutdoorAgent"
import {Message} from "./AgentTypes"

/**
 * Coordination priority levels
 */
type CoordinationPriority = "critical" | "high" | "medium" | "low"

/**
 * Coordination request from one agent to another
 */
interface CoordinationRequest {
  fromAgent: string
  toAgent: string
  context: string
  priority: number // 1-10, higher = more urgent
  timestamp: number
}

/**
 * Coordination response
 */
interface CoordinationResponse {
  request: CoordinationRequest
  response: OutdoorAgentResponse | null
  success: boolean
  errorMessage?: string
}

/**
 * Dialogue state for tracking conversation flow
 */
interface DialogueState {
  currentSpeaker: string
  lastSpoken: string | null
  coordinationCount: number
  lastCoordinationTopic: string | null
  dialogueDepth: number // How deep in coordination we are
}

/**
 * Agent Coordinator - Manages collaborative dialogue between agents
 *
 * Responsibilities:
 * - Handle coordination requests between agents
 * - Manage dialogue flow and speaker transitions
 * - Combine agent responses into cohesive conversation
 * - Prevent coordination loops and manage depth
 * - Provide transparency into agent collaboration
 */
export class AgentCoordinator {
  private agentRouter: AgentRouter

  // // Coordination queue and state
  private coordinationQueue: CoordinationRequest[] = []
  private isProcessing: boolean = false
  private dialogueState: DialogueState = {
    currentSpeaker: "naturalist",
    lastSpoken: null,
    coordinationCount: 0,
    lastCoordinationTopic: null,
    dialogueDepth: 0
  }

  // Events for coordination transparency
  public onCoordinationCompleted: Event<CoordinationResponse> = new Event()
  public onDialogueStateChanged: Event<DialogueState> = new Event()
  public onSpeakerChanged: Event<{from: string; to: string; reason: string}> = new Event()
  public onCoordinationRequested: Event<{from: string; to: string; context: string; priority: number}> = new Event()

  // Configuration
  private config: {
    maxCoordinationDepth: number // Prevent infinite loops
    minCoordinationPriority: number // Only process requests above this priority
    enableSpeakerAnnouncements: boolean // Announce when agents speak
    dialogueTimeout: number // Max time to wait for coordination response
  }

  constructor(agentRouter: AgentRouter, config?: Partial<typeof AgentCoordinator.prototype.config>) {
    this.agentRouter = agentRouter

    this.config = {
      maxCoordinationDepth: 3,
      minCoordinationPriority: 4,
      enableSpeakerAnnouncements: true,
      dialogueTimeout: 5000, // 5 seconds
      ...config
    }

    this.initializeDialogueState()

    // Subscribe to router coordination events
    this.agentRouter.onCoordinationRequested.add((data) => {
      this.queueCoordination(data.fromAgent, data.toAgent, data.context, data.priority)
    })

    print(`AgentCoordinator: 🤝 Collaborative dialogue manager initialized`)
  }

  /**
   * Initialize dialogue state
   */
  private initializeDialogueState(): void {
    print("AgentCoordinator: Dialogue state initialized")
  }

  /**
   * Queue a coordination request
   */
  public queueCoordination(
    fromAgent: string,
    toAgent: string,
    context: string,
    priority: number
  ): void {
    const request: CoordinationRequest = {
      fromAgent,
      toAgent,
      context,
      priority,
      timestamp: Date.now()
    }

    this.coordinationQueue.push(request)

    // Sort by priority (highest first)
    this.coordinationQueue.sort((a, b) => b.priority - a.priority)

    print(
      `AgentCoordinator: Queued coordination: ${fromAgent} → ${toAgent} (priority: ${priority}, queue size: ${this.coordinationQueue.length})`
    )

    // Process queue if not already processing
    if (!this.isProcessing) {
      this.processCoordinationQueue()
    }
  }

  /**
   * Process coordination queue
   */
  private async processCoordinationQueue(): Promise<void> {
    if (this.coordinationQueue.length === 0) {
      this.isProcessing = false
      return
    }

    this.isProcessing = true

    while (this.coordinationQueue.length > 0) {
      const request = this.coordinationQueue.shift()!

      // Check if priority meets threshold
      if (request.priority < this.config.minCoordinationPriority) {
        print(`AgentCoordinator: Skipping low-priority coordination (${request.priority} < ${this.config.minCoordinationPriority})`)
        continue
      }

      // Check coordination depth limit
      if (this.dialogueState.dialogueDepth >= this.config.maxCoordinationDepth) {
        print(`AgentCoordinator: Coordination depth limit reached (${this.config.maxCoordinationDepth})`)
        continue
      }

      // Process this coordination
      await this.processCoordinationRequest(request)

      // Small delay between coordinations
      await this.sleep(500)
    }

    this.isProcessing = false
    print("AgentCoordinator: Coordination queue processing completed")
  }

  /**
   * Process a single coordination request
   */
  private async processCoordinationRequest(request: CoordinationRequest): Promise<void> {
    print(`AgentCoordinator: Processing coordination: ${request.fromAgent} → ${request.toAgent}`)

    // Update dialogue state
    this.updateDialogueStateForCoordination(request)

    try {
      // Get target agent
      const targetAgent = this.agentRouter.getAgent(request.toAgent)
      if (!targetAgent) {
        this.completeCoordination(request, null, false, `Target agent '${request.toAgent}' not found`)
        return
      }

      // Create coordination message for target agent
      const coordinationMessage = this.createCoordinationMessage(request, targetAgent.name)

      // Execute coordination
      const response = await this.executeAgentCoordination(targetAgent, coordinationMessage)

      // Update coordination count
      this.dialogueState.coordinationCount++
      this.dialogueState.lastCoordinationTopic = request.context.substring(0, 50)

      // Complete coordination
      this.completeCoordination(request, response, true)

      // Update dialogue state for response
      if (response) {
        this.dialogueState.lastSpoken = request.toAgent
        this.onDialogueStateChanged.invoke(this.dialogueState)
      }
    } catch (error) {
      print(`AgentCoordinator: ERROR - Coordination failed: ${error}`)
      this.completeCoordination(request, null, false, `Coordination execution failed: ${error}`)
    }
  }

  /**
   * Create coordination message for target agent
   */
  private createCoordinationMessage(request: CoordinationRequest, agentName: string): string {
    return `[COORDINATION REQUEST from ${request.fromAgent}]: ${request.context}

Please provide your insights or knowledge to help enrich this response. Consider:
- What can you add based on your expertise?
- How can you enhance the user's understanding?
- What interesting context or stories can you share?

Focus on being concise and complementary to what ${request.fromAgent} has already provided.`
  }

  /**
   * Execute agent coordination
   */
  private async executeAgentCoordination(
    agent: IOutdoorAgent,
    message: string
  ): Promise<OutdoorAgentResponse | null> {
    try {
      // Announce speaker change if enabled
      if (this.config.enableSpeakerAnnouncements && this.dialogueState.currentSpeaker !== agent.name) {
        this.announceSpeakerChange(this.dialogueState.currentSpeaker, agent.name, "coordination request")
      }

      // Update current
      this.dialogueState.currentSpeaker = agent.name
      this.dialogueState.dialogueDepth++

      // Execute agent with coordination message
      const args = {
        query: message,
        context: [], // Fresh context for coordination
        maxLength: 200, // Shorter responses for coordination
        isCoordination: true // Flag to indicate this is coordination
      }

      const response = await agent.execute(args)

      print(`AgentCoordinator: ${agent.name} coordination response: "${response.message.substring(0, 50)}..."`)

      return response
    } catch (error) {
      print(`AgentCoordinator: ERROR - Agent coordination failed: ${error}`)
      return null
    } finally {
      this.dialogueState.dialogueDepth--
    }
  }

  /**
   * Announce speaker change for transparency
   */
  private announceSpeakerChange(from: string, to: string, reason: string): void {
    print(`AgentCoordinator: 🔄 Speaker change: ${from} → ${to} (${reason})`)
    this.onSpeakerChanged.invoke({from: from, to: to, reason})
  }

  /**
   * Update dialogue state for coordination
   */
  private updateDialogueStateForCoordination(request: CoordinationRequest): void {
    // Check if this is a new coordination topic
    const isNewTopic =
      !this.dialogueState.lastCoordinationTopic ||
      !request.context.includes(this.dialogueState.lastCoordinationTopic)

    if (isNewTopic) {
      // Reset some state for new topic
      this.dialogueState.dialogueDepth = 0
    }

    print(`AgentCoordinator: Dialogue state updated for coordination`)
  }

  /**
   * Complete coordination and fire events
   */
  private completeCoordination(
    request: CoordinationRequest,
    response: OutdoorAgentResponse | null,
    success: boolean,
    errorMessage?: string
  ): void {
    const coordinationResponse: CoordinationResponse = {
      request,
      response,
      success,
      errorMessage
    }

    this.onCoordinationCompleted.invoke(coordinationResponse)

    print(
      `AgentCoordinator: ✅ Coordination completed: ${request.fromAgent} → ${request.toAgent} (${success ? "success" : "failed"})`
    )
  }

  /**
   * Get current dialogue state
   */
  public getDialogueState(): DialogueState {
    return {...this.dialogueState}
  }

  /**
   * Get coordination statistics
   */
  public getCoordinationStats(): {
    queueLength: number
    totalCoordinations: number
    activeAgent: string
    averageDepth: number
  } {
    return {
      queueLength: this.coordinationQueue.length,
      totalCoordinations: this.dialogueState.coordinationCount,
      activeAgent: this.dialogueState.currentSpeaker,
      averageDepth: this.dialogueState.dialogueDepth
    }
  }

  /**
   * Reset dialogue state
   */
  public resetDialogueState(): void {
    this.initializeDialogueState()
    this.onDialogueStateChanged.invoke(this.dialogueState)
    print("AgentCoordinator: Dialogue state reset")
  }

  /**
   * Clear coordination queue
   */
  public clearQueue(): void {
    this.coordinationQueue = []
    print("AgentCoordinator: Coordination queue cleared")
  }

  /**
   * Update coordinator configuration
   */
  public updateConfig(config: Partial<typeof AgentCoordinator.prototype.config>): void {
    this.config = {...this.config, ...config}
    print(`AgentCoordinator: Configuration updated`)
  }

  /**
   * Get current configuration
   */
  public getConfig(): typeof AgentCoordinator.prototype.config {
    return {...this.config}
  }

  /**
   * Simple sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
