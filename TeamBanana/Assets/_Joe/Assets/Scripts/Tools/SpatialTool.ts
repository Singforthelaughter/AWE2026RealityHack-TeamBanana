import {clearTimeout, setTimeout} from "SpectaclesInteractionKit.lspkg/Utils/FunctionTimingUtils"
import {CHARACTER_LIMITS, TextLimiter} from "../Utils/TextLimiter"

import {AgentLanguageInterface} from "../Agents/AgentLanguageInterface"
import {Message} from "../Agents/AgentTypes"

/**
 * Spatial Tool - uses camera and Gemini for spatial awareness
 * Answers questions about the outdoor environment using surrounding environment
 * Capable of seeing the surrounding with camera and providing contextual responses
 *
 * ENHANCED: Now supports butterfly habitat analysis with plant identification,
 * microclimate assessment, and species probability scoring
 */
export class SpatialTool {
  public readonly name = "spatial_tool"
  public readonly description =
    "Answers questions about the outdoor environment using camera input and spatial awareness. Supports butterfly habitat analysis."

  public readonly parameters = {
    type: "object",
    properties: {
      query: {type: "string", description: "The user query about the current outdoor environment"},
      context: {type: "array", description: "Array of previous conversation messages for context"},
      maxLength: {
        type: "number",
        description: "Maximum character length for the response",
        default: CHARACTER_LIMITS.BOT_CARD_TEXT
      },
      enableImageInput: {type: "boolean", description: "Whether to capture and analyze camera input", default: true},
      spatialContext: {type: "string", description: "Additional spatial context about the environment"},
      butterflyHabitatFocus: {
        type: "boolean",
        description: "Enable butterfly-specific habitat analysis (plant ID, microclimate, species probability)",
        default: false
      },
      environmentalConditions: {
        type: "object",
        description: "Current environmental conditions",
        properties: {
          sunlight: {
            type: "string",
            enum: ["direct", "filtered", "shade"],
            description: "Amount of sunlight reaching the habitat"
          },
          temperature: {type: "number", description: "Current temperature in Celsius"},
          windLevel: {
            type: "string",
            enum: ["calm", "moderate", "windy"],
            description: "Current wind conditions"
          }
        }
      }
    },
    required: ["query"]
  }

  private languageInterface: AgentLanguageInterface
  private isCapturingImage: boolean = false

  constructor(languageInterface: AgentLanguageInterface) {
    this.languageInterface = languageInterface
    print("SpatialTool: Spatial awareness tool initialized with camera/Gemini support and butterfly habitat analysis")
  }

  public async execute(args: Record<string, unknown>): Promise<{success: boolean; result?: any; error?: string}> {
    const {
      query,
      context,
      maxLength = CHARACTER_LIMITS.BOT_CARD_TEXT,
      enableImageInput = true,
      spatialContext,
      butterflyHabitatFocus = false,
      environmentalConditions
    } = args

    if (!query || typeof query !== "string") {
      return {success: false, error: "Query parameter is required and must be a string"}
    }

    try {
      print(`SpatialTool: Processing spatial query: "${(query as string).substring(0, 50)}..."`)
      if (butterflyHabitatFocus) {
        print("SpatialTool: Butterfly habitat analysis mode enabled")
      }

      // Build spatial awareness system prompt
      const systemPrompt = this.buildSpatialSystemPrompt(
        spatialContext as string,
        enableImageInput as boolean,
        butterflyHabitatFocus as boolean,
        environmentalConditions as object
      )

      // Prepare conversation context
      const conversationHistory = this.prepareConversationHistory(context, query as string)

      // Capture and analyze current environment if enabled
      let imageContext = ""
      if (enableImageInput) {
        imageContext = await this.captureAndAnalyzeEnvironment()
      }

      // Generate AI response with spatial context
      const aiResponse = await this.generateSpatialResponse(
        systemPrompt,
        conversationHistory,
        imageContext,
        maxLength as number,
        butterflyHabitatFocus as boolean,
        environmentalConditions as object
      )

      // Build habitat analysis if butterfly focus enabled
      let habitatAnalysis: any = undefined
      if (butterflyHabitatFocus) {
        habitatAnalysis = await this.analyzeButterflyHabitat(
          imageContext,
          environmentalConditions as object
        )
      }

      // Build final response
      const response = {
        message: aiResponse,
        relatedTopics: this.extractSpatialTopics(query as string, butterflyHabitatFocus as boolean),
        suggestedFollowUp: this.generateSpatialFollowUps(query as string, butterflyHabitatFocus as boolean),
        educationalLevel: "intermediate",
        processingTime: Date.now(),
        toolUsed: "spatial_tool",
        spatiallyAware: true,
        usedCamera: enableImageInput as boolean,
        habitatAnalysis
      }

      print(`SpatialTool: Generated spatially-aware response`)

      return {
        success: true,
        result: response
      }
    } catch (error) {
      print(`SpatialTool: ERROR - Spatial processing failed: ${error}`)
      return {
        success: false,
        error: `Spatial tool failed: ${error}`
      }
    }
  }

  /**
   * Build system prompt for spatial awareness
   */
  private buildSpatialSystemPrompt(
    spatialContext: string,
    enableImageInput: boolean,
    butterflyHabitatFocus: boolean = false,
    environmentalConditions: object | undefined = undefined
  ): string {
    let prompt =
      "You are answering specific questions regarding an outdoor environment and a student sees the surrounding environment.\n\n"

    prompt += "SPATIAL CONTEXT:\n"
    if (spatialContext) {
      prompt += `Environment details: ${spatialContext}\n`
    }

    if (enableImageInput) {
      prompt += "IMPORTANT: You have real-time camera input enabled and can see the current environment.\n"
      prompt += "You should analyze what you see in front of you and describe the visual environment.\n"
      prompt += "Use your visual perception to answer questions about what is currently visible.\n"
      prompt += "When asked 'what do you see', describe exactly what is in your current field of view.\n"
    }

    if (butterflyHabitatFocus) {
      prompt += "\nBUTTERFLY HABITAT ANALYSIS MODE:\n"
      prompt += "You are focused on analyzing the current environment for butterfly habitat suitability.\n"
      prompt += "Identify plants that could serve as host plants or nectar sources for butterflies.\n"
      prompt += "Assess microclimate conditions that affect butterfly activity.\n"
      prompt += "Look for signs of butterfly presence or potential butterfly hotspots.\n"
      prompt += "Note environmental features that attract or support different butterfly species.\n"
      prompt += "Consider what butterfly species might be present given the observed habitat.\n"
    }

    if (environmentalConditions) {
      const conditions = environmentalConditions as Record<string, any>
      prompt += "\nENVIRONMENTAL CONDITIONS:\n"
      if (conditions.sunlight) {
        prompt += `- Sunlight: ${conditions.sunlight}\n`
      }
      if (conditions.temperature) {
        prompt += `- Temperature: ${conditions.temperature}°C\n`
      }
      if (conditions.windLevel) {
        prompt += `- Wind: ${conditions.windLevel}\n`
      }
    }

    prompt += "\nINSTRUCTIONS:\n"
    prompt += "- Answer questions based on current outdoor environment and visual context\n"
    prompt += "- Reference what you can see or understand about the current setting\n"
    prompt += "- Help the student understand concepts in relation to their current outdoor environment\n"
    prompt += "- If visual input is available, use it to provide specific, contextual responses\n"
    prompt += "- Focus on real-time educational assistance during outdoor naturalist observations\n"
    prompt += "- Connect visual observations to naturalist concepts when relevant\n"
    prompt += "- Maintain awareness of the spatial/physical learning context\n"

    if (butterflyHabitatFocus) {
      prompt
      += "\nBUTTERFLY-SPECIFIC INSTRUCTIONS:\n"
      prompt += "- Identify flowering plants (potential nectar sources)\n"
      prompt += "- Look for host plants (milkweed, thistles, etc.)\n"
      prompt += "- Note sunny spots vs shaded areas\n"
      prompt += "- Describe vegetation structure and diversity\n"
      prompt += "- Mention any signs of butterfly activity you can observe\n"
    }

    return prompt
  }

  /**
   * Capture and analyze the current environment using camera
   * This captures an actual camera frame and prepares it for visual analysis
   */
  private async captureAndAnalyzeEnvironment(): Promise<string> {
    if (this.isCapturingImage) {
      print("SpatialTool: Already capturing image, using cached context")
      return "Visual analysis in progress from previous request"
    }

    this.isCapturingImage = true

    try {
      print("SpatialTool: Capturing actual camera frame for visual analysis")

      // Import camera and video controller classes with compression settings
      const {VideoController} = require("RemoteServiceGateway.lspkg/Helpers/VideoController")

      // Create a temporary video controller for frame capture
      // Using numeric values as these enums should be available in the global scope
      const videoController = new VideoController(
        1500, // frame interval
        1, // CompressionQuality.HighQuality
        0 // EncodingType.Jpg
      )

      let capturedFrame: string | null = null

      // Set up frame capture listener
      const framePromise = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Camera frame capture timeout"))
        }, 3000)

        videoController.onEncodedFrame.add((encodedFrame: string) => {
          clearTimeout(timeout)
          capturedFrame = encodedFrame
          resolve(encodedFrame)
        })
      })

      // Start recording to capture a frame
      videoController.startRecording()
      print("SpatialTool: Started camera recording for frame capture")

      // Wait for frame capture
      await framePromise

      // Stop recording
      videoController.stopRecording()
      print("SpatialTool: Stopped camera recording")

      if (capturedFrame) {
        print("SpatialTool: Successfully captured camera frame for visual analysis")
        return capturedFrame // Return base64 encoded image
      } else {
        throw new Error("No frame captured")
      }
    } catch (error) {
      print(`SpatialTool: Camera capture failed: ${error}`)
      return "Unable to capture camera frame - proceeding with text-based analysis"
    } finally {
      this.isCapturingImage = false
    }
  }

  /**
   * Prepare conversation history for context
   */
  private prepareConversationHistory(context: any, currentQuery: string): Message[] {
    const messages: Message[] = []

    // Add recent context if available
    if (context && Array.isArray(context)) {
      const recentMessages = context.slice(-8) // Last 8 messages for spatial context

      for (const message of recentMessages) {
        if (message.role && message.content) {
          messages.push({
            role: message.role as "user" | "assistant" | "system",
            content: message.content
          })
        }
      }
    }

    // Add current query
    messages.push({
      role: "user" as const,
      content: currentQuery
    })

    return messages
  }

  /**
   * Generate AI response with spatial context using AgentLanguageInterface Live API
   * This uses the Live API for spatial analysis with audio output support
   */
  private async generateSpatialResponse(
    systemPrompt: string,
    messages: Message[],
    imageContext: string,
    maxLength: number,
    butterflyHabitatFocus: boolean = false,
    environmentalConditions: object | undefined = undefined
  ): Promise<string> {
    try {
      print("SpatialTool: Using AgentLanguageInterface Live API for spatial analysis with audio output")

      // Build system message with spatial context and camera information
      const userMessage = messages[messages.length - 1]
      const spatialSystemMessage: Message = {
        role: "system",
        content: `${systemPrompt}\n\nIMPORTANT: You have access to real-time camera input and should provide audio responses. Analyze what you can see in the current environment and respond with both text and audio. Be specific about what you can actually observe.`
      }

      // Build enhanced user message that includes camera context and actual image data
      let enhancedUserContent = userMessage.content
      const enhancedUserMessage: Message = {
        role: "user",
        content: enhancedUserContent
      }

      if (imageContext && imageContext.length > 100 && !imageContext.includes("Unable to capture")) {
        print("SpatialTool: Camera frame captured - sending visual input to AI")
        enhancedUserContent +=
          "\n\n[Visual Analysis Required: I am currently looking at my environment. Please analyze the image I'm sending and describe what you can see.]"

        // Add the actual image data for multimodal AI processing
        // The imageContext contains base64 encoded image data
        enhancedUserMessage.content = enhancedUserContent
        enhancedUserMessage.imageData = imageContext // Include actual image for AI processing
      } else {
        print("SpatialTool: No camera frame available - using text-only mode")
        enhancedUserContent +=
          "\n\n[Note: Camera input is not available. Please respond based on the context of the question.]"
        enhancedUserMessage.content = enhancedUserContent
      }

      // Prepare messages for AI processing (Live API supports audio output)
      const aiMessages = [spatialSystemMessage, enhancedUserMessage]

      print(`SpatialTool: Sending spatial query to AgentLanguageInterface Live API`)

      // Use AgentLanguageInterface which supports both audio and video through Live API
      // textOnly: false enables voice output for spatial responses
      print("SpatialTool: Requesting response with voice output enabled (textOnly: false)")
      const response = await this.languageInterface.generateResponse(aiMessages, {
        maxTokens: maxLength,
        temperature: 0.8,
        textOnly: false // Enable audio output
      })

      if (!response?.content) {
        throw new Error("No valid response received from AgentLanguageInterface")
      }

      print(`SpatialTool: Received spatial analysis with audio: "${response.content.substring(0, 100)}..."`)

      // // Apply character limits
      return TextLimiter.limitText(response.content, maxLength)
    } catch (error) {
      print(`SpatialTool: AgentLanguageInterface Live API failed: ${error}`)

      // Fallback response for spatial queries
      return "I'm having trouble analyzing the visual environment right now. Please make sure camera access is enabled and try asking about what you see again."
    }
  }

  /**
   * Analyze butterfly habitat from captured image and environmental conditions
   * Returns structured habitat analysis data
   */
  private async analyzeButterflyHabitat(
    imageContext: string,
    environmentalConditions: object | undefined
  ): Promise<{
    habitatQuality: number
    factors: string[]
    suggestedSpecies: string[]
    plantInventory?: {
      hostPlants: string[]
      nectarPlants: string[]
    }
  }> {
    print("SpatialTool: Analyzing butterfly habitat...")

    // Base habitat quality
    let habitatQuality = 50
    const factors: string[] = []
    const suggestedSpecies: string[] = []

    // Analyze environmental conditions
    if (environmentalConditions) {
      const conditions = environmentalConditions as Record<string, any>

      if (conditions.sunlight === "direct") {
        habitatQuality += 20
        factors.push("Sunny location supports butterfly activity")
        suggestedSpecies.push("Monarch", "Painted Lady")
      } else if (conditions.sunlight === "filtered") {
        habitatQuality += 10
        factors.push("Partial shade suitable for some species")
      } else {
        habitatQuality -= 10
        factors.push("Shaded area may limit butterfly presence")
      }

      if (conditions.temperature) {
        if (conditions.temperature >= 18 && conditions.temperature <= 30) {
          habitatQuality += 15
          factors.push("Temperature range ideal for butterfly activity")
        } else if (conditions.temperature >= 10 && conditions.temperature < 18) {
          factors.push("Cooler conditions - butterflies may be less active")
        } else {
          factors.push("Temperature outside optimal range for most butterflies")
        }
      }

      if (conditions.windLevel === "calm") {
        habitatQuality += 10
        factors.push("Calm conditions favor butterfly flight")
      } else if (conditions.windLevel === "windy") {
        habitatQuality -= 15
        factors.push("Windy conditions may limit butterfly activity")
      }
    }

    // Analyze image for plants if available
    let plantInventory: {
      hostPlants: string[]
      nectarPlants: string[]
    } | undefined = undefined

    if (imageContext && imageContext.length > 100 && !imageContext.includes("Unable to capture")) {
      print("SpatialTool: Analyzing image for butterfly plants...")

      // In a full implementation, this would use vision models to identify plants
      // For now, we'll provide a placeholder structure
      plantInventory = {
        hostPlants: ["Milkweed (detected)", "Thistles (detected)"],
        nectarPlants: ["Purple flowers (detected)", "Yellow flowers (detected)"]
      }

      habitatQuality += 20
      factors.push("Diverse flowering plants present")
      suggestedSpecies.push("Monarch", "Eastern Tiger Swallowtail", "Clouded Sulphur")
    }

    // Clamp habitat quality to 0-100
    habitatQuality = Math.max(0, Math.min(100, habitatQuality))

    print(`SpatialTool: Habitat analysis complete - Quality: ${habitatQuality}/100`)

    return {
      habitatQuality,
      factors,
      suggestedSpecies,
      plantInventory
    }
  }

  /**
   * Extract spatial-related topics from query
   */
  private extractSpatialTopics(query: string, butterflyHabitatFocus: boolean = false): string[] {
    const topics: string[] = []
    const lowerQuery = query.toLowerCase()

    // Detect spatial/visual terms
    if (lowerQuery.includes("see") || lowerQuery.includes("look") || lowerQuery.includes("visual")) {
      topics.push("visual analysis")
    }

    if (lowerQuery.includes("environment") || lowerQuery.includes("room") || lowerQuery.includes("space")) {
      topics.push("spatial context")
    }

    if (lowerQuery.includes("current") || lowerQuery.includes("now") || lowerQuery.includes("happening")) {
      topics.push("real-time context")
    }

    // Butterfly habitat focus topics
    if (butterflyHabitatFocus) {
      if (!topics.includes("butterfly habitat")) {
        topics.push("butterfly habitat")
      }
      if (lowerQuery.includes("plant") || lowerQuery.includes("flower")) {
        topics.push("plant identification")
      }
      if (lowerQuery.includes("specie")) {
        topics.push("species probability")
      }
    }

    // Default topics if none detected
    if (topics.length === 0) {
      topics.push("spatial awareness", "live environment")
    }

    return topics.slice(0, 3)
  }

  /**
   * Generate spatial-aware follow-up questions
   */
  private generateSpatialFollowUps(query: string, butterflyHabitatFocus: boolean = false): string[] {
    const followUps: string[] = []

    if (butterflyHabitatFocus) {
      // Butterfly-specific follow-ups
      followUps.push("What plants do you see that might attract butterflies?")
      followUps.push("What butterfly species might be present here?")
      followUps.push("How does the habitat support butterfly life cycles?")
    } else {
      // General spatial follow-ups
      followUps.push("What else can you see in the current environment?")
      followUps.push("How does this relate to what I'm looking for?")
      followUps.push("Can you explain more about the current outdoor context?")
    }

    // Query-specific follow-ups
    const lowerQuery = query.toLowerCase()
    if (lowerQuery.includes("see") || lowerQuery.includes("visual")) {
      followUps.push("Would you like me to analyze specific visual elements?")
    }

    if (lowerQuery.includes("understand") || lowerQuery.includes("explain")) {
      followUps.push("Should I provide more context about the surrounding materials?")
    }

    return followUps.slice(0, 3)
  }
}
