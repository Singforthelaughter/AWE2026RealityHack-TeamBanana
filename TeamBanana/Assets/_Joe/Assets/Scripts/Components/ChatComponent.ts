import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {CHARACTER_LIMITS} from "../Utils/TextLimiter"

// ================================
// Local type definitions (replacing SpectaclesUIKitBeta SlideLayout)
// ================================

enum CardType {
  User,
  Chatbot
}

interface CardData {
  id: number
  type: CardType
  textContent: string
  size: vec3
  sceneObject: SceneObject | null
}

interface VisibleCardConfig {
  card: SceneObject | null
  position: vec3
  positionIndex: number
  cardIndex: number
}

/**
 * Represents the state of a swiped card
 */
class SwipeState {
  swipedObject: SceneObject | null = null
  originalPosition: vec3 = vec3.zero()
  originalRotation: quat = quat.quatIdentity()
  isSwipping: boolean = false
  swipeStartTime: number = 0
  swipeStartPosition: vec3 = vec3.zero()
  swipeDirection: vec3 = vec3.zero()
}

// ================================
// Inline card sizing logic (replacing AdvancedCardManager)
// ================================

function calculateCardSize(text: string): vec3 {
  const charsPerLine = 45
  const lines = Math.max(1, Math.ceil(text.length / charsPerLine))
  const baseHeight = 5.0
  const lineHeight = 1.5
  return new vec3(25, baseHeight + lines * lineHeight, 3)
}

function calculateDynamicPositions(basePositions: vec3[]): vec3[] {
  // Stack cards in Z behind the mid position.
  // Offset from current: pos 2 = front, others nested behind.
  const mid = basePositions[2] || vec3.zero()
  const zStep = 5 // cm between layers
  // slot 2 = front, 1&3 behind by 1 step, 0&4 behind by 2 steps
  const zOffsets = [-zStep * 2, -zStep, 0, -zStep, -zStep * 2]
  return basePositions.map((_p, i) => new vec3(mid.x, mid.y, mid.z + zOffsets[i]))
}

// ================================
// Inline scroll utilities (replacing ScrollSystemUtils)
// ================================

function calculateVisibleIndices(currentIndex: number, totalCards: number): {
  topLast: number
  top: number
  mid: number
  bottom: number
  bottomLast: number
} {
  return {
    topLast: currentIndex + 2 < totalCards ? currentIndex + 2 : -1,
    top: currentIndex + 1 < totalCards ? currentIndex + 1 : -1,
    mid: currentIndex,
    bottom: currentIndex - 1 >= 0 ? currentIndex - 1 : -1,
    bottomLast: currentIndex - 2 >= 0 ? currentIndex - 2 : -1
  }
}

function isScrollChangeSignificant(lastValue: number, newValue: number): boolean {
  return Math.abs(newValue - lastValue) > 0.01
}

function calculateTargetIndexFromScrollValue(normalizedValue: number, totalCards: number): number {
  return Math.round(normalizedValue * (totalCards - 1))
}

function getCurrentScrollValue(currentIndex: number, totalCards: number): number {
  if (totalCards <= 1) return 0
  return currentIndex / (totalCards - 1)
}

// ================================
// Helper: find child SceneObject by name
// ================================

function findChildByName(parent: SceneObject, childName: string): SceneObject | null {
  const count = parent.getChildrenCount()
  for (let i = 0; i < count; i++) {
    const child = parent.getChild(i)
    if (child && child.name === childName) {
      return child
    }
  }
  return null
}

/**
 * ChatComponent - Card-based chat display system
 *
 * Manages dynamic cards with text injection and variable sizing:
 * - Dynamic number of cards
 * - Text injection with automatic sizing
 * - Chat-like system (user vs chatbot cards)
 * - 5 visible cards with scroll support
 *
 * Ported from SpectaclesUIKitBeta to use only standard SpectaclesUIKit APIs.
 */
@component
export class ChatComponent extends BaseScriptComponent {
  @input
  @hint("User card prefab")
  userCardPrefab: ObjectPrefab | null = null

  @input
  @hint("Chatbot card prefab")
  chatbotCardPrefab: ObjectPrefab | null = null

  @input("int", "10")
  @hint("Initial number of cards")
  initialNumberOfCards: number = 10

  @input("SceneObject")
  @hint("Transform for the top last position")
  topLastPosition: SceneObject | null = null

  @input("SceneObject")
  @hint("Transform for the top position")
  topPosition: SceneObject | null = null

  @input("SceneObject")
  @hint("Transform for the mid position (active/swipeable)")
  midPosition: SceneObject | null = null

  @input("SceneObject")
  @hint("Transform for the bottom position")
  bottomPosition: SceneObject | null = null

  @input("SceneObject")
  @hint("Transform for the bottom last position")
  bottomLastPosition: SceneObject | null = null

  @input("number", "50.0")
  @hint("Minimum swipe distance to trigger card change")
  swipeThreshold: number = 50.0

  @input("number", "0.5")
  @hint("Animation speed for card transitions (0-1)")
  animationSpeed: number = 0.5

  @input("number", "100.0")
  @hint("Minimum swipe speed (distance/time) to trigger quick swipe")
  swipeSpeedThreshold: number = 100.0

  // Scroll System Inputs
  @input
  @hint("Enable scroll system (if false, uses manual swipe only)")
  enableScrollSystem: boolean = true

  @input
  @hint("Line start point for scroll projection")
  scrollLineStart: SceneObject | null = null

  @input
  @hint("Line end point for scroll projection")
  scrollLineEnd: SceneObject | null = null

  @input
  @hint("Draggable object that controls the scroll position")
  scrollController: SceneObject | null = null

  // Test System
  @input
  @hint("Enable test mode - adds cards automatically every 2 seconds")
  testMode: boolean = false

  @input("number", "2.0")
  @hint("Interval between test card additions (seconds)")
  testInterval: number = 2.0

  @input("int", "40")
  @hint("Maximum number of cards for testing")
  maxTestCards: number = 40

  // Chat System
  @input
  @hint("Enable chronological chat mode")
  chatModeChronological: boolean = true

  @input
  @hint("Enable verbose debug logging to the console")
  enableDebugLogging: boolean = false

  // Spacing System
  @input("number", "1.0")
  @hint("Multiplier for spacing between cards")
  spacingMultiplier: number = 1.0

  private cards: SceneObject[] = []
  private cardData: CardData[] = []
  private currentIndex: number = 0
  private swipeState: SwipeState = new SwipeState()
  private basePositions: vec3[] = []
  private currentPositions: vec3[] = []
  private animatingCards: Map<SceneObject, {target: vec3; isVisible: boolean}> = new Map()

  private initialized: boolean = false
  private lastScrollValue: number = -1

  // Test system
  private testTimer: number = 0

  onAwake() {
    this.createEvent("OnStartEvent").bind(this.initialize)
    this.createEvent("UpdateEvent").bind(this.update)
  }

  initialize = (): void => {
    if (this.initialized) return

    if (this.enableDebugLogging) {
      print("ChatComponent: initialize() called")
      print(`ChatComponent: sceneObject=${this.sceneObject?.name}`)
      print(`ChatComponent: userCardPrefab=${this.userCardPrefab ? "set" : "NULL"}`)
      print(`ChatComponent: chatbotCardPrefab=${this.chatbotCardPrefab ? "set" : "NULL"}`)
      print(`ChatComponent: topLastPos=${this.topLastPosition ? "set" : "NULL"}`)
      print(`ChatComponent: topPos=${this.topPosition ? "set" : "NULL"}`)
      print(`ChatComponent: midPos=${this.midPosition ? "set" : "NULL"}`)
      print(`ChatComponent: botPos=${this.bottomPosition ? "set" : "NULL"}`)
      print(`ChatComponent: botLastPos=${this.bottomLastPosition ? "set" : "NULL"}`)
    }

    if (!this.validateInputs()) {
      print("ChatComponent: Invalid inputs, cannot initialize")
      return
    }

    this.setupBasePositions()
    this.createInitialCards()

    if (this.testMode) {
      this.currentIndex = 2
    } else {
      this.currentIndex = 0
    }

    this.calculateDynamicPositions()
    if (this.enableDebugLogging) print(`ChatComponent: currentPositions[2] (mid)=${this.currentPositions[2]}`)
    this.layoutInitialCards()
    this.setupSwipeInteraction()

    this.initialized = true
    if (this.enableDebugLogging) print(`ChatComponent: Initialized with ${this.cardData.length} cards, currentIndex=${this.currentIndex}`)
  }

  private validateInputs(): boolean {
    if (!this.userCardPrefab || !this.chatbotCardPrefab) {
      print("ChatComponent: Both user and chatbot card prefabs are required")
      return false
    }
    if (!this.topLastPosition || !this.topPosition || !this.midPosition ||
        !this.bottomPosition || !this.bottomLastPosition) {
      print("ChatComponent: All five position objects are required")
      return false
    }
    if (this.spacingMultiplier < 0.1) this.spacingMultiplier = 0.1
    if (this.spacingMultiplier > 5.0) this.spacingMultiplier = 5.0
    return true
  }

  private setupBasePositions(): void {
    this.basePositions = [
      this.topLastPosition!.getTransform().getLocalPosition(),
      this.topPosition!.getTransform().getLocalPosition(),
      this.midPosition!.getTransform().getLocalPosition(),
      this.bottomPosition!.getTransform().getLocalPosition(),
      this.bottomLastPosition!.getTransform().getLocalPosition()
    ]
  }

  private createInitialCards(): void {
    const cardsToCreate = this.testMode ? this.initialNumberOfCards : 1

    for (let i = 0; i < cardsToCreate; i++) {
      let cardType: CardType
      let textContent: string

      if (this.testMode) {
        cardType = i % 2 === 0 ? CardType.User : CardType.Chatbot
        textContent = this.generateTestText(i)
      } else {
        cardType = CardType.Chatbot
        textContent = "Hello! We're your friendly neighborhood butterfly spotters! Where are we exploring today?"
        if (textContent.length > CHARACTER_LIMITS.BOT_CARD_TEXT) {
          textContent = textContent.substring(0, CHARACTER_LIMITS.BOT_CARD_TEXT - 3) + "..."
        }
      }

      const prefab = cardType === CardType.User ? this.userCardPrefab : this.chatbotCardPrefab
      const size = calculateCardSize(textContent || "Sample text")

      const data: CardData = {
        id: i,
        type: cardType,
        textContent: textContent,
        size: size,
        sceneObject: null
      }

      const cardObject = prefab!.instantiate(this.sceneObject)
      cardObject.name = `Card_${i}_${cardType === CardType.User ? "User" : "Bot"}`
      data.sceneObject = cardObject

      this.setupCardContent(data)
      this.cards.push(cardObject)
      this.cardData.push(data)

      if (this.enableDebugLogging) print(`ChatComponent: Created card ${i} name=${cardObject.name} parent=${this.sceneObject?.name}`)
    }
  }

  /**
   * Setup card content by directly accessing child objects.
   * Replaces the old ButtonSlideCardBot/ButtonSlideCardUser approach
   * which required SpectaclesUIKitBeta.
   */
  private setupCardContent(data: CardData): void {
    const cardObject = data.sceneObject
    if (!cardObject) return

    // Find and set textIndex (displays card number)
    const textIndexObj = findChildByName(cardObject, "TextIndex")
    if (this.enableDebugLogging) print(`ChatComponent: setupCardContent ${cardObject.name} textIndex found=${textIndexObj ? "yes" : "NO"}`)
    if (textIndexObj) {
      try {
        const textComp = textIndexObj.getComponent("Component.Text") as any
        if (textComp) {
          (textComp as Text).text = data.id.toString()
        }
      } catch (e) {
        // TextIndex is optional
      }
    }

    // Find and set textContent (displays message text)
    const textContentObj = findChildByName(cardObject, "TextContent")
    if (this.enableDebugLogging) print(`ChatComponent: setupCardContent ${cardObject.name} textContent found=${textContentObj ? "yes" : "NO"}`)
    if (textContentObj) {
      try {
        const textComp: any = textContentObj.getComponent("Component.Text")
        if (textComp) {
          textComp.text = data.textContent
          // Dark text on light background for AR visibility
          if (textComp.textFill) {
            textComp.textFill.color = new vec4(0.05, 0.05, 0.1, 1)
          }
          // Enable background plate behind text so it's readable in AR
          if (textComp.backgroundSettings) {
            textComp.backgroundSettings.enabled = true
            textComp.backgroundSettings.fill.color = new vec4(0.95, 0.95, 0.95, 0.85)
            textComp.backgroundSettings.cornerRadius = 1.0
            textComp.backgroundSettings.margins.left = 2
            textComp.backgroundSettings.margins.bottom = 2
            textComp.backgroundSettings.margins.right = 2
            textComp.backgroundSettings.margins.top = 2
          }
          if (this.enableDebugLogging) print(`ChatComponent: Set textContent to "${data.textContent.substring(0, 30)}..."`)
        }
      } catch (e) {
        print(`ChatComponent: Could not set textContent on ${cardObject.name}: ${e}`)
      }
    }

    // Ensure card has Interactable for hand targeting (InteractableManipulation alone isn't enough)
    if (!cardObject.getComponent(Interactable.getTypeName())) {
      cardObject.createComponent(Interactable.getTypeName())
    }
  }

  private generateTestText(index: number): string {
    const lines = (index % 8) + 1
    const base = "This is a test message "
    return base.repeat(lines).trim()
  }

  private calculateDynamicPositions(): void {
    this.currentPositions = calculateDynamicPositions(this.basePositions)
  }

  private layoutInitialCards(): void {
    this.cards.forEach((card) => (card.enabled = false))

    const indices = calculateVisibleIndices(this.currentIndex, this.cardData.length)
    const visibleIndices = [indices.topLast, indices.top, indices.mid, indices.bottom, indices.bottomLast]
    if (this.enableDebugLogging) print(`ChatComponent: layoutInitialCards indices=[${visibleIndices}] currentIndex=${this.currentIndex} totalCards=${this.cardData.length}`)

    visibleIndices.forEach((cardIndex, positionIndex) => {
      if (cardIndex >= 0 && cardIndex < this.cards.length) {
        const card = this.cards[cardIndex]
        card.enabled = true
        const pos = this.currentPositions[positionIndex]
        card.getTransform().setLocalPosition(pos)
        if (this.enableDebugLogging) print(`ChatComponent: Card ${cardIndex} placed at posIndex=${positionIndex} worldPos=${card.getTransform().getWorldPosition()}`)
      }
    })
  }

  private setupSwipeInteraction(): void {
    this.setupAllCardsManipulation()
  }

  private attachManipulationToCard(card: SceneObject): void {
    let manipulationComponent: any = null
    try {
      manipulationComponent = card.getComponent(InteractableManipulation.getTypeName())
    } catch (error) {
      return
    }

    if (manipulationComponent && manipulationComponent.onManipulationStart) {
      manipulationComponent.onManipulationStart.add(() => { this.startSwipe(card) })
      manipulationComponent.onManipulationEnd.add(() => { this.endSwipe() })
    }
  }

  private startSwipe(card: SceneObject): void {
    this.swipeState.swipedObject = card
    this.swipeState.originalPosition = card.getTransform().getLocalPosition()
    this.swipeState.originalRotation = card.getTransform().getLocalRotation()
    this.swipeState.isSwipping = true
    this.swipeState.swipeStartTime = getTime()
    this.swipeState.swipeStartPosition = card.getTransform().getLocalPosition()
  }

  private endSwipe(): void {
    if (!this.swipeState.isSwipping || !this.swipeState.swipedObject) return
    this.returnCardToOriginalPosition()
    this.swipeState.isSwipping = false
    this.swipeState.swipedObject = null
  }

  private returnCardToOriginalPosition(): void {
    if (!this.swipeState.swipedObject) return
    this.swipeState.swipedObject.getTransform().setLocalRotation(this.swipeState.originalRotation)
    this.animatingCards.set(this.swipeState.swipedObject, {
      target: this.swipeState.originalPosition,
      isVisible: true
    })
  }

  private update = (): void => {
    this.updateAnimations()
    if (this.testMode && this.initialized) {
      this.testTimer += getDeltaTime()
      if (this.testTimer >= this.testInterval && this.cardData.length < this.maxTestCards) {
        this.addTestCard()
        this.testTimer = 0
      }
    }
  }

  private addTestCard(): void {
    const newIndex = this.cardData.length
    const cardType = newIndex % 2 === 0 ? CardType.User : CardType.Chatbot
    const prefab = cardType === CardType.User ? this.userCardPrefab : this.chatbotCardPrefab
    const textContent = this.generateRandomLengthText()

    const data: CardData = {
      id: newIndex,
      type: cardType,
      textContent: textContent,
      size: calculateCardSize(textContent),
      sceneObject: null
    }

    const cardObject = prefab!.instantiate(this.sceneObject)
    cardObject.name = `Card_${newIndex}_${cardType === CardType.User ? "User" : "Bot"}`
    data.sceneObject = cardObject
    cardObject.enabled = false

    this.setupCardContent(data)
    this.cards.push(cardObject)
    this.cardData.push(data)
    this.updateCardLayoutToIndex(this.currentIndex)
  }

  private generateRandomLengthText(): string {
    const words = ["Hello", "world", "this", "is", "a", "test", "message", "for",
      "dynamic", "sizing", "system", "should", "work", "properly", "different",
      "text", "lengths", "demonstrate", "automatic", "card", "resizing"]
    const targetWords = Math.floor(Math.random() * 15) + 3
    let text = ""
    for (let i = 0; i < targetWords; i++) {
      text += (i > 0 ? " " : "") + words[Math.floor(Math.random() * words.length)]
    }
    return text
  }

  // ========== SCROLL SYSTEM ==========

  public onScrollValueChanged(normalizedValue: number): void {
    if (!this.enableScrollSystem || !this.initialized) return
    if (!isScrollChangeSignificant(this.lastScrollValue, normalizedValue)) return

    this.lastScrollValue = normalizedValue
    const targetIndex = calculateTargetIndexFromScrollValue(normalizedValue, this.cardData.length)

    if (targetIndex !== this.currentIndex) {
      this.updateCardLayoutToIndex(targetIndex)
    }
  }

  private updateCardLayoutToIndex(targetIndex: number): void {
    this.currentIndex = targetIndex
    this.calculateDynamicPositions()
    this.cleanupCardAnimations()
    this.hideAllCards()

    const indices = calculateVisibleIndices(this.currentIndex, this.cardData.length)

    // Opacity falloff: front card fully opaque, cards behind fade out
    const opacityBySlot = [0.25, 0.55, 1.0, 0.55, 0.25]

    const visibleCards: VisibleCardConfig[] = [
      { card: indices.topLast >= 0 ? this.cards[indices.topLast] : null,    position: this.currentPositions[0], positionIndex: 0, cardIndex: indices.topLast },
      { card: indices.top >= 0 ? this.cards[indices.top] : null,            position: this.currentPositions[1], positionIndex: 1, cardIndex: indices.top },
      { card: this.cards[indices.mid] || null,                              position: this.currentPositions[2], positionIndex: 2, cardIndex: indices.mid },
      { card: indices.bottom >= 0 ? this.cards[indices.bottom] : null,      position: this.currentPositions[3], positionIndex: 3, cardIndex: indices.bottom },
      { card: indices.bottomLast >= 0 ? this.cards[indices.bottomLast] : null, position: this.currentPositions[4], positionIndex: 4, cardIndex: indices.bottomLast }
    ]

    visibleCards.forEach(({card, position, positionIndex}) => {
      if (card) {
        card.enabled = true
        this.animatingCards.set(card, { target: position, isVisible: true })
        this.setCardOpacity(card, opacityBySlot[positionIndex] || 1.0)
      }
    })

    this.setupAllCardsManipulation()
  }

  /** Fade text fill and background alpha on a card to give depth effect. */
  private setCardOpacity(card: SceneObject, alpha: number): void {
    const textContent = findChildByName(card, "TextContent")
    if (textContent) {
      const tc: any = textContent.getComponent("Component.Text")
      if (tc?.textFill) tc.textFill.color = new vec4(0.05, 0.05, 0.1, alpha)
      if (tc?.backgroundSettings?.fill) tc.backgroundSettings.fill.color = new vec4(0.95, 0.95, 0.95, 0.85 * alpha)
    }
    const textIndex = findChildByName(card, "TextIndex")
    if (textIndex) {
      const tc: any = textIndex.getComponent("Component.Text")
      if (tc?.textFill) tc.textFill.color = new vec4(0.05, 0.05, 0.1, alpha)
      if (tc?.backgroundSettings?.fill) tc.backgroundSettings.fill.color = new vec4(0.95, 0.95, 0.95, 0.85 * alpha)
    }
  }

  private setupAllCardsManipulation(): void {
    this.clearAllManipulationHandlers()
    this.cards.forEach((card) => {
      if (card.enabled) this.attachManipulationToCard(card)
    })
  }

  private clearAllManipulationHandlers(): void {
    this.cards.forEach((card) => {
      try {
        const comp = card.getComponent(InteractableManipulation.getTypeName()) as any
        if (comp && comp.onManipulationStart) {
          comp.onManipulationStart.clear()
          comp.onManipulationEnd.clear()
        }
      } catch (error) { /* ignore */ }
    })
  }

  public getCurrentScrollValue(): number {
    return getCurrentScrollValue(this.currentIndex, this.cardData.length)
  }

  // ========== ANIMATION ==========

  private updateAnimations(): void {
    const toRemove: SceneObject[] = []
    this.animatingCards.forEach((animation, card) => {
      if (!card || !card.getTransform()) {
        toRemove.push(card)
        return
      }
      try {
        const currentPos = card.getTransform().getLocalPosition()
        const targetPos = animation.target
        const distance = currentPos.distance(targetPos)
        if (distance < 0.1) {
          card.getTransform().setLocalPosition(targetPos)
          if (!animation.isVisible) card.enabled = false
          toRemove.push(card)
        } else {
          card.getTransform().setLocalPosition(vec3.lerp(currentPos, targetPos, this.animationSpeed))
        }
      } catch (error) {
        toRemove.push(card)
      }
    })
    toRemove.forEach((card) => this.animatingCards.delete(card))
  }

  private cleanupCardAnimations(): void {
    this.animatingCards.clear()
  }

  private hideAllCards(): void {
    this.cards.forEach((card) => { card.enabled = false })
  }

  // ========== PUBLIC API ==========

  /** Add a user message card at the bottom of the chat */
  public addUserMessage(text: string): void {
    const newIndex = this.cardData.length
    const data: CardData = {
      id: newIndex,
      type: CardType.User,
      textContent: text.length > CHARACTER_LIMITS.USER_CARD_TEXT
        ? text.substring(0, CHARACTER_LIMITS.USER_CARD_TEXT - 3) + "..."
        : text,
      size: calculateCardSize(text),
      sceneObject: null
    }
    const cardObject = this.userCardPrefab!.instantiate(this.sceneObject)
    cardObject.name = `Card_${newIndex}_User`
    data.sceneObject = cardObject
    this.setupCardContent(data)
    this.cards.push(cardObject)
    this.cardData.push(data)
    this.updateCardLayoutToIndex(newIndex)
  }

  /** Add a bot message card at the bottom of the chat */
  public addBotMessage(text: string): void {
    const newIndex = this.cardData.length
    const data: CardData = {
      id: newIndex,
      type: CardType.Chatbot,
      textContent: text.length > CHARACTER_LIMITS.BOT_CARD_TEXT
        ? text.substring(0, CHARACTER_LIMITS.BOT_CARD_TEXT - 3) + "..."
        : text,
      size: calculateCardSize(text),
      sceneObject: null
    }
    const cardObject = this.chatbotCardPrefab!.instantiate(this.sceneObject)
    cardObject.name = `Card_${newIndex}_Bot`
    data.sceneObject = cardObject
    this.setupCardContent(data)
    this.cards.push(cardObject)
    this.cardData.push(data)
    this.updateCardLayoutToIndex(newIndex)
  }

  public getSystemStatus(): {
    totalCards: number
    visibleCards: number
    currentIndex: number
    testMode: boolean
  } {
    return {
      totalCards: this.cardData.length,
      visibleCards: this.cards.filter((card) => card.enabled).length,
      currentIndex: this.currentIndex,
      testMode: this.testMode
    }
  }
}
