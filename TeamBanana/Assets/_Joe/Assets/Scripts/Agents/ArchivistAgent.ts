import {OutdoorAgent, IOutdoorAgent, OutdoorAgentResponse, AgentPersonality} from "./OutdoorAgent"
import {AgentLanguageInterface} from "./AgentLanguageInterface"
import {Tool} from "./AgentTypes"
import {GeneralConversationTool} from "../Tools/GeneralConversationTool"
import {MockButterflyKnowledge} from "../Knowledge/MockButterflyKnowledge"

/**
 * Archivist Agent - Enthusiastic storyteller and butterfly knowledge curator
 *
 * Personality: Enthusiastic, knowledgeable, passionate
 * Teaching Style: Storyteller - brings facts to life through narrative
 * Philosophy: "Every butterfly has a story to tell"
 *
 * Focus areas:
 * - Species identification and taxonomy
 * - Life cycles and ecological relationships
 * - Fascinating stories and historical context
 * - Conservation and environmental connections
 */
export class ArchivistAgent extends OutdoorAgent {
  public readonly name = "archivist"
  public readonly agentType = "archivist" as const

  public readonly personality: AgentPersonality = {
    tone: "enthusiastic",
    teachingStyle: "storyteller",
    philosophy:
      "Every butterfly has a story to tell, and every observation is an opportunity to discover something amazing. I share knowledge and stories that bring your discoveries to life with context and meaning.",
    languagePatterns: [
      "Did you know...?",
      "What's fascinating about...",
      "Here's something amazing...",
      "I love that you noticed...",
      "What's really interesting is...",
      "Story goes that..."
    ],
    responseStyle: {
      pacing: "energetic",
      curiosityLevel: 0.4, // Lower curiosity - focuses on sharing knowledge
      storytelling: 0.9 // High storytelling - loves sharing facts and narratives
    }
  }

  // Knowledge base (using mock data for now)
  private knowledgeBase: MockButterflyKnowledge

  // Conversation state for storytelling
  private storyState: {
    lastSpeciesMentioned: string | null
    topicsExplored: string[]
    storiesShared: number
    curiosityPiqued: boolean
  } = {
    lastSpeciesMentioned: null,
    topicsExplored: [],
    storiesShared: 0,
    curiosityPiqued: false
  }

  private generalConversationTool: GeneralConversationTool

  constructor(languageInterface: AgentLanguageInterface) {
    super(languageInterface)

    // Initialize knowledge base
    this.knowledgeBase = new MockButterflyKnowledge()

    // Initialize general conversation tool as fallback
    this.generalConversationTool = new GeneralConversationTool(languageInterface)
    const startTime = Date.now()
    this.registerTool({
      name: "general_conversation",
      description: "Handle general educational questions",
      parameters: {
        type: "object",
        properties: {
          query: {type: "string", description: "User query"},
          maxLength: {type: "number", description: "Max response length"}
        },
        required: ["query"]
      },
      execute: async (args: Record<string, unknown>) => {
        const result = await this.generalConversationTool.execute(args)
        return {...result, executionTime: Date.now() - startTime}
      }
    })

    print("ArchivistAgent: 📚 Enthusiastic storyteller initialized")
  }

  /**
   * Generate archivist-specific system prompt
   */
  protected getSystemPrompt(): string {
    return `You are an Archivist - a passionate storyteller and expert on butterflies and their fascinating world.

YOUR PERSONALITY:
- Enthusiastic and passionate about butterfly knowledge
- Love sharing fascinating stories and amazing facts
- Celebrate user discoveries and observations
- Bring science to life through engaging narratives

TEACHING APPROACH (Storytelling):
- Share facts in interesting, story-based ways
- Connect observations to broader scientific or historical context
- Pique curiosity through unexpected connections and stories
- Celebrate what users have discovered or noticed
- Make complex information accessible through relatable stories

FOCUS AREAS:
1. **Species Identification**: What makes each butterfly unique and recognizable
2. **Life Cycles**: Amazing transformations and survival strategies
3. **Ecological Stories**: How butterflies fit into their ecosystems
4. **Fascinating Facts**: Surprising details that spark wonder
5. **Conservation Context**: Why protection matters and success stories

LANGUAGE PATTERNS:
- "Did you know that..."
- "What's fascinating about..."
- "Here's something amazing..."
- "I love that you noticed..."
- "Story goes that..."
- "What's really interesting is..."

RESPONSE GUIDELINES:
- Keep responses under 300 characters for AR display
- Share at least one fascinating fact or story in each response
- Connect user observations to broader scientific context
- Use enthusiastic but genuine tone
- When users make great observations, celebrate them enthusiastically
- Make scientific concepts accessible through stories and analogies

STORYTELLING TECHNIQUES:
- Start with user's observation, then expand
- Use "Did you know?" to introduce fascinating facts
- Connect local observations to global phenomena (e.g., migration)
- Share conservation success stories when appropriate
- Use analogies to explain complex concepts

IMPORTANT: You're a storyteller who brings observations to life. Every butterfly encounter is an opportunity to share something amazing!`
  }

  /**
   * Determine if archivist can handle this query
   * High confidence for identification, species questions, and curiosity
   */
  public async canHandleQuery(query: string, context?: any): Promise<number> {
    const lowerQuery = query.toLowerCase()
    let confidence = 0.3 // Base confidence for general educational queries

    // Species identification
    if (
      lowerQuery.includes("identify") ||
      lowerQuery.includes("what kind") ||
      lowerQuery.includes("what is") ||
      lowerQuery.includes("think i see")
    ) {
      confidence += 0.4
    }

    // Knowledge requests
    if (lowerQuery.includes("tell me about") || lowerQuery.includes("information")) {
      confidence += 0.3
    }

    // Scientific/curiosity questions
    if (
      lowerQuery.includes("why") ||
      lowerQuery.includes("how") ||
      lowerQuery.includes("do they") ||
      lowerQuery.includes("fascinating")
    ) {
      confidence += 0.3
    }

    // Life cycle and behavior
    if (
      lowerQuery.includes("life cycle") ||
      lowerQuery.includes("migrate") ||
      lowerQuery.includes("eat") ||
      lowerQuery.includes("host plant")
    ) {
      confidence += 0.3
    }

    // Butterfly species mentioned
    const butterflySpecies = this.knowledgeBase.identifySpeciesInQuery(query)
    if (butterflySpecies) {
      confidence += 0.3
    }

    // Context suggests species knowledge is needed
    if (context && this.hasButterflyObservation(context)) {
      confidence += 0.2
    }

    return Math.min(confidence, 1.0)
  }

  /**
   * Execute archivist response
   */
  public async execute(args: Record<string, unknown>): Promise<OutdoorAgentResponse> {
    const {query, context} = args

    if (!query || typeof query !== "string") {
      return this.createErrorResponse("I'd love to tell you about butterflies! What would you like to know?")
    }

    try {
      print(`ArchivistAgent: Processing knowledge query: "${(query as string).substring(0, 50)}..."`)

      // Check for species mentions to enhance knowledge
      const speciesInfo = this.knowledgeBase.identifySpeciesInQuery(query as string)
      if (speciesInfo) {
        this.storyState.lastSpeciesMentioned = speciesInfo
      }

      // Enhance query with knowledge base context
      const enhancedQuery = this.enhanceQueryWithKnowledge(query as string, speciesInfo)

      // Generate response with storytelling approach
      const messages = this.buildMessages(enhancedQuery, context)
      const response = await this.generateLLMResponse(messages, {
        temperature: 0.9, // Higher for more creative storytelling
        maxTokens: 250,
        textOnly: false // Voice output with energetic pacing
      })

      const message = response.content || "I love sharing butterfly knowledge! What would you like to know about these amazing creatures?"

      // Update story state
      this.updateStoryState(message, query as string)

      // Check if coordination with Naturalist would help
      const coordinationRequest = this.shouldRequestCoordination(message, query as string)

      print(`ArchivistAgent: Generated knowledge response: "${message.substring(0, 50)}..."`)

      return this.createSuccessResponse(message, coordinationRequest)
    } catch (error) {
      print(`ArchivistAgent: ERROR - Knowledge sharing failed: ${error}`)
      return this.createErrorResponse("I'm excited to share knowledge but having trouble right now. Could you tell me more about what you observed?")
    }
  }

  /**
   * Enhance query with knowledge from mock database
   */
  private enhanceQueryWithKnowledge(query: string, speciesInfo: string | null): string {
    if (speciesInfo) {
      const speciesData = this.knowledgeBase.getSpeciesInfo(speciesInfo)
      if (speciesData) {
        // Add knowledge context to prompt
        return `${query}\n\n[KNOWLEDGE CONTEXT: About ${speciesInfo}: ${speciesData.shortDescription} Key facts: ${speciesData.fascinatingFacts.slice(0, 2).join("; ")}]`
      }
    }
    return query
  }

  /**
   * Check if context indicates butterfly observation
   */
  private hasButterflyObservation(context: any): boolean {
    if (!context) return false

    const contextStr = JSON.stringify(context).toLowerCase()
    return (
      contextStr.includes("butterfly") ||
      contextStr.includes("see one") ||
      contextStr.includes("spotted") ||
      contextStr.includes("orange") ||
      contextStr.includes("wing")
    )
  }

  /**
   * Update story state based on content
   */
  private updateStoryState(message: string, query: string): void {
    const lowerMessage = message.toLowerCase()
    const lowerQuery = query.toLowerCase()

    // Track stories shared
    if (lowerMessage.includes("fascinating") || lowerMessage.includes("amazing") || lowerMessage.includes("story")) {
      this.storyState.storiesShared++
    }

    // Track curiosity triggered
    if (lowerMessage.includes("did you know") || lowerMessage.includes("here's something")) {
      this.storyState.curiosityPiqued = true
    }

    // Track topics explored
    if (lowerQuery.includes("life cycle")) {
      this.storyState.topicsExplored.push("life cycle")
    }
    if (lowerQuery.includes("migrate")) {
      this.storyState.topicsExplored.push("migration")
    }
    if (lowerQuery.includes("habitat") || lowerQuery.includes("plant")) {
      this.storyState.topicsExplored.push("habitat")
    }
  }

  /**
   * Determine if Naturalist coordination would enhance response
   */
  private shouldRequestCoordination(
    message: string,
    query: string
  ): {targetAgent: string; context: string; priority: number} | undefined {
    const lowerQuery = query.toLowerCase()

    // Request Naturalist guidance for observation if we've shared knowledge
    if (
      this.storyState.storiesShared > 0 &&
      (lowerQuery.includes("migrate") || lowerQuery.includes("behavior"))
    ) {
      return {
        targetAgent: "naturalist",
        context: `User has received knowledge about ${this.storyState.lastSpeciesMentioned || "butterflies"}. Could benefit from observation guidance.`,
        priority: 6
      }
    }

    // Request Naturalist to guide deeper discovery after identification
    if (lowerQuery.includes("identify") && this.storyState.lastSpeciesMentioned) {
      return {
        targetAgent: "naturalist",
        context: `Species ${this.storyState.lastSpeciesMentioned} has been identified. User could benefit from guided observation of its behavior and habitat interactions.`,
        priority: 7
      }
    }

    return undefined
  }

  /**
   * Generate follow-up questions (storyteller approach)
   */
  protected generateFollowUps(): string[] {
    let followUps: string[] = []

    if (this.storyState.lastSpeciesMentioned) {
      const species = this.storyState.lastSpeciesMentioned
      if (species) {
        followUps.push(`Would you like to hear more about ${species}?`)
        followUps.push("What else would you like to know about this species?")
      }
    }

    // Based on stories shared
    if (this.storyState.curiosityPiqued) {
      followUps.push("What's another fascinating fact about these creatures?")
      followUps.push("Would you like to explore a different aspect of butterfly life?")
    }

    // General follow-ups
    if (followUps.length < 3) {
      followUps.push("What would you like to discover next?")
      followUps.push("Is there another species or topic you're curious about?")
    }

    return followUps.slice(0, 3)
  }

  /**
   * Extract topics related to knowledge shared
   */
  protected extractTopics(): string[] {
    const topics = []

    if (this.storyState.lastSpeciesMentioned) {
      topics.push(this.storyState.lastSpeciesMentioned.toLowerCase())
    }

    if (this.storyState.topicsExplored.length > 0) {
      topics.push(...this.storyState.topicsExplored)
    }

    if (this.storyState.curiosityPiqued) {
      topics.push("fascinating facts")
    }

    return topics.length > 0 ? topics : ["butterfly knowledge", "species information"]
  }
}
