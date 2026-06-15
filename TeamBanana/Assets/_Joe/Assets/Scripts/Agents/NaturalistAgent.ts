import {OutdoorAgent, IOutdoorAgent, OutdoorAgentResponse, AgentPersonality} from "./OutdoorAgent"
import {AgentLanguageInterface} from "./AgentLanguageInterface"
import {Tool} from "./AgentTypes"
import {GeneralConversationTool} from "../Tools/GeneralConversationTool"
import {NearbySightingsTool} from "../Tools/NearbySightingsTool"
import {ButterflyIdentificationTool, ButterflyIdentificationResult} from "../Tools/ButterflyIdentificationTool"
import {ButterflyIdentifier} from "_Aggy/Scripts/ButterflyIdentifier"
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
  private butterflyIdentificationTool: ButterflyIdentificationTool | null = null

  constructor(languageInterface: AgentLanguageInterface, dbManager?: SupabaseDBManager, mapManager?: NearbySightingManager, butterflyIdentifier?: ButterflyIdentifier) {
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

    // Register butterfly identification tool if ButterflyIdentifier is available
    if (butterflyIdentifier) {
      this.butterflyIdentificationTool = new ButterflyIdentificationTool(butterflyIdentifier)
      // Prefer Gemini's cached video frame so we never fight for the camera.
      this.butterflyIdentificationTool.getSharedFrame = () => this.languageInterface.getLatestFrame()
      // Fallback: pause/resume Gemini's video if we need to capture directly.
      this.butterflyIdentificationTool.onPauseVideo = () => this.languageInterface.pauseVideo()
      this.butterflyIdentificationTool.onResumeVideo = () => this.languageInterface.resumeVideo()
      this.registerTool({
        name: "butterfly_identification",
        description: "Take a photo and identify a butterfly species using AI-powered recognition",
        parameters: this.butterflyIdentificationTool.parameters,
        execute: (args: Record<string, unknown>) => this.butterflyIdentificationTool!.execute(args)
      })
      print("NaturalistAgent: 📸 Butterfly identification tool registered")
    }

    print("NaturalistAgent: 🌿 Gentle discovery guide initialized")
  }

  /**
   * Generate naturalist-specific system prompt
   */
  protected getSystemPrompt(): string {
    const caps = this.buildCapabilitiesSummary()
    return `You are a Naturalist guide helping someone discover butterflies and nature in their outdoor environment.

CRITICAL RULE — SPECIES IDENTIFICATION:
You CANNOT identify butterfly species from sight. You do not have visual recognition
capabilities. When the user asks "what is this butterfly" or similar, a specialist tool
runs and its result appears as [BUTTERFLY IDENTIFIED: ...] in the message. ONLY use that
tool result for the species name. If no [BUTTERFLY IDENTIFIED: ...] block is present,
NEVER guess or make up a species — instead guide the user with observation questions.

YOUR CAPABILITIES — When users ask "what can you do?" or similar, summarize from this list:
${caps}

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

RESPONSE STYLE — TWO MODES:
- FUNCTIONAL queries (e.g. "what can you do?", "close the map", "show my collection",
  "identify this", "scan for butterflies"): answer DIRECTLY. No questions, no follow-ups.
  Just give the information or confirm the action concisely.
- EXPLORATION queries (e.g. "what should I look for?", "I see something orange",
  "tell me about Monarchs", "where do butterflies live?"): use your full Socratic
  discovery style with observation questions and gentle guidance.

RESPONSE GUIDELINES:
- Keep responses under 300 characters for AR display
- For exploration: ask questions that encourage closer observation
- Celebrate user discoveries and insights
- Be patient and supportive
- Help users make connections between their observations

IMPORTANT: You are a guide, not a lecturer. Help the user discover for themselves through thoughtful questions and gentle direction — but only when they're actually exploring.`
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

      // Handle map-close command — same as archivist, in case routing sends it here
      if (this.shouldCloseMap(queryStr)) {
        this.nearbySightingsTool?.closeMap()
        return this.createSuccessResponse("Map closed! What would you like to discover next?")
      }

      // Update discovery state based on query
      this.updateDiscoveryState(queryStr)

      // Check if butterfly identification tool should be activated
      let toolContext = ""
      if (this.shouldUseButterflyIdentification(queryStr)) {
        print("NaturalistAgent: Activating butterfly_identification...")
        const idResult = await this.executeTool("butterfly_identification", {})
        if (idResult.success && idResult.result) {
          const result = idResult.result as ButterflyIdentificationResult
          const tool = this.butterflyIdentificationTool
          const idCapabilities = []
          if (this.tools.has("nearby_sightings")) idCapabilities.push("offer to check if others have been spotted nearby")
          const idHelp = idCapabilities.length > 0
            ? " After sharing the species, " + idCapabilities.join(" or ") + "."
            : ""
          toolContext = tool
            ? "\n\n[BUTTERFLY IDENTIFIED: " + tool.formatIdentificationSummary(result) + ". FIRST tell the user what species this is and one fascinating fact about it." + idHelp + " THEN if the user seems engaged in exploration, ask a Socratic question to deepen their observation.]"
            : "\n\n[BUTTERFLY IDENTIFIED: " + (result.commonName ?? result.scientificName ?? "Unknown") + ". FIRST tell the user what species this is." + idHelp + " THEN if appropriate, ask a question.]"
          print("NaturalistAgent: Butterfly identification result integrated into response")
        }
      }

      // Check if nearby sightings tool should be activated
      if (!toolContext && this.shouldUseNearbySightings(queryStr)) {
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
          const nearbyCapabilities = []
          if (this.tools.has("butterfly_identification")) nearbyCapabilities.push("offer to identify a butterfly they spot")
          const nearbyHelp = nearbyCapabilities.length > 0
            ? " After stating the results, " + nearbyCapabilities.join(" or ") + "."
            : ""
          toolContext = tool
            ? "\n\n[NEARBY SIGHTINGS: " + tool.formatSightingsSummary(result) + "." + nearbyHelp + "]"
            : "\n\n[NEARBY SIGHTINGS: " + result.count + " sightings found within " + result.radius + " " + result.unit + "." + nearbyHelp + "]"
          print("NaturalistAgent: Nearby sightings tool result integrated into response")
        }
      }

      // Generate response with Socratic approach, including tool context
      const enhancedQuery = toolContext ? queryStr + toolContext : queryStr
      const messages = this.buildMessages(enhancedQuery, context)
      // Always use voice/audio — tool context is embedded in the enhanced query
      // and will be spoken naturally by the Realtime API.
      const response = await this.generateLLMResponse(messages, {
        temperature: 0.8,
        maxTokens: toolContext ? 300 : 200
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
   * Check if user wants to close the AR map.
   * Same robust word-level matching as ArchivistAgent.
   */
  private shouldCloseMap(query: string): boolean {
    const q = query.toLowerCase()
    const exactPhrases = ["close the map", "hide the map", "dismiss the map", "close map", "hide map", "remove the map", "clear the map", "shut the map"]
    if (exactPhrases.some((w) => q.includes(w))) return true
    const closeWords = ["close", "hide", "dismiss", "remove", "clear", "shut"]
    const mapWords = ["map", "minimap", "mini map"]
    const hasClose = closeWords.some((w) => q.includes(w))
    const hasMap = mapWords.some((w) => q.includes(w))
    return hasClose && hasMap
  }

  /**
   * Determine if the butterfly identification tool should be activated for this query.
   * Triggers when user asks to identify a specific butterfly they are looking at.
   */
  private shouldUseButterflyIdentification(query: string): boolean {
    if (!this.butterflyIdentificationTool) return false
    const q = query.toLowerCase()

    // Must be asking for identification of a specific, present butterfly.
    // Match on word presence rather than exact phrases — handles "what butterfly is this" etc.
    const idWords = [
      "identify", "what is this", "what is that", "what kind", "what species",
      "what type", "which one", "which species", "can you tell", "what's this",
      "what's that", "name this", "name that"
    ]
    const hasIdIntent = idWords.some((w) => q.includes(w))
    // Match "what/where/which ... butterfly" patterns (ASR often confuses "what" ↔ "where")
    const hasIdButterfly = (q.includes("what") || q.includes("where") || q.includes("which")) && (q.includes("butterfly") || q.includes("butterfl"))

    const idContext = hasIdIntent || hasIdButterfly

    // And must be about a present/visible subject (this/that/here/I see)
    const presentWords = [
      "this", "that", "here", "right now", "in front", "looking at",
      "i see", "there's", "there is", "spotted", "just saw", "just seen"
    ]
    const presentContext = presentWords.some((w) => q.includes(w))

    const matches = idContext && presentContext
    if (matches) {
      print(`NaturalistAgent: 📸 butterfly_identification match on: "${q.substring(0, 60)}"`)
    }
    return matches
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

  /**
   * Build a summary of currently registered tools for the system prompt.
   * Lets the LLM accurately describe its capabilities when users ask.
   */
  private buildCapabilitiesSummary(): string {
    const tools: string[] = []
    if (this.tools.has("butterfly_identification")) {
      tools.push("- Identify butterflies: point your camera at a butterfly and ask 'what is this?' — I'll help identify the species.")
    }
    if (this.tools.has("nearby_sightings")) {
      tools.push("- Nearby sightings: ask 'what butterflies have been spotted near me?' — I'll show what others have found on an AR map.")
    }
    tools.push("- Discovery guidance: ask 'what should I look for?' or 'where should I look?' — I'll guide your observations with thoughtful questions.")
    tools.push("- Nature knowledge: ask me about plants, habitats, butterfly behavior, or anything nature-related.")
    if (tools.length === 2) {
      return "(No specialist tools available — discovery guidance and general nature knowledge only.)\n" + tools.join("\n")
    }
    return tools.join("\n")
  }
}
