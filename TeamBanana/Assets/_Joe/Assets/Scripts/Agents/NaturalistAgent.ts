import {OutdoorAgent, IOutdoorAgent, OutdoorAgentResponse, AgentPersonality} from "./OutdoorAgent"
import {AgentLanguageInterface} from "./AgentLanguageInterface"
import {Tool} from "./AgentTypes"
import {GeneralConversationTool} from "../Tools/GeneralConversationTool"
import {NearbySightingsTool} from "../Tools/NearbySightingsTool"
import {SupabaseDBManager} from "_Boon/SupabaseInfoStoring&Retrieving/Scripts/SupabaseDBManager"
import {NearbySightingManager} from "_Boon/NearbySighting/Scripts/NearbySightingManager"

/**
 * Naturalist Agent - Gentle Socratic guide for outdoor butterfly discovery
 *
 * Personality: Gentle, patient, encouraging
 * Teaching Style: Socratic - asks questions to stimulate thinking rather than lecturing
 * Philosophy: "I help you discover, you make the connections"
 *
 * Focus areas:
 * - Observation guidance and technique
 * - Ecological context and relationships
 * - Butterfly behavior coaching
 * - Environmental awareness
 */
export class NaturalistAgent extends OutdoorAgent {
  public readonly name = "naturalist"
  public readonly agentType = "naturalist" as const

  public readonly personality: AgentPersonality = {
    tone: "gentle",
    teachingStyle: "socratic",
    philosophy:
      "I help you discover the natural world around you. Through careful observation and thoughtful questions, I guide you to make your own connections and insights. The most profound discoveries come when you see and understand for yourself.",
    languagePatterns: [
      "What do you notice...",
      "Have you observed...",
      "How might...",
      "I'm curious about...",
      "Tell me more about...",
      "What patterns do you see..."
    ],
    responseStyle: {
      pacing: "measured",
      curiosityLevel: 0.9, // High curiosity - asks many questions
      storytelling: 0.3 // Low storytelling - focuses on discovery
    }
  }

  // Conversation state for Socratic approach
  private discoveryState: {
    environmentNoticed: boolean
    plantsIdentified: boolean
    butterflySighted: boolean
    behaviorObservations: string[]
    currentFocus: "environment" | "observation" | "discovery" | "reflection"
  } = {
    environmentNoticed: false,
    plantsIdentified: false,
    butterflySighted: false,
    behaviorObservations: [],
    currentFocus: "environment"
  }

  private generalConversationTool: GeneralConversationTool
  private nearbySightingsTool: NearbySightingsTool | null = null

  constructor(languageInterface: AgentLanguageInterface, dbManager?: SupabaseDBManager, mapManager?: NearbySightingManager) {
    super(languageInterface)

    // Initialize general conversation tool as fallback
    this.generalConversationTool = new GeneralConversationTool(languageInterface)
    const startTime = Date.now()
    this.registerTool({
      name: "general_conversation",
      description: "Handle general outdoor questions",
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

    // Register nearby sightings tool if dbManager is available
    if (dbManager) {
      this.nearbySightingsTool = new NearbySightingsTool(dbManager)
      if (mapManager) {
        this.nearbySightingsTool.setMapManager(mapManager)
      }
      this.registerTool({
        name: "nearby_sightings",
        description: "Find butterfly sightings near the user's current GPS location",
        parameters: this.nearbySightingsTool.parameters,
        execute: (args: Record<string, unknown>) => this.nearbySightingsTool!.execute(args)
      })
      print("NaturalistAgent: 🦋 Nearby sightings tool registered")
    }

    print("NaturalistAgent: 🌿 Gentle discovery guide initialized")
  }

  /**
   * Generate naturalist-specific system prompt
   */
  protected getSystemPrompt(): string {
    return `You are a Naturalist guide helping someone discover butterflies and nature in their outdoor environment.

YOUR PERSONALITY:
- Gentle, patient, and encouraging
- Ask thoughtful questions rather than lecturing
- Help the user make their own discoveries and connections
- Be curious about what they observe

TEACHING APPROACH (Socratic Method):
- Guide with questions that stimulate observation and thinking
- Help users notice details they might otherwise miss
- Encourage users to form their own hypotheses and conclusions
- Celebrate their discoveries and insights
- Build on what they already know or have observed

FOCUS AREAS:
1. **Environmental Awareness**: Plants, conditions, microhabitats
2. **Observation Techniques**: How to watch for butterfly behaviors
3. **Ecological Relationships**: How butterflies connect to their environment
4. **Discovery Guidance**: Prompts for noticing patterns and connections

LANGUAGE PATTERNS:
- "What do you notice about..."
- "Have you observed how..."
- "I'm wondering if you've noticed..."
- "What patterns do you see in..."
- "How might that be related to..."
- "Tell me more about what you see..."

RESPONSE GUIDELINES:
- Keep responses under 300 characters for AR display
- Ask questions that encourage closer observation
- Celebrate user discoveries and insights
- Be patient and supportive
- Help users make connections between their observations
- When you notice something exciting about their observations, gently point it out

IMPORTANT: You are a guide, not a lecturer. Help the user discover for themselves through thoughtful questions and gentle direction.`
  }

  /**
   * Determine if naturalist can handle this query
   * High confidence for discovery, observation, and environmental queries
   */
  public async canHandleQuery(query: string, context?: any): Promise<number> {
    const lowerQuery = query.toLowerCase()
    let confidence = 0.3 // Base confidence for general outdoor queries

    // Discovery and observation focus
    if (
      lowerQuery.includes("what should i look for") ||
      lowerQuery.includes("what do you see") ||
      lowerQuery.includes("where should i look")
    ) {
      confidence += 0.4
    }

    // Environmental observation
    if (
      lowerQuery.includes("notice") ||
      lowerQuery.includes("observe") ||
      lowerQuery.includes("see") ||
      lowerQuery.includes("look")
    ) {
      confidence += 0.3
    }

    // Patterns and behavior
    if (
      lowerQuery.includes("pattern") ||
      lowerQuery.includes("behavior") ||
      lowerQuery.includes("how do they")
    ) {
      confidence += 0.3
    }

    // Environmental context
    if (lowerQuery.includes("plant") || lowerQuery.includes("flower") || lowerQuery.includes("habitat")) {
      confidence += 0.2
    }

    // Socratic questioning
    if (lowerQuery.includes("?") && lowerQuery.length < 50) {
      confidence += 0.1 // User asking short questions
    }

    return Math.min(confidence, 1.0)
  }

  /**
   * Execute naturalist response
   */
  public async execute(args: Record<string, unknown>): Promise<OutdoorAgentResponse> {
    const {query, context} = args
    const queryStr = query as string

    if (!queryStr || typeof queryStr !== "string") {
      return this.createErrorResponse("I need a question to help guide your discovery.")
    }

    try {
      print(`NaturalistAgent: Processing query: "${queryStr.substring(0, 80)}"`)
      print(`NaturalistAgent: nearby_sightings registered: ${this.nearbySightingsTool ? "YES" : "NO — dbManager not wired?"}`)

      // Update discovery state based on query
      this.updateDiscoveryState(queryStr)

      // Check if nearby sightings tool should be activated
      let toolContext = ""
      if (this.shouldUseNearbySightings(queryStr)) {
        print("NaturalistAgent: Activating nearby_sightings...")
        const toolResult = await this.executeTool("nearby_sightings", {
          radius: 5,
          limit: 10,
          unit: "miles",
          showOnMap: true
        })
        if (toolResult.success && toolResult.result) {
          const result = toolResult.result as import("../Tools/NearbySightingsTool").NearbySightingsResult
          const tool = this.nearbySightingsTool
          toolContext = tool
            ? "\n\n[NEARBY SIGHTINGS: " + tool.formatSightingsSummary(result) + "]"
            : "\n\n[NEARBY SIGHTINGS: " + result.count + " sightings found within " + result.radius + " " + result.unit + "]"
          print("NaturalistAgent: Nearby sightings tool result integrated into response")
        }
      }

      // Generate response with Socratic approach, including tool context
      const enhancedQuery = toolContext ? queryStr + toolContext : queryStr
      const messages = this.buildMessages(enhancedQuery, context)
      // Use textOnly when we have tool context — voice streaming doesn't return content synchronously
      const response = await this.generateLLMResponse(messages, {
        temperature: 0.8,
        maxTokens: toolContext ? 300 : 200,
        textOnly: !!toolContext
      })

      const message = response.content || "I'm here to help you discover nature. What would you like to explore?"

      // Check if coordination with Archivist would help
      const coordinationRequest = this.shouldRequestCoordination(message, queryStr)

      print(`NaturalistAgent: Generated discovery response: "${message.substring(0, 50)}..."`)

      return this.createSuccessResponse(message, coordinationRequest)
    } catch (error) {
      print(`NaturalistAgent: ERROR - Discovery guidance failed: ${error}`)
      return this.createErrorResponse("I'm having trouble with that question. Could you tell me more about what you're observing?")
    }
  }

  /**
   * Update discovery state based on user input
   */
  private updateDiscoveryState(query: string): void {
    const lowerQuery = query.toLowerCase()

    // Track environmental awareness
    if (lowerQuery.includes("plant") || lowerQuery.includes("flower") || lowerQuery.includes("see")) {
      this.discoveryState.environmentNoticed = true
      this.discoveryState.plantsIdentified = true
    }

    // Track butterfly sightings
    if (
      lowerQuery.includes("butterfly") ||
      lowerQuery.includes("see one") ||
      lowerQuery.includes("spotted")
    ) {
      this.discoveryState.butterflySighted = true
      this.discoveryState.currentFocus = "observation"
    }

    // Track behavior observations
    if (lowerQuery.includes("fly") || lowerQuery.includes("move") || lowerQuery.includes("pattern")) {
      this.discoveryState.behaviorObservations.push(query)
      this.discoveryState.currentFocus = "discovery"
    }
  }

  /**
   * Determine if the nearby sightings tool should be activated for this query.
   */
  private shouldUseNearbySightings(query: string): boolean {
    if (!this.nearbySightingsTool) {
      print("NaturalistAgent: nearby_sightings tool not registered — dbManager not wired?")
      return false
    }
    const q = query.toLowerCase()

    // Must mention butterflies, species, or sightings — not just location
    const butterflyContext =
      q.includes("butterfly") ||
      q.includes("butterflies") ||
      q.includes("species") ||
      q.includes("sighting") ||
      q.includes("spotted") ||
      q.includes("monarch") ||
      q.includes("swallowtail") ||
      q.includes("seen any") ||
      q.includes("any around") ||
      q.includes("what's flying") ||
      q.includes("what is flying") ||
      q.includes("been found")

    // And must have a location signal
    const locationContext =
      q.includes("near") ||
      q.includes("around here") ||
      q.includes("from here") ||
      q.includes("in this area") ||
      q.includes("local") ||
      q.includes("close by") ||
      q.includes("close to me") ||
      q.includes("where") ||
      q.includes("find")

    const matches = butterflyContext && locationContext
    if (matches) {
      print(`NaturalistAgent: ✅ nearby_sightings keyword match on: "${q.substring(0, 60)}"`)
    }
    return matches
  }

  /**
   * Determine if Archivist coordination would enhance response
   */
  private shouldRequestCoordination(
    message: string,
    query: string
  ): {targetAgent: string; context: string; priority: number} | undefined {
    const lowerQuery = query.toLowerCase()

    // Request Archivist help for species identification
    if (
      this.discoveryState.butterflySighted &&
      (lowerQuery.includes("what kind") ||
        lowerQuery.includes("identify") ||
        lowerQuery.includes("what is"))
    ) {
      return {
        targetAgent: "archivist",
        context: `User has sighted a butterfly and is asking for identification. Query: "${query}"`,
        priority: 8
      }
    }

    // Request Archivist for interesting facts about observations
    if (this.discoveryState.behaviorObservations.length > 2) {
      return {
        targetAgent: "archivist",
        context: `User has made several behavior observations that could benefit from scientific context`,
        priority: 5
      }
    }

    return undefined
  }

  /**
   * Generate follow-up questions (Socratic approach)
   */
  protected generateFollowUps(): string[] {
    let followUps: string[] = []

    if (!this.discoveryState.environmentNoticed) {
      followUps.push("What kind of plants do you see around you?")
      followUps.push("Have you noticed any flowers that might attract butterflies?")
    } else if (!this.discoveryState.butterflySighted) {
      followUps.push("What patterns do you notice in how butterflies move?")
      followUps.push("Have you spotted any butterflies visiting the plants you mentioned?")
    } else {
      followUps.push("What do you notice about how this butterfly behaves?")
      followUps.push("Have you seen this butterfly interacting with any plants?")
      followUps.push("What questions does this observation raise for you?")
    }

    return followUps.slice(0, 3)
  }

  /**
   * Extract topics related to discovery
   */
  protected extractTopics(): string[] {
    const topics = []

    if (this.discoveryState.plantsIdentified) {
      topics.push("plant observation")
    }

    if (this.discoveryState.butterflySighted) {
      topics.push("butterfly observation")
    }

    if (this.discoveryState.behaviorObservations.length > 0) {
      topics.push("behavior patterns")
    }

    return topics.length > 0 ? topics : ["outdoor discovery", "observation techniques"]
  }
}
