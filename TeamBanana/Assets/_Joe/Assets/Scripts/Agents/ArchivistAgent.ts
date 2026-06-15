import {OutdoorAgent, IOutdoorAgent, OutdoorAgentResponse, AgentPersonality} from "./OutdoorAgent"
import {AgentLanguageInterface} from "./AgentLanguageInterface"
import {Tool} from "./AgentTypes"
import {GeneralConversationTool} from "../Tools/GeneralConversationTool"
import {NearbySightingsTool} from "../Tools/NearbySightingsTool"
import {ButterflyIdentificationTool, ButterflyIdentificationResult} from "../Tools/ButterflyIdentificationTool"
import {ButterflyDetectionTool, ButterflyDetectionResult} from "../Tools/ButterflyDetectionTool"
import {ButterflyIdentifier} from "_Aggy/Scripts/ButterflyIdentifier"
import {MockButterflyKnowledge} from "../Knowledge/MockButterflyKnowledge"
import {SupabaseDBManager} from "_Boon/SupabaseInfoStoring&Retrieving/Scripts/SupabaseDBManager"
import {NearbySightingManager} from "_Boon/NearbySighting/Scripts/NearbySightingManager"
import {MLSpatializer} from "_Aggy/Scripts/MLSpatializer"
import {FlyingButterflyManager} from "_Boon/ButterflyMovement/Scripts/FlyingButterflyManager"
import {ButterflyCollectionTool} from "../Tools/ButterflyCollectionTool"

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
  private nearbySightingsTool: NearbySightingsTool | null = null
  private butterflyIdentificationTool: ButterflyIdentificationTool | null = null
  private butterflyDetectionTool: ButterflyDetectionTool | null = null
  private butterflyCollectionTool: ButterflyCollectionTool | null = null

  constructor(languageInterface: AgentLanguageInterface, dbManager?: SupabaseDBManager, mapManager?: NearbySightingManager, butterflyIdentifier?: ButterflyIdentifier, mlSpatializer?: MLSpatializer, flyingButterflyManager?: FlyingButterflyManager) {
    super(languageInterface)

    // Initialize knowledge base
    this.knowledgeBase = new MockButterflyKnowledge()

    // Initialize general conversation tool as fallback
    this.generalConversationTool = new GeneralConversationTool(languageInterface)
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
        return await this.generalConversationTool.execute(args)
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
      print("ArchivistAgent: 🦋 Nearby sightings tool registered")
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
      print("ArchivistAgent: 📸 Butterfly identification tool registered")
    }

    // Register butterfly detection tool if MLSpatializer is available.
    // Pass the identification tool so detection can auto-trigger ID when butterflies are found.
    if (mlSpatializer) {
      this.butterflyDetectionTool = new ButterflyDetectionTool(mlSpatializer, this.butterflyIdentificationTool)
      this.registerTool({
        name: "butterfly_detection",
        description: "Scan for butterflies using the camera for 10 seconds. If butterflies are found, automatically identify the species.",
        parameters: this.butterflyDetectionTool.parameters,
        execute: (args: Record<string, unknown>) => this.butterflyDetectionTool!.execute(args)
      })
      print("ArchivistAgent: 🔍 Butterfly detection tool registered")
    }

    // Register butterfly collection tool if dbManager is available
    if (dbManager) {
      this.butterflyCollectionTool = new ButterflyCollectionTool(dbManager, flyingButterflyManager)
      this.registerTool({
        name: "butterfly_collection",
        description: "Show the user's personal butterfly collection — every butterfly they've identified and saved",
        parameters: this.butterflyCollectionTool.parameters,
        execute: (args: Record<string, unknown>) => this.butterflyCollectionTool!.execute(args)
      })
      print("ArchivistAgent: 🦋 Butterfly collection tool registered")
    }

    print("ArchivistAgent: 📚 Enthusiastic storyteller initialized")
  }

  /**
   * Generate archivist-specific system prompt
   */
  protected getSystemPrompt(): string {
    const caps = this.buildCapabilitiesSummary()
    return `You are an Archivist - a passionate storyteller and expert on butterflies and their fascinating world.

CRITICAL RULE — SPECIES IDENTIFICATION:
You CANNOT identify butterfly species from sight. You do not have visual recognition
capabilities. When the user asks "what is this butterfly" or similar, a specialist tool
runs and its result appears as [BUTTERFLY IDENTIFIED: ...] in the message. ONLY use that
tool result for the species name. If no [BUTTERFLY IDENTIFIED: ...] block is present,
NEVER guess or make up a species — instead say "Let me take a closer look..." and encourage
the user's observation.

YOUR CAPABILITIES — When users ask "what can you do?" or similar, summarize from this list:
${caps}

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

RESPONSE STYLE — TWO MODES:
- FUNCTIONAL queries (e.g. "what can you do?", "close the map", "show my collection",
  "identify this", "scan for butterflies"): answer DIRECTLY. No stories, no follow-up
  questions. Just give the information or confirm the action concisely.
- EXPLORATION queries (e.g. "tell me about Monarchs", "why are wings colorful?",
  "I spotted a butterfly", "how do they migrate?"): use your full enthusiastic
  storyteller style with fascinating facts and engaging narratives.

RESPONSE GUIDELINES:
- Keep responses under 300 characters for AR display
- For exploration: share at least one fascinating fact or story
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

    // Map / collection UI control — high confidence so routing doesn't
    // fall back to naturalist (which lacks close-map handling).
    if (this.shouldCloseMap(query) || this.shouldCloseCollection(query)) {
      confidence += 0.5
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

      const queryStr = query as string

      // Check for species mentions to enhance knowledge
      const speciesInfo = this.knowledgeBase.identifySpeciesInQuery(queryStr)
      if (speciesInfo) {
        this.storyState.lastSpeciesMentioned = speciesInfo
      }

      // Check if user wants to close the map
      if (this.shouldCloseMap(queryStr)) {
        this.nearbySightingsTool?.closeMap()
        return this.createSuccessResponse("Map closed! What would you like to discover next?")
      }

      // Check if user wants to hide the butterfly collection
      if (this.shouldCloseCollection(queryStr)) {
        if (this.butterflyCollectionTool?.clearButterflies()) {
          return this.createSuccessResponse("Butterflies cleared! Ready for new discoveries.")
        }
        return this.createSuccessResponse("No collection butterflies to hide.")
      }

      // Check if butterfly identification tool should be activated
      let toolContext = ""
      if (this.shouldUseButterflyIdentification(queryStr)) {
        print("ArchivistAgent: Activating butterfly_identification...")
        const idResult = await this.executeTool("butterfly_identification", {})
        if (idResult.success && idResult.result) {
          const result = idResult.result as ButterflyIdentificationResult
          const tool = this.butterflyIdentificationTool
          toolContext = tool
            ? "\n\n[BUTTERFLY IDENTIFIED: " + tool.formatIdentificationSummary(result) + ". Share this enthusiastically — tell the user what species it is and a fascinating fact or story about it.]"
            : "\n\n[BUTTERFLY IDENTIFIED: " + (result.commonName ?? result.scientificName ?? "Unknown") + ". Share what it is with enthusiasm.]"
          print("ArchivistAgent: Butterfly identification result integrated into response")
        } else {
          // Tool failed — explicitly tell the LLM NOT to guess.
          print("ArchivistAgent: Butterfly identification FAILED — " + (idResult.error ?? "unknown error"))
          toolContext = "\n\n[NO IDENTIFICATION AVAILABLE — the camera could not capture a frame. DO NOT guess or make up a species. Tell the user you couldn't get a clear look and ask them to try again or describe what they see.]"
        }
      }

      // Check if butterfly detection tool should be activated
      if (!toolContext && this.shouldUseButterflyDetection(queryStr)) {
        print("ArchivistAgent: Activating butterfly_detection (10s scan + auto-ID)...")
        const detResult = await this.executeTool("butterfly_detection", {
          scanDurationMs: 10000,
          maxDetections: 5,
          autoIdentify: true
        })
        if (detResult.success && detResult.result) {
          const result = detResult.result as ButterflyDetectionResult
          const tool = this.butterflyDetectionTool
          // Auto-ID runs inside the detection tool — include both detection + ID in context.
          const summary = tool
            ? tool.formatDetectionSummary(result)
            : result.message
          const detCapabilities = []
          if (result.identification?.scientificName && this.tools.has("butterfly_collection")) detCapabilities.push("mention they can view their collection")
          if (!result.identification?.scientificName && this.tools.has("butterfly_identification")) detCapabilities.push("offer to identify one up close")
          if (this.tools.has("nearby_sightings")) detCapabilities.push("offer to check nearby sightings")
          const detHelp = detCapabilities.length > 0
            ? " After stating the result, " + detCapabilities.slice(0, 2).join(" or ") + "."
            : ""
          toolContext = "\n\n[BUTTERFLY DETECTION: " + summary + detHelp + "]"
          print("ArchivistAgent: Butterfly detection result integrated into response" +
            (result.identification?.scientificName ? " (with ID: " + (result.identification.commonName ?? result.identification.scientificName) + ")" : ""))
        }
      }

      // Check if butterfly collection should be shown
      if (!toolContext && this.shouldUseButterflyCollection(queryStr)) {
        print("ArchivistAgent: Activating butterfly_collection...")
        const colResult = await this.executeTool("butterfly_collection", { maxButterflies: 10 })
        if (colResult.success && colResult.result) {
          const colCapabilities = []
          if (this.tools.has("nearby_sightings")) colCapabilities.push("offer to find more nearby")
          if (this.tools.has("butterfly_identification")) colCapabilities.push("offer to identify a new one")
          const colHelp = colCapabilities.length > 0
            ? " After stating the collection, " + colCapabilities.join(" or ") + "."
            : ""
          toolContext = "\n\n[BUTTERFLY COLLECTION: " + colResult.result.message + colHelp + "]"
          print("ArchivistAgent: Butterfly collection result integrated into response")
        }
      }

      // Check if nearby sightings tool should be activated
      if (!toolContext && this.shouldUseNearbySightings(queryStr)) {
        print("ArchivistAgent: Activating nearby_sightings...")
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
          if (this.tools.has("butterfly_identification")) nearbyCapabilities.push("offer to identify one")
          if (this.tools.has("butterfly_detection")) nearbyCapabilities.push("offer to scan for butterflies")
          const nearbyHelp = nearbyCapabilities.length > 0
            ? " After stating the results, " + nearbyCapabilities.join(" or ") + "."
            : ""
          toolContext = tool
            ? "\n\n[NEARBY SIGHTINGS: " + tool.formatSightingsSummary(result) + "." + nearbyHelp + "]"
            : "\n\n[NEARBY SIGHTINGS: " + result.count + " sightings found within " + result.radius + " " + result.unit + "." + nearbyHelp + "]"
          print("ArchivistAgent: Nearby sightings tool result integrated into response")
        }
      }

      // Enhance query with knowledge base context + tool context
      let enhancedQuery = this.enhanceQueryWithKnowledge(queryStr, speciesInfo)
      if (toolContext) enhancedQuery += toolContext

      // Generate response with storytelling approach
      const messages = this.buildMessages(enhancedQuery, context)
      const response = await this.generateLLMResponse(messages, {
        temperature: 0.9, // Higher for more creative storytelling
        maxTokens: toolContext ? 350 : 250,
        // Always use voice/audio — tool context (butterfly ID result) is part of
        // the enhanced query and will be spoken naturally by the Realtime API.
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
  /**
   * Determine if the butterfly identification tool should be activated for this query.
   * Triggers when user asks to identify a specific butterfly they are looking at.
   */
  private shouldCloseMap(query: string): boolean {
    const q = query.toLowerCase()
    // Exact phrase match (most reliable)
    const exactPhrases = ["close the map", "hide the map", "dismiss the map", "close map", "hide map", "remove the map", "clear the map", "shut the map"]
    if (exactPhrases.some((w) => q.includes(w))) return true
    // Word-level AND match — handles ASR variations like "can you close that map please"
    const closeWords = ["close", "hide", "dismiss", "remove", "clear", "shut"]
    const mapWords = ["map", "minimap", "mini map"]
    const hasClose = closeWords.some((w) => q.includes(w))
    const hasMap = mapWords.some((w) => q.includes(w))
    return hasClose && hasMap
  }

  private shouldCloseCollection(query: string): boolean {
    const q = query.toLowerCase()
    return [
      "hide my collection", "hide the butterflies", "hide butterflies",
      "clear my collection", "clear butterflies", "clear the butterflies",
      "remove butterflies", "remove the butterflies", "dismiss collection",
      "hide collection", "close collection"
    ].some((w) => q.includes(w))
  }

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
      print(`ArchivistAgent: 📸 butterfly_identification match on: "${q.substring(0, 60)}"`)
    }
    return matches
  }

  /**
   * Determine if the butterfly detection tool should be activated for this query.
   * Triggers when user asks to spot, find, or look for butterflies through the camera.
   */
  private shouldUseButterflyDetection(query: string): boolean {
    print(`ArchivistAgent: 🔍 butterfly_detection check — tool registered: ${!!this.butterflyDetectionTool}, query: "${query.substring(0, 60)}"`)
    if (!this.butterflyDetectionTool) return false
    const q = query.toLowerCase()

    // Action words that indicate the user wants us to LOOK through the camera
    const detectionActions = [
      "spot", "find", "see", "look", "detect", "search",
      "show me", "point out", "help", "locate", "scan"
    ]
    const hasDetectionAction = detectionActions.some((w) => q.includes(w))

    // Must mention butterflies (explicitly — "see" alone isn't enough)
    const mentionsButterfly =
      q.includes("butterfly") || q.includes("butterflies") || q.includes("butterfl")

    // Explicit phrases that are strong signals (camera-based detection only — NO location words)
    const detectionPhrases = [
      "do you see", "can you see", "can you spot", "do you spot",
      "help me find", "help me spot", "help find", "help spot",
      "help me scan", "scan for butterflies", "scan for",
      "spot any", "see any", "find any", "look for",
      "any butterflies", "any butterfly", "what do you see",
      "what's visible", "what is visible",
      "looking for", "scan the area",
      "in my view", "in view"
    ]
    const hasDetectionPhrase = detectionPhrases.some((w) => q.includes(w))

    const matches = mentionsButterfly && (hasDetectionAction || hasDetectionPhrase)
    if (matches) {
      print(`ArchivistAgent: 🔍 butterfly_detection match on: "${q.substring(0, 60)}"`)
    }
    return matches
  }

  /**
   * Determine if the nearby sightings tool should be activated for this query.
   */
  private shouldUseNearbySightings(query: string): boolean {
    if (!this.nearbySightingsTool) {
      print("ArchivistAgent: nearby_sightings tool not registered — dbManager not wired?")
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
      q.includes("been found") ||
      q.includes("live around")

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
      q.includes("find") ||
      q.includes("anyone")

    const matches = butterflyContext && locationContext
    if (matches) {
      print(`ArchivistAgent: ✅ nearby_sightings keyword match on: "${q.substring(0, 60)}"`)
    }
    return matches
  }

  /**
   * Determine if the butterfly collection tool should be activated.
   */
  private shouldUseButterflyCollection(query: string): boolean {
    if (!this.butterflyCollectionTool) return false
    const q = query.toLowerCase()

    const collectionWords = [
      "my collection", "my butterflies", "butterfly collection",
      "show me my", "what have i collected", "collected so far",
      "butterflies i've seen", "butterflies i have", "my sightings"
    ]
    const matches = collectionWords.some((w) => q.includes(w))
    if (matches) {
      print(`ArchivistAgent: 🦋 butterfly_collection match on: "${q.substring(0, 60)}"`)
    }
    return matches
  }

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

  /**
   * Build a summary of currently registered tools for the system prompt.
   * Lets the LLM accurately describe its capabilities when users ask.
   */
  private buildCapabilitiesSummary(): string {
    const tools: string[] = []
    if (this.tools.has("butterfly_identification")) {
      tools.push("- Identify butterflies: point your camera at a butterfly and ask 'what is this?' — I'll identify the species, show an info card, and spawn a 3D butterfly.")
    }
    if (this.tools.has("butterfly_detection")) {
      tools.push("- Scan for butterflies: say 'help me scan for butterflies' — I'll look through the camera for 10 seconds and automatically identify any I find.")
    }
    if (this.tools.has("nearby_sightings")) {
      tools.push("- Nearby sightings: ask 'what butterflies have been spotted near me?' — I'll show you on an AR map what others have found in your area.")
    }
    if (this.tools.has("butterfly_collection")) {
      tools.push("- Your collection: say 'show me my collection' — I'll bring your collected butterflies to life as 3D models around you.")
    }
    tools.push("- Butterfly knowledge: ask me anything about butterflies — life cycles, migration, conservation, fascinating facts. I love sharing stories!")
    if (tools.length === 1) {
      return "(No specialist tools available — general conversation and butterfly knowledge only.)\n" + tools.join("\n")
    }
    return tools.join("\n")
  }
}
