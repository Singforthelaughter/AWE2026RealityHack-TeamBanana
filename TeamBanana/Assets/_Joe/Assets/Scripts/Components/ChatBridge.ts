import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {setTimeout, clearTimeout} from "SpectaclesInteractionKit.lspkg/Utils/FunctionTimingUtils"
import {AgentOrchestrator} from "../Agents/AgentOrchestrator"
import {ChatMessage} from "../Agents/AgentTypes"
import {ChatStorage} from "../Storage/ChatStorage"
import {ChatExtensions} from "../Utils/ChatExtensions"
import {CHARACTER_LIMITS, TextLimiter} from "../Utils/TextLimiter"
import {ChatComponent} from "./ChatComponent"

/**
 * ChatBridge - Bridge between AgentOrchestrator and ChatComponent
 *
 * This handles the agentic chat flow:
 * AgentOrchestrator → Tools → ChatStorage → ChatBridge → ChatComponent
 *
 * This simplified version uses only confirmed existing APIs.
 */
@component
export class ChatBridge extends BaseScriptComponent {
  @input
  @hint("Reference to AgentOrchestrator component")
  agentOrchestrator: AgentOrchestrator = null!

  @input
  @hint("Reference to ChatStorage component")
  chatStorage: ChatStorage = null!

  @input
  @hint("Reference to ChatComponent for UI display")
  chatLayout: ChatComponent = null!

  @input enableDebugLogging: boolean = true
  @input maxDisplayMessages: number = 50

  private isConnected: boolean = false
  private lastMessageCount: number = 0
  private connectionRetryCount: number = 0
  private readonly MAX_CONNECTION_RETRIES: number = 10

  // Split long bot responses into two sequential cards
  private readonly SPLIT_THRESHOLD: number = 200    // chars — split if response exceeds this
  private readonly CHARS_PER_SECOND: number = 13    // avg English speech rate (~150 wpm, ~5 chars/word)

  public onMessageDisplayed: Event<ChatMessage> = new Event<ChatMessage>()
  public onError: Event<string> = new Event<string>()

  onAwake() {
    this.createEvent("OnStartEvent").bind(this.initialize.bind(this))
    this.createEvent("UpdateEvent").bind(this.checkForUpdates.bind(this))

    if (this.enableDebugLogging) {
      print("ChatBridge: 🌉 Chat bridge component awakened")
    }
  }

  private initialize(): void {
    this.validateComponents()
    this.setupConnections()
    this.loadExistingHistory()

    if (this.enableDebugLogging) {
      print("ChatBridge: Initialized successfully")
    }
  }

  private validateComponents(): void {
    if (!this.agentOrchestrator) {
      print("ChatBridge: AgentOrchestrator not assigned")
      return
    }

    if (!this.chatStorage) {
      print("ChatBridge: ChatStorage not assigned")
      return
    }

    if (!this.chatLayout) {
      print("ChatBridge: ChatLayout not assigned")
      return
    }
  }

  private setupConnections(): void {
    // Connect to AgentOrchestrator events
    if (this.agentOrchestrator) {
      // Check if events exist before subscribing
      if (this.agentOrchestrator.onQueryProcessed && this.agentOrchestrator.onQueryProcessed.add) {
        this.agentOrchestrator.onQueryProcessed.add((data) => {
          this.handleNewConversation(data.query, data.response)
        })

        if (this.enableDebugLogging) {
          print("ChatBridge: Connected to AgentOrchestrator.onQueryProcessed")
        }
      } else {
        print("ChatBridge: AgentOrchestrator.onQueryProcessed not available yet")
      }

      if (this.agentOrchestrator.onError && this.agentOrchestrator.onError.add) {
        this.agentOrchestrator.onError.add((error) => {
          this.handleOrchestratorError(error)
        })

        if (this.enableDebugLogging) {
          print("ChatBridge: Connected to AgentOrchestrator.onError")
        }
      } else {
        print("ChatBridge: AgentOrchestrator.onError not available yet")
      }

      // FIX: Listen to system reset events to clear chat UI
      if (this.agentOrchestrator.onSystemReset && this.agentOrchestrator.onSystemReset.add) {
        this.agentOrchestrator.onSystemReset.add(() => {
          this.clearChatUI()
        })

        if (this.enableDebugLogging) {
          print("ChatBridge: Connected to AgentOrchestrator.onSystemReset")
        }
      } else {
        print("ChatBridge: AgentOrchestrator.onSystemReset not available yet")
      }

      // FIX: Connect to voice completion event for proper text display timing
      if (this.agentOrchestrator.onVoiceCompleted && this.agentOrchestrator.onVoiceCompleted.add) {
        this.agentOrchestrator.onVoiceCompleted.add((data) => {
          if (this.enableDebugLogging) {
            print(
              `ChatBridge: Received voice completion event - query: "${data.query?.substring(0, 30)}...", response: "${data.response?.substring(0, 30)}..." (${data.response?.length} chars)`
            )
          }
          this.handleVoiceCompleted(data.query, data.response)
        })

        if (this.enableDebugLogging) {
          print("ChatBridge: Connected to AgentOrchestrator.onVoiceCompleted")
        }
      } else {
        print("ChatBridge: AgentOrchestrator.onVoiceCompleted not available yet")
      }
    }

    // Connect to ChatStorage events
    if (this.chatStorage) {
      // FIX: Disable ChatStorage.onMessageAdded to prevent duplicate messages
      // Since we're now displaying messages directly in handleNewConversation,
      // we don't need to listen to storage events which were causing duplicates
      if (this.enableDebugLogging) {
        print("ChatBridge: ChatStorage.onMessageAdded disabled to prevent duplicates")
      }
    }

    this.isConnected = true

    if (this.enableDebugLogging) {
      print("ChatBridge: Bridge connections established")
    }
  }

  /**
   * Retry connection setup if not all events are connected
   */
  private retryConnectionSetup(): void {
    if (this.isConnected || this.connectionRetryCount >= this.MAX_CONNECTION_RETRIES) {
      return
    }

    this.connectionRetryCount++

    if (this.enableDebugLogging) {
      print(
        `ChatBridge: Retrying connection setup (attempt ${this.connectionRetryCount}/${this.MAX_CONNECTION_RETRIES})`
      )
    }

    let connectionsNeeded = 0
    let connectionsEstablished = 0

    // Check AgentOrchestrator connections
    if (this.agentOrchestrator) {
      connectionsNeeded += 2 // onQueryProcessed and onError

      if (this.agentOrchestrator.onQueryProcessed) {
        connectionsEstablished++
      }

      if (this.agentOrchestrator.onError) {
        connectionsEstablished++
      }
    }

    // Check ChatStorage connections
    if (this.chatStorage) {
      // FIX: onMessageAdded disabled to prevent duplicates
      // connectionsNeeded += 1; // onMessageAdded
      // if (this.chatStorage.onMessageAdded && this.chatStorage.onMessageAdded.add) {
      //   connectionsEstablished++
      // }
    }

    if (connectionsEstablished === connectionsNeeded && connectionsNeeded > 0) {
      // All required connections are now available, redo setup
      this.setupConnections()
    }
  }

  /**
   * Handle new conversation from AgentOrchestrator
   */
  private handleNewConversation(query: string, response: string): void {
    // FIX: Don't store messages here - AgentOrchestrator already stores them in memory
    // This was causing duplicate messages because ChatStorage.onMessageAdded would trigger displays
    // Let's just display the messages directly instead of storing them again

    const timestamp = Date.now()

    // Create user message using correct character limit
    const userMessage: ChatMessage = {
      id: `msg_${timestamp}_user`,
      type: "user",
      content: TextLimiter.limitText(query, CHARACTER_LIMITS.USER_CARD_TEXT),
      timestamp: timestamp,
      cardIndex: -1,
      relatedTools: []
    }

    // Display user message immediately
    this.displayMessage(userMessage)

    // FIX: Check if voice output is enabled
    const isVoiceEnabled = this.agentOrchestrator && this.agentOrchestrator.enableVoiceOutput

    if (isVoiceEnabled && (response === "" || response.startsWith("[Voice response"))) {
      // Voice mode with placeholder/empty response - wait for transcription event
      if (this.enableDebugLogging) {
        print(`ChatBridge: Voice mode detected - waiting for transcription event`)
      }
      // Don't display anything - wait for voice completion event
    } else if (response && response.length > 0) {
      // We have a text response — display it (split into two cards if long)
      this.displayBotResponse(response, timestamp)
    }

    if (this.enableDebugLogging) {
      print(`ChatBridge: New conversation handled: "${query.substring(0, 50)}..." (voice: ${isVoiceEnabled})`)
    }
  }

  /**
   * Handle new message from ChatStorage
   */
  private handleNewMessage(message: ChatMessage): void {
    this.displayMessage(message)
    this.onMessageDisplayed.invoke(message)
  }

  /**
   * Handle voice completion - display the bot message with transcription
   * FIX: This displays the bot card after voice completes with the actual transcription
   */
  private handleVoiceCompleted(query: string, response: string): void {
    if (this.enableDebugLogging) {
      print(
        `ChatBridge: Voice completed with transcription: "${response.substring(0, 50)}..." (${response.length} chars)`
      )
    }

    // Display bot message with transcription (split into two cards if long)
    this.displayBotResponse(response, Date.now())
  }

  /**
   * Display message in chat UI using existing ChatExtensions
   */
  private displayMessage(message: ChatMessage): void {
    if (!this.chatLayout) return

    try {
      // Use existing ChatExtensions methods that actually exist
      if (message.type === "user") {
        ChatExtensions.addUserCard(this.chatLayout, message.content)
      } else {
        ChatExtensions.addBotCard(this.chatLayout, message.content)
      }

      if (this.enableDebugLogging) {
        print(`ChatBridge: Displayed ${message.type} message: "${message.content.substring(0, 30)}..."`)
      }
    } catch (error) {
      print(`ChatBridge: Failed to display message: ${error}`)
      this.onError.invoke(`Message display failed: ${error}`)
    }
  }

  /**
   * Display a bot response, splitting into two sequential cards if it exceeds
   * SPLIT_THRESHOLD. Part 2 appears after SPLIT_DELAY_MS.
   */
  private displayBotResponse(response: string, baseTimestamp: number): void {
    const limited = TextLimiter.limitText(response, CHARACTER_LIMITS.BOT_CARD_TEXT)

    if (limited.length <= this.SPLIT_THRESHOLD) {
      // Short enough — display as a single card
      const botMessage: ChatMessage = {
        id: `msg_${baseTimestamp + 1}_bot`,
        type: "bot",
        content: limited,
        timestamp: baseTimestamp + 1,
        cardIndex: -1,
        relatedTools: ["intelligent_conversation"]
      }
      this.displayMessage(botMessage)

      if (this.enableDebugLogging) {
        print(`ChatBridge: Bot message displayed: "${limited.substring(0, 50)}..."`)
      }
      return
    }

    // Split into two parts at a natural break point
    const [part1, part2] = this.splitAtSentence(limited)

    // Part 1 — display immediately
    const msg1: ChatMessage = {
      id: `msg_${baseTimestamp + 1}_bot_a`,
      type: "bot",
      content: part1,
      timestamp: baseTimestamp + 1,
      cardIndex: -1,
      relatedTools: ["intelligent_conversation"]
    }
    this.displayMessage(msg1)

    if (this.enableDebugLogging) {
      print(`ChatBridge: Bot message part 1/2 displayed (${part1.length} chars)`)
    }

    // Part 2 — display after a delay matching how long it takes to read part 1
    const readingTimeMs = (part1.length / this.CHARS_PER_SECOND) * 1000
    setTimeout(() => {
      const msg2: ChatMessage = {
        id: `msg_${baseTimestamp + 2}_bot_b`,
        type: "bot",
        content: part2,
        timestamp: baseTimestamp + 2,
        cardIndex: -1,
        relatedTools: ["intelligent_conversation"]
      }
      this.displayMessage(msg2)

      if (this.enableDebugLogging) {
        print(`ChatBridge: Bot message part 2/2 displayed (${part2.length} chars)`)
      }
    }, readingTimeMs)
  }

  /**
   * Split text near the middle at a sentence boundary (., !, ? followed by space).
   * If no sentence break is found, falls back to splitting at the last space.
   * Returns [firstHalf, secondHalf].
   */
  private splitAtSentence(text: string): [string, string] {
    const mid = Math.floor(text.length / 2)

    // Search for a sentence boundary near the middle (scan right first, then left)
    const sentenceBreaks = [". ", "! ", "? ", ".\n", "!\n", "?\n"]
    let splitPoint = -1

    // Scan right from mid (prefer splitting after a complete sentence)
    for (let i = mid; i < text.length - 1; i++) {
      const pair = text.substring(i, i + 2)
      if (sentenceBreaks.includes(pair)) {
        splitPoint = i + 1 // include the punctuation
        break
      }
    }

    // If no break found right of mid, scan left
    if (splitPoint === -1) {
      for (let i = mid; i >= 0; i--) {
        const pair = text.substring(i, i + 2)
        if (sentenceBreaks.includes(pair)) {
          splitPoint = i + 1
          break
        }
      }
    }

    // Fallback: split at the last space before mid
    if (splitPoint === -1) {
      const lastSpace = text.lastIndexOf(" ", mid)
      splitPoint = lastSpace > 0 ? lastSpace : mid
    }

    const part1 = text.substring(0, splitPoint).trim()
    const part2 = text.substring(splitPoint).trim()

    return [part1, part2]
  }

  /**
   * Clear all chat UI (called when storage is reset)
   */
  public clearChatUI(): void {
    if (this.chatLayout) {
      const success = ChatExtensions.clearAllCards(this.chatLayout)
      if (this.enableDebugLogging) {
        print(`ChatBridge: ${success ? "" : ""} Chat UI cleared`)
      }
    }
  }

  /**
   * Load existing chat history from AgentOrchestrator memory system
   * FIX: No longer loads from ChatStorage to prevent disconnect with AgentOrchestrator's memory
   */
  private loadExistingHistory(): void {
    if (!this.agentOrchestrator || !this.chatLayout) return

    try {
      // FIX: Try to get chat history from AgentOrchestrator's memory system
      // AgentOrchestrator stores messages in AgentMemorySystem, not ChatStorage
      // For now, skip history loading on startup since messages will flow through
      // the proper onQueryProcessed event system going forward

      if (this.enableDebugLogging) {
        print("ChatBridge: 📚 History loading disabled - messages flow through AgentOrchestrator events")
      }
    } catch (error) {
      print(`ChatBridge: Failed to load history: ${error}`)
    }
  }

  /**
   * Retry connections if needed (periodic check for message updates removed)
   * FIX: No longer polls ChatStorage since messages flow through AgentOrchestrator events
   */
  private checkForUpdates(): void {
    // Retry connections if not fully established
    if (!this.isConnected) {
      this.retryConnectionSetup()
    }

    // FIX: Removed ChatStorage polling since messages now flow through
    // AgentOrchestrator.onQueryProcessed → handleNewConversation → displayMessage
    // This prevents any potential duplication from periodic checks
  }

  /**
   * Handle orchestrator errors
   */
  private handleOrchestratorError(error: string): void {
    print(`ChatBridge: Orchestrator error: ${error}`)
    this.onError.invoke(error)

    // Display error message in chat
    const errorMessage: ChatMessage = {
      id: `error_${Date.now()}`,
      type: "bot",
      content: `System Error: ${error}`,
      timestamp: Date.now(),
      cardIndex: -1,
      relatedTools: []
    }

    this.displayMessage(errorMessage)
  }

  // ================================
  // Public API
  // ================================

  /**
   * Force refresh chat display
   */
  public refreshChatDisplay(): void {
    this.loadExistingHistory()
  }

  /**
   * Clear all chat messages using AgentOrchestrator reset
   * FIX: Use AgentOrchestrator.resetSystem() instead of ChatStorage
   */
  public clearAllMessages(): void {
    if (this.agentOrchestrator) {
      this.agentOrchestrator.resetSystem()
    }

    if (this.enableDebugLogging) {
      print("ChatBridge: All messages cleared via AgentOrchestrator")
    }
  }

  /**
   * Get current bridge status
   */
  public getBridgeStatus(): {
    isConnected: boolean
    messageCount: number
    hasValidComponents: boolean
  } {
    return {
      isConnected: this.isConnected,
      messageCount: this.lastMessageCount,
      hasValidComponents: !!(this.agentOrchestrator && this.chatStorage && this.chatLayout)
    }
  }

  /**
   * Send manual message (for testing) through AgentOrchestrator flow
   * FIX: Use AgentOrchestrator.processUserQuery() instead of direct ChatStorage
   */
  public async sendTestMessage(content: string, isUser: boolean = true): Promise<void> {
    if (!this.agentOrchestrator || !isUser) {
      // Only support user test messages since bot responses come from AI
      if (this.enableDebugLogging) {
        print("ChatBridge: Test messages must be user messages and require AgentOrchestrator")
      }
      return
    }

    try {
      // Send through proper flow: AgentOrchestrator → onQueryProcessed → handleNewConversation
      await this.agentOrchestrator.processUserQuery(content)

      if (this.enableDebugLogging) {
        print(`ChatBridge: Test message sent through AgentOrchestrator: "${content}"`)
      }
    } catch (error) {
      print(`ChatBridge: Test message failed: ${error}`)
    }
  }
}
