import {AgentLanguageInterface} from "./AgentLanguageInterface"
import {IOutdoorAgent, OutdoorAgentResponse} from "./OutdoorAgent"
import {NaturalistAgent} from "./NaturalistAgent"
import {ArchivistAgent} from "./ArchivistAgent"
import {Message} from "./AgentTypes"
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {ButterflyIdentifier} from "_Aggy/Scripts/ButterflyIdentifier"
import {SupabaseDBManager} from "_Boon/SupabaseInfoStoring&Retrieving/Scripts/SupabaseDBManager"
import {NearbySightingManager} from "_Boon/NearbySighting/Scripts/NearbySightingManager"

/**
 * Agent routing configuration
 * Defines routing rules and confidence thresholds
 */
interface RoutingConfig {
  confidenceThreshold: number // Minimum confidence to select an agent
  fallbackAgent: string // Default agent when no clear match
  enableCoordination: boolean // Allow agents to request coordination
  debugRouting: boolean // Log routing decisions
}

/**
 * Routing decision result
 */
interface RoutingDecision {
  selectedAgent: string
  confidence: number
  reasoning: string
  alternativeAgents: {name: string; confidence: number}[]
}

/**
 * Agent Router - Intelligently routes queries to appropriate outdoor education agents
 *
 * Responsibilities:
 * - Analyze query content and context
 * - Evaluate agent capabilities and confidence
 * - Select best agent or request coordination
 * - Provide routing transparency and explainability
 */
export class AgentRouter {
  private languageInterface: AgentLanguageInterface
  private agents: Map<string, IOutdoorAgent> = new Map()
  private config: RoutingConfig

  // Routing history for learning and pattern recognition
  private routingHistory: RoutingDecision[] = []

  // Events for routing transparency
  public onRoutingDecision: Event<RoutingDecision> = new Event()
  public onCoordinationRequested: Event<{fromAgent: string; toAgent: string; context: string; priority: number}> = new Event()

  constructor(languageInterface: AgentLanguageInterface, config?: Partial<RoutingConfig>, dbManager?: SupabaseDBManager, mapManager?: NearbySightingManager, butterflyIdentifier?: ButterflyIdentifier) {
    this.languageInterface = languageInterface
    this.config = {
      confidenceThreshold: 0.4,
      fallbackAgent: "naturalist",
      enableCoordination: true,
      debugRouting: true,
      ...config
    }

    this.initializeAgents(dbManager, mapManager, butterflyIdentifier)
    print(`AgentRouter: 🧠 Intelligent router initialized with ${this.agents.size} agents`)
  }

  /**
   * Initialize outdoor education agents
   */
  private initializeAgents(dbManager?: SupabaseDBManager, mapManager?: NearbySightingManager, butterflyIdentifier?: ButterflyIdentifier): void {
    // Create Naturalist agent
    const naturalist = new NaturalistAgent(this.languageInterface, dbManager, mapManager, butterflyIdentifier)
    this.registerAgent(naturalist)

    // Create Archivist agent
    const archivist = new ArchivistAgent(this.languageInterface, dbManager, mapManager, butterflyIdentifier)
    this.registerAgent(archivist)
  }

  /**
   * Register an agent with the router
   */
  public registerAgent(agent: IOutdoorAgent): void {
    if (this.agents.has(agent.name)) {
      print(`AgentRouter: Agent '${agent.name}' already registered`)
      return
    }

    this.agents.set(agent.name, agent)

    // Setup coordination event handlers
    agent.onCoordinationRequested.add((data) => {
      this.handleCoordinationRequest(data)
    })

    print(`AgentRouter: 📋 Agent '${agent.name}' registered (type: ${agent.agentType})`)
  }

  /**
   * Get a registered agent by name
   */
  public getAgent(name: string): IOutdoorAgent | undefined {
    return this.agents.get(name)
  }

  /**
   * Main routing method - determines which agent should handle a query
   */
  public async routeQuery(
    query: string,
    context?: any
  ): Promise<RoutingDecision> {
    print(`AgentRouter: Routing query: "${query.substring(0, 50)}..."`)

    try {
      // Get confidence scores from all agents
      const agentScores = await this.evaluateAgents(query, context)

      // Make routing decision
      const decision = this.makeRoutingDecision(agentScores)

      // Log routing decision
      this.logRoutingDecision(decision)

      // Add to history
      this.routingHistory.push(decision)
      if (this.routingHistory.length > 10) {
        this.routingHistory.shift() // Keep last 10 decisions
      }

      // Fire routing decision event
      this.onRoutingDecision.invoke(decision)

      return decision
    } catch (error) {
      print(`AgentRouter: ERROR - Routing failed: ${error}`)
      return this.createFallbackRouting()
    }
  }

  /**
   * Evaluate all agents to determine their confidence in handling the query
   */
  private async evaluateAgents(
    query: string,
    context?: any
  ): Promise<{name: string; confidence: number}[]> {
    const scores: {name: string; confidence: number}[] = []

    for (const [name, agent] of this.agents) {
      try {
        const confidence = await agent.canHandleQuery(query, context)
        scores.push({name, confidence})

        if (this.config.debugRouting) {
          print(`AgentRouter: '${name}' confidence: ${confidence.toFixed(2)}`)
        }
      } catch (error) {
        print(`AgentRouter: ERROR evaluating '${name}': ${error}`)
        scores.push({name, confidence: 0})
      }
    }

    return scores
  }

  /**
   * Make final routing decision based on agent scores
   */
  private makeRoutingDecision(
    scores: {name: string; confidence: number}[]
  ): RoutingDecision {
    // Sort by confidence (highest first)
    const sortedScores = scores.slice().sort((a, b) => b.confidence - a.confidence)

    const highestScore = sortedScores[0]

    // Check if confidence meets threshold
    const meetsThreshold =
      highestScore.confidence >= this.config.confidenceThreshold

    if (!meetsThreshold) {
      if (this.config.debugRouting) {
        print(`AgentRouter: No agent met threshold (${this.config.confidenceThreshold}), using fallback`)
      }

      return {
        selectedAgent: this.config.fallbackAgent,
        confidence: 0,
        reasoning: `No agent met confidence threshold of ${this.config.confidenceThreshold}. Using fallback agent.`,
        alternativeAgents: sortedScores.slice(1).map((s) => ({
            name: s.name,
            confidence: s.confidence
          }))
      }
    }

    // Build reasoning
    const reasoning = this.buildRoutingReasoning(highestScore, sortedScores.slice(1))

    return {
      selectedAgent: highestScore.name,
      confidence: highestScore.confidence,
      reasoning: reasoning,
      alternativeAgents: sortedScores.slice(1).map((s) => ({
          name: s.name,
          confidence: s.confidence
        }))
    }
  }

  /**
   * Build human-readable reasoning for routing decision
   */
  private buildRoutingReasoning(
    selected: {name: string; confidence: number},
    alternatives: {name: string; confidence: number}[]
  ): string {
    const baseReasoning = `Selected ${selected.name} with confidence ${selected.confidence.toFixed(2)}.`

    if (alternatives.length === 0) {
      return `${baseReasoning} Only agent available.`
    }

    const altReasoning = alternatives
      .map((alt) => `${alt.name} (${alt.confidence.toFixed(2)})`)
      .join(", ")

    return `${baseReasoning} Alternatives considered: ${altReasoning}.`
  }

  /**
   * Create fallback routing decision
   */
  private createFallbackRouting(): RoutingDecision {
    return {
      selectedAgent: this.config.fallbackAgent,
      confidence: 0,
      reasoning: "Routing failed, using fallback agent",
      alternativeAgents: []
    }
  }

  /**
   * Handle coordination request between agents
   */
  private async handleCoordinationRequest(request: {
    fromAgent: string
    toAgent: string
    context: string
    priority: number
  }): Promise<void> {
    print(`AgentRouter: 🤝 Coordination request: ${request.fromAgent} → ${request.toAgent}`)

    if (!this.config.enableCoordination) {
      print("AgentRouter: Coordination disabled, ignoring request")
      return
    }

    const targetAgent = this.agents.get(request.toAgent)
    if (!targetAgent) {
      print(`AgentRouter: Target agent '${request.toAgent}' not found`)
      return
    }

    // Fire coordination requested event
    this.onCoordinationRequested.invoke(request)

    // The actual coordination will be handled by AgentCoordinator
    print(`AgentRouter: Coordination event fired, priority: ${request.priority}`)
  }

  /**
   * Log routing decision for transparency
   */
  private logRoutingDecision(decision: RoutingDecision): void {
    if (!this.config.debugRouting) return

    print(`AgentRouter: ✅ Routing decision:`)
    print(`  Selected: ${decision.selectedAgent}`)
    print(`  Confidence: ${decision.confidence.toFixed(2)}`)
    print(`  Reasoning: ${decision.reasoning}`)

    if (decision.alternativeAgents.length > 0) {
      print(
        `  Alternatives: ${decision.alternativeAgents
          .map((a) => `${a.name}(${a.confidence.toFixed(2)})`)
          .join(", ")}`
      )
    }
  }

  /**
   * Get routing statistics
   */
  public getRoutingStats(): {
    totalRoutes: {agent: string; count}[]
    averageConfidence: {agent: string; confidence: number}[]
  } {
    const agentCounts = new Map<string, number>()
    const agentConfidences = new Map<string, number[]>()

    this.routingHistory.forEach((decision) => {
      const currentCount = agentCounts.get(decision.selectedAgent) || 0
      agentCounts.set(decision.selectedAgent, currentCount + 1)

      const currentConfidences = agentConfidences.get(decision.selectedAgent) || []
      currentConfidences.push(decision.confidence)
      agentConfidences.set(decision.selectedAgent, currentConfidences)
    })

    const totalRoutes: {agent: string; count}[] = []
    const averageConfidence: {agent: string; confidence: number}[] = []

    for (const [agent, count] of agentCounts) {
      totalRoutes.push({agent, count})

      const confidences = agentConfidences.get(agent) || []
      const avgConfidence =
        confidences.length > 0
          ? confidences.reduce((a, b) => a + b, 0) / confidences.length
          : 0

      averageConfidence.push({agent, confidence: avgConfidence})
    }

    return {totalRoutes, averageConfidence}
  }

  /**
   * Get all registered agents
   */
  public getAllAgents(): IOutdoorAgent[] {
    return Array.from(this.agents.values())
  }

  /**
   * Clear routing history
   */
  public clearHistory(): void {
    this.routingHistory = []
    print("AgentRouter: Routing history cleared")
  }

  /**
   * Update router configuration
   */
  public updateConfig(config: Partial<RoutingConfig>): void {
    this.config = {...this.config, ...config}
    print(`AgentRouter: Configuration updated`)
  }

  /**
   * Get current configuration
   */
  public getConfig(): RoutingConfig {
    return {...this.config}
  }
}
