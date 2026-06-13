import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {ChatStorage} from "./ChatStorage"

/**
 * StorageManager - Centralized storage management for the Agentic Playground
 *
 * This manager provides a single point of control for all storage components:
 * - ChatStorage: Conversation history from the agentic chat system
 *
 * Centralizes the "reset storage on awake" functionality that was previously
 * scattered across multiple components
 */
@component
export class StorageManager extends BaseScriptComponent {
  // ================================
  // Storage References
  // ================================

  @input
  @hint("Reference to ChatStorage component")
  public chatStorage: ChatStorage = null

  // ================================
  // Configuration
  // ================================

  @input
  @hint("Reset all storage on awake (centralized control)")
  public resetStorageOnAwake: boolean = false

  @input
  @hint("Enable debug logging")
  public enableDebugLogging: boolean = true

  @input
  @hint("Enable cross-storage information flow")
  public enableStorageIntegration: boolean = true

  // ================================
  // State Management
  // ================================

  private isInitialized: boolean = false
  private storageReferences: Map<string, any> = new Map()

  // ================================
  // Events
  // ================================

  public onStorageReset: Event<void> = new Event<void>()
  public onStorageError: Event<string> = new Event<string>()
  public onIntegrationUpdate: Event<string> = new Event<string>()

  // ================================
  // Lifecycle Methods
  // ================================

  onAwake() {
    if (this.enableDebugLogging) {
      print("StorageManager: Storage Manager awakened")
    }

    this.createEvent("OnStartEvent").bind(this.initialize.bind(this))
  }

  private initialize(): void {
    if (this.enableDebugLogging) {
      print("StorageManager: Initializing storage manager")
    }

    // Validate storage references
    this.validateStorageReferences()

    // Reset storage if requested
    if (this.resetStorageOnAwake) {
      this.resetAllStorage()
    }

    this.isInitialized = true

    if (this.enableDebugLogging) {
      print("StorageManager: Storage manager initialized successfully")
    }
  }

  // ================================
  // Storage Management
  // ================================

  /**
   * Validate that all storage references are properly assigned
   */
  private validateStorageReferences(): void {
    const validationResults: string[] = []

    if (!this.chatStorage) {
      validationResults.push("ChatStorage not assigned")
    } else {
      this.storageReferences.set("chat", this.chatStorage)
    }

    if (validationResults.length > 0) {
      print("StorageManager: Storage validation results:")
      validationResults.forEach((result) => print(`  ${result}`))

      if (validationResults.length === 1) {
        this.onStorageError.invoke("No storage components assigned")
      }
    } else if (this.enableDebugLogging) {
      print("StorageManager: All storage components validated")
    }
  }

  /**
   * Reset all storage components
   */
  public resetAllStorage(): void {
    if (this.enableDebugLogging) {
      print("StorageManager: Resetting all storage components")
    }

    try {
      // Reset Chat Storage
      if (this.chatStorage) {
        this.chatStorage.clearAllMemory()
        if (this.enableDebugLogging) {
          print("StorageManager: Chat storage reset")
        }
      }

      this.onStorageReset.invoke()

      if (this.enableDebugLogging) {
        print("StorageManager: All storage components reset successfully")
      }
    } catch (error) {
      const errorMsg = `Failed to reset storage: ${error}`
      if (this.enableDebugLogging) {
        print(`StorageManager: ${errorMsg}`)
      }
      this.onStorageError.invoke(errorMsg)
    }
  }

  /**
   * Reset specific storage component
   */
  public resetStorage(storageType: "chat"): void {
    try {
      switch (storageType) {
        case "chat":
          if (this.chatStorage) {
            this.chatStorage.clearAllMemory()
            if (this.enableDebugLogging) {
              print("StorageManager: Chat storage reset")
            }
          }
          break
      }
    } catch (error) {
      const errorMsg = `Failed to reset ${storageType} storage: ${error}`
      if (this.enableDebugLogging) {
        print(`StorageManager: ${errorMsg}`)
      }
      this.onStorageError.invoke(errorMsg)
    }
  }

  // ================================
  // Context Retrieval Methods
  // ================================

  /**
   * Get relevant chat context for other systems
   */
  public getChatContext(maxMessages: number = 10): any[] {
    if (!this.chatStorage) return []

    const currentSession = this.chatStorage.getCurrentSession()
    if (!currentSession || !currentSession.messages) return []

    return currentSession.messages.slice(-maxMessages)
  }

  // ================================
  // Status and Monitoring
  // ================================

  /**
   * Get storage status for all components
   */
  public getStorageStatus(): {
    isInitialized: boolean
    chat: any
  } {
    return {
      isInitialized: this.isInitialized,
      chat: this.chatStorage ? this.chatStorage.getStorageStats() : null
    }
  }

  /**
   * Check if all storage components are ready
   */
  public isReady(): boolean {
    return this.isInitialized && !!this.chatStorage
  }

  // ================================
  // Storage Access Methods
  // ================================

  /**
   * Get chat storage reference
   */
  public getChatStorage(): ChatStorage | null {
    return this.chatStorage
  }

}
