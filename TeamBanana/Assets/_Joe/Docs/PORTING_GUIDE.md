# Agentic Playground — Architecture & Porting Guide

> **Purpose**: This document describes every meaningful subsystem in the Agentic Playground project so that an agent (human or AI) can port the core concepts into another codebase without reading 30+ files first. It focuses on **what each module does**, **how they connect**, and **what you must preserve vs. what you can replace**.

---

## 1. Project Identity

- **Platform**: Snap Spectacles (2024) — AR glasses running Lens Studio 5.15+
- **Language**: TypeScript (Lens Studio's component model: `@component`, `@input`, `BaseScriptComponent`)
- **AI Providers**: OpenAI (Realtime API), Gemini (Live API with vision), Snap3D (3D generation)
- **External Packages**: `RemoteServiceGateway.lspkg` (API proxy), `SpectaclesInteractionKit.lspkg` (UI kit), `SpectaclesUIKitBeta.lspkg` (UI components), `Keyword Detection.lspkg` (wake word)

The project started as a **lecture summarization assistant** and evolved into a **butterfly outdoor education system** with two collaborating AI agents. Both modes share the same infrastructure.

---

## 2. High-Level Architecture (The Big Picture)

```
┌─────────────────────────────────────────────────┐
│                    USER INPUT                     │
│         (Voice via mic, camera frames)            │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│              AGENT ORCHESTRATOR                   │
│  Central coordinator — owns the query lifecycle   │
│  Creates: LanguageInterface, Router, Coordinator  │
└─────────────────────┬───────────────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
┌─────────▼──────────┐  ┌────────▼──────────┐
│   AGENT ROUTER     │  │ AGENT COORDINATOR │
│ "Which agent?"     │  │ "Agents talking   │
│  scores all agents │  │  to each other"   │
└─────────┬──────────┘  └────────┬──────────┘
          │                       │
    ┌─────┴─────┐                 │
    │           │                 │
┌───▼────┐ ┌───▼────┐            │
│NATURAL-│ │ARCHIV- │◄───────────┘
│IST     │ │IST     │  (coordination
│gentle  │ │enthusi-│   requests)
│Socratic│ │astic   │
└───┬────┘ └───┬────┘
    │          │
    │    ┌─────┘
    │    │
┌───▼────▼──────────────────────────────────────┐
│              AGENT LANGUAGE INTERFACE           │
│  Unified abstraction over OpenAI + Gemini       │
│  Smart switching: Gemini for vision, etc.       │
└────────────────────┬──────────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
┌────▼─────┐  ┌──────▼──────┐  ┌────▼─────┐
│ OpenAI   │  │  Gemini     │  │ Fallback │
│ Realtime │  │  Live API   │  │ (offline)│
│ API      │  │  (vision)   │  │          │
└──────────┘  └─────────────┘  └──────────┘

TOOLS (consumed by agents):
  SpatialTool | GeneralConversationTool | LocationTool | WeatherTool
```

**Key Insight**: The system has **two routing layers**:
1. **Agent routing** (`AgentRouter`) — picks Naturalist vs. Archivist based on query intent
2. **Tool routing** (`ToolRouter`) — legacy system that picks Spatial vs. General tool directly (no agent personalities)

The agent system (layer 1) is the primary path; tool routing (layer 2) is the fallback.

---

## 3. Component Inventory (What to Port)

### 3.1 Type Definitions — `AgentTypes.ts`

The single source of truth for all interfaces. **Port this first.**

| Interface | Purpose | Key Fields |
|-----------|---------|------------|
| `Tool` | Every tool implements this contract | `name`, `description`, `parameters` (JSON Schema), `execute(args) → ToolResult` |
| `ToolResult` | Standard tool return type | `success`, `result?`, `error?`, `executionTime` |
| `Message` | LLM conversation message | `role` ("system"/"user"/"assistant"/"tool"), `content`, `imageData?` |
| `LLMResponse` | Unified LLM return | `content`, `toolCalls?`, `finishReason`, `usage?` |
| `LLMOptions` | Generation config | `temperature?`, `maxTokens?`, `textOnly?` (voice on/off) |
| `ChatMessage` | UI-facing message | `id`, `type` ("user"/"bot"), `content`, `timestamp` |
| `SystemState` | Global state | `currentStep`, `chatHistory`, `sessionId` |
| `ToolCall` | LLM-requested tool invocation | `id`, `name`, `arguments` (JSON string) |
| `AgentConfiguration` | Inspector config | `enableSystem`, `defaultProvider`, `enableTestMode`, etc. |

### 3.2 Agent Orchestrator — `AgentOrchestrator.ts`

**The main entry point.** Every user query flows through `processUserQuery()`.

```
Owns:
  - AgentLanguageInterface (AI provider abstraction)
  - AgentMemorySystem (conversation memory)
  - AgentRouter (agent selection)
  - AgentCoordinator (agent collaboration)

Flow:
  User speaks → Gemini Live transcribes → processUserQuery(query)
    → If agent system enabled: agentRouter.routeQuery() → agent.execute()
    → If coordination requested: agentCoordinator handles cross-agent talk
    → Voice response streams back via Gemini/OpenAI Live API
    → Store in memory + ChatStorage
```

**Key Methods**:
- `processUserQuery(query, context?)` → main entry, returns response string
- `processWithAgentSystem(query, context?)` → agent routing + execution + coordination
- `handleUserSpeech({text, isFinal})` → Gemini Live transcription → routes to agent system
- `resetSystem()` → clears memory, storage, agent state
- `getConversationContext()` → last N messages for LLM context

**Events (observable)**:
- `onQueryReceived`, `onQueryProcessed`, `onVoiceCompleted`
- `onAgentChanged` — fires when routing switches between Naturalist/Archivist
- `onCoordinationStarted`, `onCoordinationCompleted`
- `onError`, `onSystemReset`

**Configuration**:
- `enableAgentSystem: boolean` — toggle between multi-agent vs. legacy tool routing
- `defaultAgent: "naturalist" | "archivist"`
- `defaultProvider: "openai" | "gemini"`
- `conversationContextMessages: number` — how many past messages sent to LLM
- `coordinationDepthLimit: number` — max coordination round-trips

### 3.3 Agent Router — `AgentRouter.ts`

**Scores every agent's confidence** for a given query, picks the winner.

```
routeQuery(query, context?) → RoutingDecision {
  selectedAgent, confidence, reasoning, alternativeAgents
}
```

- Evaluates all registered agents via `agent.canHandleQuery()`
- Each agent returns a 0-1 confidence score based on keyword matching
- Picks highest-confidence agent above threshold (default 0.6)
- Falls back to `fallbackAgent` if no agent meets threshold
- Maintains routing history for debugging

**Agent Registration**: Just call `registerAgent(agent: IOutdoorAgent)`.

### 3.4 Agent Coordinator — `AgentCoordinator.ts`

**Manages when agents talk to each other.** When Naturalist identifies a butterfly but needs species knowledge, it fires a coordination request to the Archivist.

- Priority queue for coordination requests
- Depth limiting (prevents infinite ping-pong)
- Speaker change announcements
- Configurable timeout per coordination

### 3.5 Outdoor Agent Base — `OutdoorAgent.ts`

Abstract base class both agents extend. **If you're adding a new agent, extend this.**

```typescript
interface IOutdoorAgent {
  readonly name: string
  readonly agentType: "naturalist" | "archivist"
  readonly personality: AgentPersonality  // tone, teachingStyle, etc.
  execute(args) → OutdoorAgentResponse
  canHandleQuery(query, context?) → number  // 0-1 confidence
  registerTool(tool: Tool)
  requestCoordination(otherAgent, context) → response
}
```

`AgentPersonality` defines:
- `tone`: "gentle" | "enthusiastic"
- `teachingStyle`: "socratic" | "storyteller"
- `responseStyle.pacing`: "measured" | "energetic"
- `responseStyle.curiosityLevel`: 0-1 (how much to ask questions)
- `responseStyle.storytelling`: 0-1 (how much to share facts)

### 3.6 Naturalist Agent — `NaturalistAgent.ts`

**Gentle Socratic discovery guide** (green, `#4CAF50`).

- Keywords: "what should I look for", "notice", "observe", "pattern", "behavior", "plant", "flower"
- High curiosity (0.9), low storytelling (0.3)
- Maintains `discoveryState` tracking: environment noticed, plants identified, butterfly sighted
- Generates Socratic follow-ups: "What patterns do you notice...?"
- Delegates to Archivist when: species identification needed, user has made multiple observations

### 3.7 Archivist Agent — `ArchivistAgent.ts`

**Enthusiastic storyteller and knowledge curator** (orange, `#FF5722`).

- Keywords: "identify", "what kind", "tell me about", "why", "how do they", "life cycle"
- High storytelling (0.9), low curiosity (0.4)
- Integrates with `MockButterflyKnowledge` for species data (replace with real API)
- Delegates to Naturalist when: user should be guided to observe rather than just learn facts

### 3.8 Agent Language Interface — `AgentLanguageInterface.ts`

**The most critical infrastructure file.** Abstracts all AI provider differences.

```
Key responsibilities:
1. Provider selection (auto-switches Gemini for vision)
2. Session lifecycle (create, check readiness, reset)
3. Response generation (two modes)
4. Audio streaming control
5. Multimodal message handling (text + image)
6. Fallback responses when APIs unavailable
```

**Two generation modes**:
- `generateResponse(messages, options?)` → voice output (Live/Realtime API), returns placeholder + streams audio
- `generateTextResponse(messages, options?)` → text-only (Chat Completions / Models API), returns string directly

**Provider switching logic**:
- Detects `imageData` in messages → forces Gemini (vision support)
- Falls back OpenAI→Gemini or Gemini→OpenAI if one unavailable
- Respects `textOnly: true` flag for silent routing decisions

**Session management**:
- OpenAI: `createOpenAIRealtimeSession()`
- Gemini: `createGeminiLiveSession()` → WebSocket + setup handshake
- `waitForSessionReady(ms)` — blocks until session is ready

**Voice transcription**: Collected via event listeners, accumulated with silence detection (2s silence → finalize).

### 3.9 Tool System

#### ToolRouter (`ToolRouter.ts`) — Legacy, pre-agent routing
- AI-powered selection between `spatial_tool` and `general_conversation`
- Uses LLM call with routing prompt → extracts tool name from response
- Falls back to `general_conversation` on any error
- Indexed tools have: name, description, capabilities[], useWhen[]

#### SpatialTool (`SpatialTool.ts`) — Camera + AI vision
- Captures camera frame via `VideoController`
- Sends image to Gemini Live for visual analysis
- Supports `butterflyHabitatFocus` mode (plant ID, microclimate assessment)
- Accepts `environmentalConditions` (sunlight, temperature, wind) for habitat scoring
- Returns habitat quality score + species suggestions

#### GeneralConversationTool (`GeneralConversationTool.ts`) — Default chat
- Basic conversational AI with educational focus
- Character-constrained (300 chars for AR display)
- Voice output by default

#### LocationTool (`LocationTool.ts`) — GPS
- Wraps Spectacles `LocationService.getCurrentPosition()`
- 30-second cache
- Haversine distance calculation between coordinates
- No API key needed — uses device GPS

#### WeatherTool (`WeatherTool.ts`) — Environmental data
- Wraps Spectacles `UserContextSystem` (temperature + weather condition)
- 60-second cache
- `isButterflyWeather()` — temperature 10-35°C + sunny/partly cloudy
- `getButterflyActivityLevel()` — "high" (18-30°C + clear), "moderate", "low"
- `getSunlightLevel()` — "direct" | "filtered" | "shade"
- `getWindLevel()` — "calm" | "moderate" | "windy"

### 3.10 Core AI Assistants

#### GeminiAssistant (`GeminiAssistant.ts`)
- Manages Gemini Live WebSocket connection
- Model: `gemini-2.0-flash-live-preview-04-09`
- Handles: audio I/O (mic → PCM chunks → Live API → PCM → speaker), video I/O (camera → JPEG frames → Live API)
- Voice selection (8 voices: Puck, Charon, Kore, Fenrir, etc.)
- Push-to-talk via scene MicButton
- Events: `updateTextEvent`, `userSpeechEvent`, `functionCallEvent`, `onSetupComplete`
- Send methods: `sendTextMessage()`, `sendImageMessage()`, `sendFunctionCallUpdate()`
- Tool declarations: Snap3D generation function

#### OpenAIAssistant (`OpenAIAssistant.ts`)
- OpenAI Realtime API for voice conversation
- Chat Completions API for text-only (model: `gpt-4o-mini`)
- `streamData(bool)` — start/stop audio streaming
- `sendMessageWithAudio()` — voice output mode
- `interruptAudioOutput()` — stop current speech

### 3.11 Storage System

#### StorageManager (`StorageManager.ts`) — Centralized coordinator
- Wraps `ChatStorage`
- `resetAllStorage()`, `resetStorage("chat")`
- `getChatContext(maxMessages)` — for LLM context injection

#### AgentMemorySystem (`AgentMemorySystem.ts`)
- In-memory + PersistentStorage (10MB limit)
- `addChatMessage()`, `getChatHistory()`, `getRecentChatMessages()`
- Auto-truncates at 500 messages (messages) / 100 chat entries
- Session management: `startNewSession()`, `endCurrentSession()`

### 3.12 Tool Executor — `AgentToolExecutor.ts`

General-purpose tool runner with:
- Parameter type validation (string, number, boolean, array, object, enum)
- 15-second execution timeout
- Error handling + display updates
- `executeToolCall(toolCall)` — parses JSON args from LLM tool calls

---

## 4. Key Design Patterns to Preserve

### Pattern 1: AI-First Tool Selection
Instead of hard-coded `if (query.includes("camera")) → use spatial`, the system **asks an LLM to pick the tool** based on descriptions. This means:
- Adding a new tool only requires registering it with a good description
- The LLM handles ambiguous cases naturally
- The routing prompt is the control surface

### Pattern 2: Agent Personality via System Prompts
Each agent's personality lives entirely in its `getSystemPrompt()` method. The prompt defines tone, language patterns, teaching approach, and response constraints. **Porting this means porting the prompt engineering, not just the code.**

### Pattern 3: Provider Abstraction with Capability-Based Switching
`AgentLanguageInterface` checks message content for `imageData` → forces Gemini. Tests provider availability → falls back. This means you can add new providers by implementing the same interface.

### Pattern 4: Voice-First with Text Fallback
Default is voice output (Live/Realtime APIs). Pass `textOnly: true` to `LLMOptions` for silent/internal queries (tool routing, text generation). The orchestrator handles transcription accumulation + silence detection.

### Pattern 5: Coordination via Events + Priority Queue
Agents don't call each other directly. They fire `onCoordinationRequested` events. The `AgentCoordinator` queues them by priority, enforces depth limits, and executes them asynchronously.

### Pattern 6: Tool Interface Standard
Every tool has: `name`, `description`, `parameters` (JSON Schema), `execute(args) → {success, result?, error?, executionTime}`. This makes tools pluggable and LLM-callable.

---

## 5. Data Flow: A Complete Query Walkthrough

```
1. User speaks → MicrophoneRecorder → GeminiAssistant (PCM audio)
2. Gemini Live API transcribes → userSpeechEvent(isFinal: true)
3. AgentOrchestrator.handleUserSpeech() → processUserQuery("What butterflies might be here?")
4. AgentOrchestrator.processWithAgentSystem():
   a. AgentRouter.routeQuery() — evaluates Naturalist (0.85) vs Archivist (0.3)
   b. Selects Naturalist (meets 0.6 threshold)
   c. NaturalistAgent.execute({query, context, maxLength: 300})
   d. Naturalist builds messages: [systemPrompt, conversation_history, user_query]
   e. AgentLanguageInterface.generateResponse(messages)
   f. Since textOnly: false → uses Gemini Live API with voice output
   g. Naturalist checks shouldRequestCoordination() → species ID? → requests Archivist
5. Response streams as audio through DynamicAudioOutput
6. Text transcription accumulated → AgentOrchestrator stores in ChatStorage + Memory
7. UI updated with agent indicator: "🌿 Naturalist"
```

---

## 6. External Dependencies (What You Can't Change)

| Dependency | Purpose | API Pattern |
|------------|---------|-------------|
| `RemoteServiceGateway.lspkg/HostedExternal/Gemini` | Gemini Live + Models API | `Gemini.liveConnect()`, `Gemini.models(request)` |
| `RemoteServiceGateway.lspkg/HostedExternal/OpenAI` | OpenAI Chat Completions | `OpenAI.chatCompletions(request)` |
| `RemoteServiceGateway.lspkg/Helpers/VideoController` | Camera frame capture | `new VideoController(interval, quality, encoding)` |
| `RemoteServiceGateway.lspkg/Helpers/AudioProcessor` | Audio encoding | Processes mic frames → PCM chunks |
| `RemoteServiceGateway.lspkg/Helpers/DynamicAudioOutput` | Audio playback | `addAudioFrame(pcmData)`, `interruptAudioOutput()` |
| `RemoteServiceGateway.lspkg/Helpers/MicrophoneRecorder` | Mic capture | `startRecording()`, `stopRecording()`, `onAudioFrame` |
| `SpectaclesInteractionKit.lspkg/Utils/Event` | Event system | `Event<T>`, `.add(handler)`, `.invoke(data)` |
| `SpectaclesInteractionKit.lspkg/Utils/FunctionTimingUtils` | Timers | `setTimeout`, `clearTimeout` |
| `SpectaclesInteractionKit.lspkg/Components/UI/PinchButton` | Pinch interaction | Button component for push-to-talk |
| Spectacles `LocationService` | GPS | `getCurrentPosition(success, error)` |
| Spectacles `UserContextSystem` | Weather | `requestTemperatureCelsius(cb)`, `requestWeatherCondition(cb)` |

---

## 7. Porting Strategy (Recommended Order)

### Phase 1: Type Foundation
1. Port `AgentTypes.ts` — all interfaces
2. Port `TextLimiter.ts` — character limit utility

### Phase 2: AI Provider Layer
3. Port `AgentLanguageInterface.ts` — adapt to your provider setup
4. Port or replace `GeminiAssistant.ts` / `OpenAIAssistant.ts` — depends on your AI backend

### Phase 3: Tool System
5. Port `AgentToolExecutor.ts` — generic tool runner
6. Port `GeneralConversationTool.ts` — simplest tool, good test
7. Port `SpatialTool.ts` — only if you need camera vision
8. Port `LocationTool.ts` / `WeatherTool.ts` — device-dependent

### Phase 4: Agent System
9. Port `OutdoorAgent.ts` — base class
10. Port one agent (e.g., `NaturalistAgent.ts`) — test end-to-end
11. Port `AgentRouter.ts` — connect to your agent
12. Port `AgentCoordinator.ts` — only if you need multi-agent dialogue
13. Port second agent (`ArchivistAgent.ts`)

### Phase 5: Orchestration & Storage
14. Port `AgentMemorySystem.ts` — adapt persistence layer
15. Port `AgentOrchestrator.ts` — wire everything together

### What You Can Skip
- `ToolRouter.ts` — legacy system, the AgentRouter replaces it
- `ChatComponent.ts`, `ChatBridge.ts`, `SummaryComponent.ts` — UI components, reimplement for your platform
- `ImageGen.ts`, `ModelGen.ts`, `ModelGenBridge.ts` — 3D generation, platform-specific
- `GenerationQueue.ts`, `ModelGenerationScheduler.ts` — queue management for 3D generation
- `MindMapSpatialUtils.ts`, `TreeStructureUtils.ts`, `MindNodeBehaviors.ts`, `Line3D.ts` — 3D mind map visualization
- `ImageNode.ts`, `ModelNode.ts`, `TextNode.ts` — UI node types
- `APIKeyHint.ts`, `InternetAvailabilityPopUp.ts` — helper UI

---

## 8. Critical Configuration Points

When porting, these settings control system behavior:

```typescript
// AgentOrchestrator config
enableAgentSystem: boolean = true      // false = legacy tool routing
defaultAgent: "naturalist" | "archivist"
defaultProvider: "openai" | "gemini"
conversationContextMessages: number = 10  // How many past messages → LLM
coordinationDepthLimit: number = 3        // Max cross-agent round-trips

// AgentRouter config
confidenceThreshold: number = 0.6     // Min score to select an agent
fallbackAgent: string = "naturalist"

// LLMOptions (per-request)
textOnly: boolean                     // true = silent (routing); false = voice output
temperature: number                   // 0.7-0.9 depending on creativity needed
maxTokens: number                     // Constrain response length

// Character limits (AR-optimized)
GeneralConversation: 300 chars
SpatialTool: 300 chars
Agent responses: 300 chars max
```

---

## 9. Multi-Agent Collaboration Patterns

This is the most innovative part. Two patterns to understand:

### Pattern A: Agent-Initiated Coordination
```
Naturalist responds → detects species identification needed
  → returns { requiresCoordination: { targetAgent: "archivist", ... } }
  → AgentOrchestrator calls handleAgentCoordination()
  → AgentCoordinator queues request with priority
  → Archivist executes with coordination context
  → Combined response returned to user
```

### Pattern B: Router-Initiated Coordination
```
Router sees query needs both agents (e.g., "identify AND find more")
  → Picks highest-confidence but marks alternative
  → Coordinator can pre-emptively engage both
```

**The `canHandleQuery()` method is the key**: each agent scores its own confidence (0-1) by keyword matching. The router picks the winner. Agents can also request coordination after generating their response.

---

## 10. Files Quick Reference

| File | Lines | Role | Port Priority |
|------|-------|------|---------------|
| `Agents/AgentTypes.ts` | 211 | All shared interfaces | **P0 — First** |
| `Agents/AgentLanguageInterface.ts` | 937 | AI provider abstraction | **P0 — Critical** |
| `Agents/AgentOrchestrator.ts` | 1017 | Main coordinator | **P0 — Critical** |
| `Agents/OutdoorAgent.ts` | 269 | Agent base class | **P1 — Foundation** |
| `Agents/AgentRouter.ts` | 357 | Agent selection | **P1 — Foundation** |
| `Agents/NaturalistAgent.ts` | 322 | Socratic guide | **P1 — Example agent** |
| `Agents/ArchivistAgent.ts` | 388 | Knowledge storyteller | P2 |
| `Agents/AgentCoordinator.ts` | 382 | Cross-agent dialogue | P2 |
| `Agents/AgentMemorySystem.ts` | 376 | Memory + persistence | P2 |
| `Agents/AgentToolExecutor.ts` | 337 | Tool runner | P2 |
| `Tools/GeneralConversationTool.ts` | 180 | Default chat | P1 |
| `Tools/SpatialTool.ts` | 555 | Vision + camera | P2 |
| `Tools/LocationTool.ts` | 191 | GPS | P3 |
| `Tools/WeatherTool.ts` | 294 | Weather | P3 |
| `Tools/ToolRouter.ts` | 226 | Legacy router | Skip (replaced by AgentRouter) |
| `Tools/index.ts` | 32 | Tool exports + factory | P3 |
| `Core/GeminiAssistant.ts` | 486 | Gemini Live WebSocket | **P0** (if using Gemini) |
| `Core/OpenAIAssistant.ts` | ~261 | OpenAI Realtime | **P0** (if using OpenAI) |
| `Storage/StorageManager.ts` | 220 | Storage coordinator | P2 |
| `Utils/TextLimiter.ts` | ~50 | Character limit helper | P1 |

---

## 11. Porting Checklist for Agents

When porting to a new repo, verify:

- [ ] `AgentTypes.ts` interfaces are intact (especially `Tool`, `Message`, `LLMResponse`, `LLMOptions`)
- [ ] `AgentLanguageInterface` can generate both voice (`generateResponse`) and text (`generateTextResponse`) responses
- [ ] At least one agent extends a base class with `execute()`, `canHandleQuery()`, `getSystemPrompt()`
- [ ] `AgentRouter` evaluates all agents and picks by confidence
- [ ] Tool contract is consistent: `{ name, description, parameters, execute() → {success, result?, error?} }`
- [ ] Voice transcription flow: mic → Live API → transcription events → orchestrator
- [ ] Character limits are enforced (300 chars for AR display)
- [ ] Fallback responses exist for when AI APIs are unavailable
- [ ] Event system connects components without hard references
- [ ] Storage/memory system handles the 10MB persistent storage limit

---

*Generated from full codebase analysis. Last updated: 2026-06-14.*
