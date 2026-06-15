import {
  PROMPT_CHEATSHEET_ENTRIES,
  PROMPT_CHEATSHEET_MODE_ORDER,
  PROMPT_CHEATSHEET_MODE_SUMMARIES,
  PROMPT_CHEATSHEET_MODE_TITLES,
  PromptCheatsheetEntry,
  PromptCheatsheetMode,
  RuntimeSupport
} from "./PromptCheatsheetCatalog"

const DEFAULT_PROMPT_SLOTS = 4
const DEFAULT_ROTATE_SECONDS = 8
const DEFAULT_CONTEXT_POLL_SECONDS = 0.35
const MAX_CARD_TEXT_LENGTH = 170

@component
export class VisualPromptCheatsheetController extends BaseScriptComponent {
  @ui.label("Visual Prompt Cheatsheet")
  @ui.separator

  @input
  @allowUndefined
  @hint("Optional root object for the visual cheatsheet panel. showPanel/hidePanel toggle this object.")
  panelRoot: SceneObject | null = null

  @input
  @allowUndefined
  @hint("Title text for the current cheatsheet mode.")
  titleText: Text | null = null

  @input
  @allowUndefined
  @hint("Summary text under the title. If no prompt slots are assigned, prompts are rendered here.")
  summaryText: Text | null = null

  @input
  @allowUndefined
  @hint("Optional status text for page and runtime notes.")
  statusText: Text | null = null

  @input
  @hint("Text slots used as visual prompt cards.")
  promptTextSlots: Text[] = []

  @ui.separator
  @ui.label("Behavior")
  @input
  @hint("Create a simple runtime text layout when no Text references are assigned.")
  autoCreateLayout: boolean = true

  @input
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Field Guide", "idle"),
      new ComboBoxItem("Voice Assistant", "voice"),
      new ComboBoxItem("Identify Butterflies", "identification"),
      new ComboBoxItem("Scan For Butterflies", "detection"),
      new ComboBoxItem("Nearby Sightings", "map"),
      new ComboBoxItem("Collection", "collection"),
      new ComboBoxItem("Spatial Awareness", "spatial"),
      new ComboBoxItem("Generate Assets", "generation"),
      new ComboBoxItem("Palm Push To Talk", "palmTalk")
    ])
  )
  @hint("Mode shown on start if auto context detection has no active watched object.")
  startMode: string = "idle"

  @input
  @hint("Automatically switch prompt groups based on watched SceneObjects.")
  autoDetectContext: boolean = true

  @input
  @hint("Rotate prompt pages within the current mode.")
  autoRotatePrompts: boolean = false

  @input
  @hint("Seconds between automatic prompt page changes.")
  rotateSeconds: number = DEFAULT_ROTATE_SECONDS

  @input
  @hint("Seconds between context checks.")
  contextPollSeconds: number = DEFAULT_CONTEXT_POLL_SECONDS

  @input
  @hint("Enable debug logging.")
  debugLogging: boolean = false

  @ui.separator
  @ui.label("Context Watchers")
  @input
  @allowUndefined
  @hint("When enabled, switches to Nearby Sightings prompts.")
  mapRoot: SceneObject | null = null

  @input
  @allowUndefined
  @hint("When enabled, switches to Identify Butterflies prompts.")
  identificationRoot: SceneObject | null = null

  @input
  @allowUndefined
  @hint("When enabled, switches to Identify Butterflies prompts after an info card appears.")
  infoCardRoot: SceneObject | null = null

  @input
  @allowUndefined
  @hint("When enabled, switches to Collection prompts.")
  collectionRoot: SceneObject | null = null

  @input
  @allowUndefined
  @hint("When enabled, switches to Voice Assistant prompts.")
  chatRoot: SceneObject | null = null

  @input
  @allowUndefined
  @hint("When enabled, switches to Palm Push To Talk prompts.")
  palmTalkRoot: SceneObject | null = null

  private currentMode: PromptCheatsheetMode = "idle"
  private pageStartIndex: number = 0
  private rotateTimer: number = 0
  private contextPollTimer: number = 0
  private generatedObjects: SceneObject[] = []

  onAwake(): void {
    this.currentMode = this.normalizeMode(this.startMode)
    this.createEvent("OnStartEvent").bind(() => {
      this.ensureVisualLayout()
      this.render()
    })
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  public showPanel(): void {
    if (this.panelRoot) {
      this.panelRoot.enabled = true
    }
    this.render()
  }

  public hidePanel(): void {
    if (this.panelRoot) {
      this.panelRoot.enabled = false
    }
  }

  public togglePanel(): void {
    if (!this.panelRoot) {
      this.render()
      return
    }
    this.panelRoot.enabled = !this.panelRoot.enabled
    if (this.panelRoot.enabled) {
      this.render()
    }
  }

  public setMode(mode: string): void {
    const nextMode = this.normalizeMode(mode)
    if (nextMode === this.currentMode) {
      this.render()
      return
    }
    this.currentMode = nextMode
    this.pageStartIndex = 0
    this.rotateTimer = 0
    this.render()
  }

  public showIdle(): void {
    this.setMode("idle")
  }

  public showVoice(): void {
    this.setMode("voice")
  }

  public showIdentification(): void {
    this.setMode("identification")
  }

  public showDetection(): void {
    this.setMode("detection")
  }

  public showMap(): void {
    this.setMode("map")
  }

  public showCollection(): void {
    this.setMode("collection")
  }

  public showSpatial(): void {
    this.setMode("spatial")
  }

  public showGeneration(): void {
    this.setMode("generation")
  }

  public showPalmTalk(): void {
    this.setMode("palmTalk")
  }

  public nextMode(): void {
    const currentIndex = PROMPT_CHEATSHEET_MODE_ORDER.indexOf(this.currentMode)
    const nextIndex = (currentIndex + 1) % PROMPT_CHEATSHEET_MODE_ORDER.length
    this.setMode(PROMPT_CHEATSHEET_MODE_ORDER[nextIndex])
  }

  public previousMode(): void {
    const currentIndex = PROMPT_CHEATSHEET_MODE_ORDER.indexOf(this.currentMode)
    const nextIndex = (currentIndex - 1 + PROMPT_CHEATSHEET_MODE_ORDER.length) % PROMPT_CHEATSHEET_MODE_ORDER.length
    this.setMode(PROMPT_CHEATSHEET_MODE_ORDER[nextIndex])
  }

  public nextPromptPage(): void {
    const entries = this.getEntriesForMode(this.currentMode)
    const visibleCount = this.getVisiblePromptCount()
    if (entries.length <= visibleCount) {
      return
    }
    this.pageStartIndex = (this.pageStartIndex + visibleCount) % entries.length
    this.render()
  }

  public previousPromptPage(): void {
    const entries = this.getEntriesForMode(this.currentMode)
    const visibleCount = this.getVisiblePromptCount()
    if (entries.length <= visibleCount) {
      return
    }
    this.pageStartIndex = (this.pageStartIndex - visibleCount + entries.length) % entries.length
    this.render()
  }

  public getCurrentPromptText(): string {
    const entries = this.getVisibleEntries()
    return entries.map((entry) => entry.prompt).join(" | ")
  }

  private onUpdate(): void {
    const deltaTime = getDeltaTime()

    if (this.autoDetectContext) {
      this.contextPollTimer += deltaTime
      if (this.contextPollTimer >= this.getContextPollSeconds()) {
        this.contextPollTimer = 0
        this.updateContextMode()
      }
    }

    if (this.autoRotatePrompts) {
      this.rotateTimer += deltaTime
      if (this.rotateTimer >= this.getRotateSeconds()) {
        this.rotateTimer = 0
        this.nextPromptPage()
      }
    }
  }

  private updateContextMode(): void {
    const detectedMode = this.detectModeFromScene()
    if (detectedMode && detectedMode !== this.currentMode) {
      this.currentMode = detectedMode
      this.pageStartIndex = 0
      this.render()
    }
  }

  private detectModeFromScene(): PromptCheatsheetMode | null {
    if (this.isActive(this.palmTalkRoot)) return "palmTalk"
    if (this.isActive(this.mapRoot)) return "map"
    if (this.isActive(this.identificationRoot) || this.isActive(this.infoCardRoot)) return "identification"
    if (this.isActive(this.collectionRoot)) return "collection"
    if (this.isActive(this.chatRoot)) return "voice"
    return null
  }

  private render(): void {
    this.ensureVisualLayout()

    const title = PROMPT_CHEATSHEET_MODE_TITLES[this.currentMode]
    const summary = PROMPT_CHEATSHEET_MODE_SUMMARIES[this.currentMode]
    const visibleEntries = this.getVisibleEntries()

    if (this.titleText) {
      this.titleText.text = title
    }

    if (this.promptTextSlots.length > 0) {
      if (this.summaryText) {
        this.summaryText.text = summary
      }
      for (let i = 0; i < this.promptTextSlots.length; i++) {
        const slot = this.promptTextSlots[i]
        const entry = visibleEntries[i]
        slot.text = entry ? this.formatCard(entry) : ""
      }
    } else if (this.summaryText) {
      this.summaryText.text = summary + "\n\n" + visibleEntries.map((entry) => this.formatCard(entry)).join("\n\n")
    }

    if (this.statusText) {
      this.statusText.text = this.formatStatus()
    }

    if (this.debugLogging) {
      print("[VisualPromptCheatsheet] rendered mode=" + this.currentMode + " pageStart=" + this.pageStartIndex)
    }
  }

  private getVisibleEntries(): PromptCheatsheetEntry[] {
    const entries = this.getEntriesForMode(this.currentMode)
    if (entries.length === 0) {
      return []
    }

    const visibleCount = this.getVisiblePromptCount()
    const result: PromptCheatsheetEntry[] = []
    for (let i = 0; i < Math.min(visibleCount, entries.length); i++) {
      result.push(entries[(this.pageStartIndex + i) % entries.length])
    }
    return result
  }

  private getEntriesForMode(mode: PromptCheatsheetMode): PromptCheatsheetEntry[] {
    return PROMPT_CHEATSHEET_ENTRIES.filter((entry) => entry.mode === mode)
  }

  private ensureVisualLayout(): void {
    if (!this.autoCreateLayout) {
      return
    }
    if (this.titleText && this.summaryText && this.promptTextSlots.length > 0) {
      return
    }

    const root = this.ensurePanelRoot()
    if (!this.titleText) {
      this.titleText = this.createGeneratedText(root, "CheatsheetTitle", new vec3(0, 17.5, 0.1), 42, 70)
    }
    if (!this.summaryText) {
      this.summaryText = this.createGeneratedText(root, "CheatsheetSummary", new vec3(0, 12.2, 0.1), 22, 71)
    }
    if (this.promptTextSlots.length === 0) {
      const yPositions = [6.0, 0.4, -5.2, -10.8]
      for (let i = 0; i < yPositions.length; i++) {
        this.promptTextSlots.push(
          this.createGeneratedText(root, "CheatsheetPrompt" + i, new vec3(0, yPositions[i], 0.1), 19, 72 + i)
        )
      }
    }
    if (!this.statusText) {
      this.statusText = this.createGeneratedText(root, "CheatsheetStatus", new vec3(0, -16.7, 0.1), 16, 80)
    }
  }

  private ensurePanelRoot(): SceneObject {
    if (this.panelRoot) {
      return this.panelRoot
    }

    const root = global.scene.createSceneObject("VisualPromptCheatsheetPanel")
    root.layer = this.sceneObject.layer
    root.setParent(this.sceneObject)
    root.getTransform().setLocalPosition(vec3.zero())
    root.getTransform().setLocalRotation(quat.quatIdentity())
    root.getTransform().setLocalScale(vec3.one())
    this.panelRoot = root
    this.generatedObjects.push(root)
    return root
  }

  private createGeneratedText(parent: SceneObject, name: string, position: vec3, size: number, renderOrder: number): Text {
    const textObject = global.scene.createSceneObject(name)
    textObject.layer = parent.layer
    textObject.setParent(parent)
    textObject.getTransform().setLocalPosition(position)
    textObject.getTransform().setLocalRotation(quat.quatIdentity())
    textObject.getTransform().setLocalScale(vec3.one())
    this.generatedObjects.push(textObject)

    const text = textObject.createComponent("Component.Text") as Text
    text.size = size
    text.sizeToFit = false
    text.horizontalAlignment = HorizontalAlignment.Center
    text.verticalAlignment = VerticalAlignment.Center
    text.renderOrder = renderOrder
    text.textFill.color = new vec4(1, 1, 1, 0.95)
    text.backgroundSettings.enabled = true
    text.backgroundSettings.fill.color = new vec4(0.04, 0.05, 0.06, 0.68)
    text.backgroundSettings.cornerRadius = 1
    text.backgroundSettings.margins.left = 2
    text.backgroundSettings.margins.right = 2
    text.backgroundSettings.margins.top = 1
    text.backgroundSettings.margins.bottom = 1
    return text
  }

  private formatCard(entry: PromptCheatsheetEntry): string {
    const runtime = this.runtimeLabel(entry.runtime)
    const text =
      entry.feature +
      " [" +
      runtime +
      "]\nSay: \"" +
      entry.prompt +
      "\"\nDoes: " +
      entry.outcome
    return this.truncate(text, MAX_CARD_TEXT_LENGTH)
  }

  private formatStatus(): string {
    const entries = this.getEntriesForMode(this.currentMode)
    if (entries.length === 0) {
      return "No prompts"
    }

    const visibleCount = Math.min(this.getVisiblePromptCount(), entries.length)
    const from = this.pageStartIndex + 1
    const to = Math.min(this.pageStartIndex + visibleCount, entries.length)
    const runtime = this.modeRuntimeSummary(entries)
    return from + "-" + to + " of " + entries.length + " | " + runtime
  }

  private modeRuntimeSummary(entries: PromptCheatsheetEntry[]): string {
    let hasDeviceOnly = false
    let hasPreviewOk = false
    let hasMixed = false

    for (let i = 0; i < entries.length; i++) {
      if (entries[i].runtime === "device-only") hasDeviceOnly = true
      if (entries[i].runtime === "preview-ok") hasPreviewOk = true
      if (entries[i].runtime === "mixed") hasMixed = true
    }

    if (hasMixed || (hasDeviceOnly && hasPreviewOk)) return "mixed runtime"
    if (hasDeviceOnly) return "device only"
    return "preview ok"
  }

  private runtimeLabel(runtime: RuntimeSupport): string {
    if (runtime === "device-only") return "DEVICE"
    if (runtime === "mixed") return "MIXED"
    return "PREVIEW"
  }

  private normalizeMode(mode: string): PromptCheatsheetMode {
    for (let i = 0; i < PROMPT_CHEATSHEET_MODE_ORDER.length; i++) {
      const validMode = PROMPT_CHEATSHEET_MODE_ORDER[i]
      if (mode === validMode) {
        return validMode
      }
    }
    return "idle"
  }

  private getVisiblePromptCount(): number {
    if (this.promptTextSlots.length > 0) {
      return this.promptTextSlots.length
    }
    return DEFAULT_PROMPT_SLOTS
  }

  private getRotateSeconds(): number {
    return this.rotateSeconds > 0 ? this.rotateSeconds : DEFAULT_ROTATE_SECONDS
  }

  private getContextPollSeconds(): number {
    return this.contextPollSeconds > 0 ? this.contextPollSeconds : DEFAULT_CONTEXT_POLL_SECONDS
  }

  private isActive(sceneObject: SceneObject | null): boolean {
    if (!sceneObject) {
      return false
    }

    let current: SceneObject | null = sceneObject
    while (current) {
      if (!current.enabled) {
        return false
      }
      current = current.getParent()
    }
    return true
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text
    }
    return text.substring(0, Math.max(0, maxLength - 3)) + "..."
  }
}
