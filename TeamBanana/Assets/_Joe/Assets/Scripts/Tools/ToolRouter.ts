import {AgentLanguageInterface} from "../Agents/AgentLanguageInterface"
import {ChatStorage} from "../Storage/ChatStorage"
import {GeneralConversationTool} from "./GeneralConversationTool"
import {SpatialTool} from "./SpatialTool"

/**
 * Tool metadata for AI routing decisions
 */
interface ToolMetadata {
  name: string
  description: string
  capabilities: string[]
  useWhen: string[]
  instance: any
}

/**
 * Intelligent AI-powered tool router that uses LLM reasoning for routing decisions
 * Replaces primitive string matching with contextual understanding
 */
export class ToolRouter {
  private languageInterface: AgentLanguageInterface
  private toolIndex: Map<string, ToolMetadata> = new Map()
  private enableDebugLogging: boolean = true

  constructor(languageInterface: AgentLanguageInterface, _deprecatedStorage?: any) {
    this.languageInterface = languageInterface

    // Initialize tools
    const generalConversation = new GeneralConversationTool(languageInterface)
    const spatialTool = new SpatialTool(languageInterface)

    // Index tools with their capabilities and use cases
    this.indexTool("spatial_tool", {
      name: "spatial_tool",
      description: "Answers questions about live lecture environment using camera input and spatial awareness",
      capabilities: [
        "Analyze current physical environment with camera",
        "Provide real-time spatial context",
        "Answer questions about what is currently happening",
        "Observe live presentations or current surroundings"
      ],
      useWhen: [
        'User asks about current/live environment or "what do you see right now"',
        "User wants real-time analysis of physical space",
        'User asks about "current presentation" happening live (not summarized)',
        "User requests camera-based observation of immediate surroundings"
      ],
      instance: spatialTool
    })

    this.indexTool("general_conversation", {
      name: "general_conversation",
      description: "Handles general conversation and educational questions without specialized context",
      capabilities: [
        "Provide general educational assistance",
        "Answer broad knowledge questions",
        "Engage in conversational learning",
        "Handle queries not requiring specialized tools"
      ],
      useWhen: [
        "General educational questions not related to specific lecture content",
        "Broad knowledge questions or concept explanations",
        "Conversational learning that doesn't need specialized context",
        "Default choice when no other tool is specifically needed"
      ],
      instance: generalConversation
    })

    if (this.enableDebugLogging) {
      print(`ToolRouter: 🧠 AI-powered intelligent tool router initialized with ${this.toolIndex.size} indexed tools`)
      print("ToolRouter: 📚 Tools indexed: " + Array.from(this.toolIndex.keys()).join(", "))
    }
  }

  /**
   * Set the chat storage for tools that need it
   */
  public setChatStorage(_chatStorage: ChatStorage): void {
    // ChatStorage connection point (reserved for future tool integration)
    print("ToolRouter: ChatStorage connected")
  }

  /**
   * Index a tool with its metadata for AI routing decisions
   */
  private indexTool(key: string, metadata: ToolMetadata): void {
    this.toolIndex.set(key, metadata)
    if (this.enableDebugLogging) {
      print(`ToolRouter: 📖 Indexed tool "${key}" with ${metadata.capabilities.length} capabilities`)
    }
  }

  /**
   * AI-powered intelligent routing - uses LLM to make routing decisions
   */
  public async routeQuery(args: Record<string, unknown>): Promise<{success: boolean; result?: any; error?: string}> {
    const {query} = args

    if (!query || typeof query !== "string") {
      return {success: false, error: "Query parameter is required and must be a string"}
    }

    try {
      // Get routing decision from AI
      const selectedTool = await this.getAIRoutingDecision(query as string)

      if (!selectedTool || !this.toolIndex.has(selectedTool)) {
        print(`ToolRouter: AI selected unknown tool "${selectedTool}", falling back to general_conversation`)
        const fallbackTool = this.toolIndex.get("general_conversation")!
        return await fallbackTool.instance.execute(args)
      }

      const toolMetadata = this.toolIndex.get(selectedTool)!

      if (this.enableDebugLogging) {
        print(
          `ToolRouter: 🧠 AI routing decision: "${selectedTool}" for query: "${(query as string).substring(0, 50)}..."`
        )
        print(`ToolRouter: 💡 Reasoning: ${toolMetadata.description}`)
      }

      return await toolMetadata.instance.execute(args)
    } catch (error) {
      print(`ToolRouter: AI routing failed: ${error}`)
      // Fallback to general conversation on error
      const fallbackTool = this.toolIndex.get("general_conversation")!
      return await fallbackTool.instance.execute(args)
    }
  }

  /**
   * Use AI to make intelligent routing decision based on context and intent
   */
  private async getAIRoutingDecision(query: string): Promise<string> {
    // Build tool index description for AI
    const toolDescriptions = Array.from(this.toolIndex.values())
      .map((tool) => {
        return `**${tool.name}**:
- Description: ${tool.description}
- Use when: ${tool.useWhen.join("; ")}
- Capabilities: ${tool.capabilities.join("; ")}`
      })
      .join("\n\n")

    const routingPrompt = `You are an intelligent tool router for an educational AI assistant. Analyze the user query and select the most appropriate tool.

AVAILABLE TOOLS:
${toolDescriptions}

USER QUERY: "${query}"

ROUTING RULES:
1. If user asks about current/live environment or "what do you see", use "spatial_tool"
2. For general questions without specific tool needs, use "general_conversation"

Respond with ONLY the tool name (e.g., "spatial_tool", "general_conversation").`

    try {
      // Get routing decision from current language interface
      // Uses generateTextResponse() for silent routing (no voice output needed for internal decisions)
      const response = await this.languageInterface.generateTextResponse([
        {
          role: "user",
          content: routingPrompt
        }
      ])

      if (!response || typeof response !== "string") {
        throw new Error("Invalid routing response from AI")
      }

      // Extract tool name from response
      const toolName = response.trim().toLowerCase()

      // Validate tool name
      const validTools = Array.from(this.toolIndex.keys())
      const selectedTool = validTools.find((tool) => toolName.includes(tool))

      if (!selectedTool) {
        print(`ToolRouter: AI response "${toolName}" didn't match any indexed tool, using general_conversation`)
        return "general_conversation"
      }

      return selectedTool
    } catch (error) {
      print(`ToolRouter: AI routing decision failed: ${error}`)
      return "general_conversation"
    }
  }

  /**
   * Get tool information for registration with AgentToolExecutor
   */
  public getToolInfo() {
    return {
      name: "intelligent_conversation",
      description:
        "AI-powered intelligent router that analyzes queries and selects the most appropriate specialized tool for educational responses or spatial awareness",
      parameters: {
        type: "object",
        properties: {
          query: {type: "string", description: "User query to analyze and route to appropriate tool"},
          context: {type: "array", description: "Array of previous conversation messages for routing context"},
          maxLength: {type: "number", description: "Maximum character length for the response"},
          educationalFocus: {type: "boolean", description: "Whether to focus on educational content"}
        },
        required: ["query"]
      }
    }
  }

  /**
   * Get indexed tools information for debugging
   */
  public getIndexedTools(): string[] {
    return Array.from(this.toolIndex.keys())
  }

  /**
   * Get tool metadata for debugging
   */
  public getToolMetadata(toolName: string): ToolMetadata | undefined {
    return this.toolIndex.get(toolName)
  }
}
