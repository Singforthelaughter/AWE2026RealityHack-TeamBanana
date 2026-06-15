import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {AgentLanguageInterface} from "./AgentLanguageInterface"
import {Tool, ToolResult, Message, LLMOptions, LLMResponse} from "./AgentTypes"

/**
 * Base interface for outdoor education agents
 * Defines common contract for Naturalist and Archivist agents
 */
export interface IOutdoorAgent {
  // Agent identification
  readonly name: string
  readonly agentType: "naturalist" | "archivist"

  // Personality and teaching style
  readonly personality: AgentPersonality

  // Core functionality
  execute(args: Record<string, unknown>): Promise<OutdoorAgentResponse>

  // Tool management
  registerTool(tool: Tool): void
  getTool(name: string): Tool | undefined

  // Tool display
  setToolDisplayCallback(cb: (toolName: string, args: Record<string, unknown>) => void): void

  // Coordination
  canHandleQuery(query: string, context?: any): Promise<number> // Returns confidence score 0-1
  requestCoordination(
    otherAgentName: string,
    context: string
  ): Promise<OutdoorAgentResponse | null>
  onCoordinationRequested: Event<{fromAgent: string; toAgent: string; context: string; priority: number}>
}

/**
 * Agent personality definition
 * Distinct personality traits for Naturalist and Archivist
 */
export interface AgentPersonality {
  tone: "gentle" | "enthusiastic"
  teachingStyle: "socratic" | "storyteller"
  philosophy: string
  languagePatterns: string[]
  responseStyle: {
    pacing: "measured" | "energetic" // Audio pacing
    curiosityLevel: number // 0-1, how much to ask questions
    storytelling: number // 0-1, how much to share facts/stories
  }
}

/**
 * Response from outdoor education agents
 */
export interface OutdoorAgentResponse {
  success: boolean
  message: string
  agent: string // Agent name
  requiresCoordination?: {
    targetAgent: string
    context: string
    priority: number // 1-10, higher = more urgent
  }
  suggestedFollowUp?: string[]
  relatedTopics?: string[]
  coordinationRequest?: string
}

/**
 * Abstract base class for outdoor education agents
 * Provides common functionality while requiring specific implementations
 */
export abstract class OutdoorAgent implements IOutdoorAgent {
  protected languageInterface: AgentLanguageInterface
  protected tools: Map<string, Tool> = new Map()

  public readonly name: string
  public readonly agentType: "naturalist" | "archivist"
  public readonly personality: AgentPersonality

  // Events for agent communication
  public onResponseGenerated: Event<OutdoorAgentResponse> = new Event()
  public onCoordinationRequested: Event<{fromAgent: string; toAgent: string; context: string; priority: number}> = new Event()

  // Callback for tool display text (set by orchestrator)
  private toolDisplayCallback: ((toolName: string, args: Record<string, unknown>) => void) | null = null

  public setToolDisplayCallback(cb: (toolName: string, args: Record<string, unknown>) => void): void {
    this.toolDisplayCallback = cb
  }

  constructor(languageInterface: AgentLanguageInterface) {
    this.languageInterface = languageInterface
    // name is set by child class constructors after super(), so don't log here
  }

  /**
   * Generate agent-specific system prompt
   * Must be implemented by each agent
   */
  protected abstract getSystemPrompt(): string

  /**
   * Determine if agent can handle a query
   * Returns confidence score 0-1
   */
  public abstract canHandleQuery(query: string, context?: any): Promise<number>

  /**
   * Main execution method - must be implemented by each agent
   */
  public abstract execute(args: Record<string, unknown>): Promise<OutdoorAgentResponse>

  /**
   * Generate AI response using language interface
   */
  protected async generateLLMResponse(
    messages: Message[],
    options?: LLMOptions
  ): Promise<LLMResponse> {
    try {
      const response = await this.languageInterface.generateResponse(messages, options)
      return response
    } catch (error) {
      print(`OutdoorAgent (${this.name}): LLM response generation failed: ${error}`)
      throw error
    }
  }

  /**
   * Build messages for LLM
   * Combines system prompt with conversation context
   */
  protected buildMessages(userQuery: string, context?: any): Message[] {
    const messages: Message[] = [
      {role: "system", content: this.getSystemPrompt()}
    ]

    // Add conversation context if available
    if (context && Array.isArray(context)) {
      const recentContext = context.slice(-5) // Last 5 messages for context
      recentContext.forEach((msg: any) => {
        if (msg.role && msg.content) {
          messages.push({
            role: msg.role,
            content: msg.content
          })
        }
      })
    }

    // Add current query
    messages.push({
      role: "user",
      content: userQuery
    })

    return messages
  }

  /**
   * Register a tool for this agent
   */
  public registerTool(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      print(`OutdoorAgent (${this.name}): Tool '${tool.name}' already registered, replacing...`)
    }
    this.tools.set(tool.name, tool)
    print(`OutdoorAgent (${this.name}): Tool '${tool.name}' registered`)
  }

  /**
   * Get a registered tool by name
   */
  public getTool(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  /**
   * Execute a tool
   */
  protected async executeTool(toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(toolName)
    if (!tool) {
      return {
        success: false,
        error: `Tool '${toolName}' not found`,
        executionTime: 0
      }
    }

    // Display tool usage on the UI tool display text
    if (this.toolDisplayCallback) {
      this.toolDisplayCallback(toolName, args)
    }

    try {
      const startTime = Date.now()
      const result = await tool.execute(args)
      const executionTime = Date.now() - startTime

      return {
        ...result,
        executionTime
      }
    } catch (error) {
      return {
        success: false,
        error: `Tool execution failed: ${error}`,
        executionTime: 0
      }
    }
  }

  /**
   * Request coordination with another agent
   * Used when agent wants other agent to contribute
   */
  public async requestCoordination(
    otherAgentName: string,
    context: string
  ): Promise<OutdoorAgentResponse | null> {
    print(`OutdoorAgent (${this.name}): Requesting coordination with ${otherAgentName}`)

    this.onCoordinationRequested.invoke({
      fromAgent: this.name,
      toAgent: otherAgentName,
      context: context,
      priority: 5
    })

    // Return null - coordination will be handled by AgentCoordinator
    return null
  }

  /**
   * Create a successful response
   */
  protected createSuccessResponse(
    message: string,
    coordinationRequest?: {
      targetAgent: string
      context: string
      priority: number
    }
  ): OutdoorAgentResponse {
    return {
      success: true,
      message: message,
      agent: this.name,
      requiresCoordination: coordinationRequest,
      suggestedFollowUp: this.generateFollowUps(),
      relatedTopics: this.extractTopics()
    }
  }

  /**
   * Create an error response
   */
  protected createErrorResponse(error: string): OutdoorAgentResponse {
    return {
      success: false,
      message: error,
      agent: this.name
    }
  }

  /**
   * Generate follow-up questions based on personality
   */
  protected generateFollowUps(): string[] {
    // Default implementation - can be overridden
    return []
  }

  /**
   * Extract related topics from response
   */
  protected extractTopics(): string[] {
    // Default implementation - can be overridden
    return []
  }
}
