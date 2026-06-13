# Agentic Playground

[![SIK](https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3)](https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview) [![Remote Service Gateway](https://img.shields.io/badge/Remote%20Service%20Gateway-Light%20Gray?color=D3D3D3)](https://developers.snap.com/spectacles/about-spectacles-features/apis/remoteservice-gateway) [![Text To Speech](https://img.shields.io/badge/Text%20To%20Speech-Light%20Gray?color=D3D3D3)](https://developers.snap.com/spectacles/about-spectacles-features/compatibility-list) [![Speech To Text](https://img.shields.io/badge/Speech%20To%20Text-Light%20Gray?color=D3D3D3)](https://developers.snap.com/spectacles/about-spectacles-features/compatibility-list) [![Camera Access](https://img.shields.io/badge/Camera%20Access-Light%20Gray?color=D3D3D3)](https://developers.snap.com/spectacles/about-spectacles-features/apis/camera-module) [![AI Vision](https://img.shields.io/badge/AI%20Vision-Light%20Gray?color=D3D3D3)](https://developers.snap.com/spectacles/about-spectacles-features/compatibility-list) [![LLM](https://img.shields.io/badge/LLM-Light%20Gray?color=D3D3D3)](https://developers.snap.com/spectacles/about-spectacles-features/compatibility-list)

**A Multi-Agent AI System for Snap Spectacles — Outdoor Education & Discovery**

An immersive AR experience featuring two collaborating AI agents — a Naturalist and an Archivist — that help users discover and learn about the natural world through voice, camera, and spatial awareness. Built on a modular agent architecture with AI-powered tool routing, cross-agent coordination, and real-time multimodal processing.

> **NOTE:**
> This project runs on the **Spectacles platform**. Set the simulation mode in Lens Studio Preview to `Spectacles (2024)`. You must provide your own **Remote Service Gateway API Token** for AI functionality.

---

## Project Overview

Agentic Playground is a sophisticated multi-agent AI system that enables:

- **Dual-Agent Collaboration**: Two AI agents with distinct personalities work together — a Naturalist guides discovery through Socratic questioning, while an Archivist enriches observations with facts and stories
- **AI-Powered Routing**: LLM-based query analysis selects the best agent or tool for each request (no hard-coded rules)
- **Voice-First Interaction**: Real-time speech-to-text and text-to-speech via Gemini Live and OpenAI Realtime APIs
- **Spatial Awareness**: Camera-based environmental analysis using Gemini's vision capabilities
- **Environmental Sensing**: GPS location and weather tools for contextual awareness
- **Persistent Memory**: Cross-session conversation history with automatic storage management

### Agent Architecture

The system uses two specialized agents with distinct teaching styles:

| Agent | Role | Tone | Teaching Style | Visual |
|-------|------|------|----------------|--------|
| **Naturalist** | Discovery guide | Gentle, patient | Socratic — asks questions to stimulate thinking | Green (`#4CAF50`) |
| **Archivist** | Knowledge curator | Enthusiastic, passionate | Storyteller — brings facts to life through narrative | Orange (`#FF5722`) |

**Collaboration**: Agents can request coordination with each other mid-conversation. For example, the Naturalist guides observation of a butterfly, then the Archivist jumps in with species facts and migration stories. A priority queue and depth limiter prevent coordination loops.

---

## System Architecture

### High-Level Flow

```
User Voice Input
      |
      v
Gemini Live API (speech transcription)
      |
      v
AgentOrchestrator  <--  processUserQuery()
      |
      +---> AgentRouter ---> Scores both agents, picks winner
      |         |
      |         +---> NaturalistAgent ---> Socratic discovery response
      |         |         |
      |         |         +---> Coordination request ---> ArchivistAgent
      |         |
      |         +---> ArchivistAgent ---> Storytelling knowledge response
      |                   |
      |                   +---> Coordination request ---> NaturalistAgent
      |
      +---> AgentCoordinator ---> Manages cross-agent dialogue queue
      |
      +---> AgentLanguageInterface ---> Unified OpenAI/Gemini provider
                |
                +---> OpenAI Realtime API (voice)
                +---> Gemini Live API (voice + vision)
                +---> Fallback (offline responses)
```

### Layer Architecture

```
+-------------------------------------------+
|                UI LAYER                   |
|    ChatComponent  .  ChatBridge           |
+-------------------------------------------+
|             ORCHESTRATION                 |
|    AgentOrchestrator                      |
+-------------------------------------------+
|             AGENT SYSTEM                  |
|    AgentRouter  .  AgentCoordinator       |
|    NaturalistAgent  .  ArchivistAgent     |
|    OutdoorAgent (base)                    |
+-------------------------------------------+
|             TOOL SYSTEM                   |
|    SpatialTool  .  GeneralConversationTool|
|    LocationTool  .  WeatherTool           |
|    AgentToolExecutor                      |
+-------------------------------------------+
|           AI PROVIDER LAYER               |
|    AgentLanguageInterface                 |
|    GeminiAssistant  .  OpenAIAssistant    |
+-------------------------------------------+
|           STORAGE LAYER                   |
|    StorageManager  .  AgentMemorySystem   |
|    ChatStorage                            |
+-------------------------------------------+
```

### Component Flow (Voice Query)

```
Student speaks → Gemini Live transcribes → AgentOrchestrator.handleUserSpeech()
  → processUserQuery(query)
    → AgentRouter.routeQuery() — evaluates Naturalist vs Archivist confidence
    → Selected agent.execute({query, context, maxLength: 300})
    → AgentLanguageInterface.generateResponse(messages)
      → Gemini Live or OpenAI Realtime (voice output)
    → Agent checks shouldRequestCoordination()
      → If yes: AgentCoordinator queues cross-agent request
    → Response streams as audio + text
  → Store in AgentMemorySystem + ChatStorage
```

---

## Core Components

### Agent System

| Component | File | Purpose |
|-----------|------|---------|
| **AgentOrchestrator** | `Agents/AgentOrchestrator.ts` | Central coordinator — owns query lifecycle, wires all subsystems |
| **AgentRouter** | `Agents/AgentRouter.ts` | Scores agent confidence (0-1) per query, picks winner above threshold |
| **AgentCoordinator** | `Agents/AgentCoordinator.ts` | Priority queue for cross-agent coordination, prevents infinite loops |
| **OutdoorAgent** | `Agents/OutdoorAgent.ts` | Abstract base class — defines `execute()`, `canHandleQuery()`, personality contract |
| **NaturalistAgent** | `Agents/NaturalistAgent.ts` | Socratic discovery guide — high curiosity, asks questions, tracks discovery state |
| **ArchivistAgent** | `Agents/ArchivistAgent.ts` | Enthusiastic storyteller — high storytelling, shares facts, integrates knowledge base |
| **AgentLanguageInterface** | `Agents/AgentLanguageInterface.ts` | Unified provider abstraction — auto-switches Gemini for vision, handles sessions |
| **AgentToolExecutor** | `Agents/AgentToolExecutor.ts` | Validates tool parameters, executes with timeout, error handling |
| **AgentTypes** | `Agents/AgentTypes.ts` | All shared interfaces: `Tool`, `Message`, `LLMResponse`, `ToolResult`, etc. |

### Tool System

| Tool | File | Purpose |
|------|------|---------|
| **SpatialTool** | `Tools/SpatialTool.ts` | Camera frame capture → Gemini vision analysis of environment |
| **GeneralConversationTool** | `Tools/GeneralConversationTool.ts` | Default conversational AI with educational focus |
| **LocationTool** | `Tools/LocationTool.ts` | GPS via Spectacles `LocationService` (30s cache, Haversine distance) |
| **WeatherTool** | `Tools/WeatherTool.ts` | Weather via Spectacles `UserContextSystem` (60s cache, butterfly activity scoring) |

### Core AI Assistants

| Component | File | Purpose |
|-----------|------|---------|
| **GeminiAssistant** | `Core/GeminiAssistant.ts` | Gemini Live WebSocket — model `gemini-2.0-flash-live-preview-04-09`, handles audio I/O, video streaming, transcription |
| **OpenAIAssistant** | `Core/OpenAIAssistant.ts` | OpenAI Realtime API (voice) + Chat Completions API (`gpt-4o-mini` for text-only) |

### Storage

| Component | File | Purpose |
|-----------|------|---------|
| **StorageManager** | `Storage/StorageManager.ts` | Centralized coordinator for all storage, reset controls |
| **ChatStorage** | `Storage/ChatStorage.ts` | Conversation history persistence, session management |
| **AgentMemorySystem** | `Agents/AgentMemorySystem.ts` | Message/chat history with auto-truncation at 500 messages, 10MB limit |

---

## Key Design Patterns

### 1. AI-Powered Routing
Instead of hard-coded `if/else` rules, the system asks an LLM to select the appropriate tool or agent. Each tool/agent is described with capabilities and use-cases; the LLM analyzes the query and picks the best match. **Adding a new tool only requires registration with a good description.**

### 2. Agent Personality via Prompts
Each agent's entire personality — tone, teaching style, language patterns, response constraints — is defined in its `getSystemPrompt()` method. No code changes needed to adjust agent behavior; modify the prompt.

### 3. Provider Abstraction with Capability Switching
`AgentLanguageInterface` detects `imageData` in messages → forces Gemini (vision support). Tests provider availability → automatic fallback. Two generation modes: voice (`generateResponse`) vs. text-only (`generateTextResponse`).

### 4. Voice-First with Text Fallback
Default mode streams audio via Live/Realtime APIs. Pass `textOnly: true` in `LLMOptions` for silent/internal queries (tool routing, text generation). Transcription is accumulated with 2-second silence detection for finalization.

### 5. Coordinated Multi-Agent Dialogue
Agents communicate via event-driven coordination requests with priority queuing. The `AgentCoordinator` enforces depth limits and manages speaker transitions, preventing infinite ping-pong.

### 6. Standard Tool Contract
Every tool implements: `{ name, description, parameters (JSON Schema), execute(args) → {success, result?, error?, executionTime} }`. Tools are pluggable and LLM-callable.

---

## Code Structure

```
Assets/AgenticPlayground/Scripts/
├── Agents/
│   ├── AgentTypes.ts              # All shared interfaces
│   ├── AgentOrchestrator.ts       # Central coordinator
│   ├── AgentRouter.ts             # Agent selection by confidence scoring
│   ├── AgentCoordinator.ts        # Cross-agent dialogue management
│   ├── AgentLanguageInterface.ts  # OpenAI/Gemini provider abstraction
│   ├── AgentToolExecutor.ts       # Tool validation + execution
│   ├── AgentMemorySystem.ts       # Conversation persistence
│   ├── OutdoorAgent.ts            # Abstract agent base class
│   ├── NaturalistAgent.ts         # Socratic discovery guide
│   └── ArchivistAgent.ts          # Enthusiastic knowledge storyteller
├── Tools/
│   ├── index.ts                   # Tool exports + factory function
│   ├── SpatialTool.ts             # Camera + vision analysis
│   ├── GeneralConversationTool.ts # Default conversation
│   ├── LocationTool.ts            # GPS location services
│   └── WeatherTool.ts             # Weather + butterfly activity
├── Core/
│   ├── GeminiAssistant.ts         # Gemini Live WebSocket manager
│   └── OpenAIAssistant.ts         # OpenAI Realtime + Chat Completions
├── Storage/
│   └── StorageManager.ts          # Centralized storage coordinator
├── Components/
│   ├── ChatComponent.ts           # Chat UI
│   └── ChatBridge.ts              # Chat UI-data bridge
└── Utils/
    └── TextLimiter.ts             # Character limit enforcement
```

---

## API Integrations

| Service | Model/API | Used For |
|---------|-----------|----------|
| **Gemini Live** | `gemini-2.0-flash-live-preview-04-09` | Voice conversation + camera vision + transcription |
| **OpenAI Realtime** | GPT-4o Realtime | Voice conversation (alternative provider) |
| **OpenAI Chat** | `gpt-4o-mini` | Text-only responses, tool routing decisions |
| **Spectacles LocationService** | Device GPS | Latitude, longitude, altitude, accuracy |
| **Spectacles UserContextSystem** | Device sensors | Temperature, weather conditions |

---

## Configuration

Key settings that control system behavior:

| Setting | Location | Default | Purpose |
|---------|----------|---------|---------|
| `enableAgentSystem` | AgentOrchestrator | `true` | Toggle multi-agent vs. legacy tool routing |
| `defaultAgent` | AgentOrchestrator | `"naturalist"` | Starting agent for new sessions |
| `defaultProvider` | AgentOrchestrator | `"openai"` | Primary AI provider |
| `confidenceThreshold` | AgentRouter | `0.6` | Min score to select an agent |
| `coordinationDepthLimit` | AgentOrchestrator | `3` | Max cross-agent round-trips |
| `conversationContextMessages` | AgentOrchestrator | `10` | Past messages sent to LLM |
| `toolTimeout` | AgentToolExecutor | `15000` | Tool execution timeout (ms) |

---

## Prerequisites

- **Lens Studio**: v5.15.0+
- **Spectacles OS**: v5.64+
- **Spectacles App iOS**: v0.64+
- **Spectacles App Android**: v0.64+
- **Git LFS**: Required for project assets

To update your Spectacles device and mobile app: [Spectacles Update Guide](https://support.spectacles.com/hc/en-us/articles/30214953982740-Updating)

Download Lens Studio from [ar.snap.com](https://ar.snap.com/download?lang=en-US)

---

## Setup

### 1. Clone the Repository

This project uses Git LFS. A zip download **will not work** — you must clone:

```bash
git clone [repository-url]
```

Install Git LFS from [git-lfs.github.com](https://git-lfs.github.com/) if needed.

### 2. Remote Service Gateway Token

1. Install **Remote Service Gateway Token Generator** from Lens Studio Asset Library (Spectacles section)
2. Open: **Windows** → **Remote Service Gateway Token**
3. Click **Generate Token** and copy it
4. Paste the token into `RemoteServiceGatewayCredentials` in your scene

The token enables access to OpenAI API, Gemini API, and Snap3D API.

### 3. Open in Lens Studio

1. Open the project in Lens Studio v5.15.0+
2. Set **Device Type Override** to `Spectacles (2024)` in the Preview panel
3. Ensure dependencies are imported: Remote Service Gateway, SpectaclesInteractionKit

### 4. Testing

- Use headphones to prevent audio feedback during preview
- Enable `enableDebugLogging` for detailed console output
- Voice interactions work through the MicButton (push-to-talk) or automatic activity detection

---

## Adding New Agents

1. Extend `OutdoorAgent`:

```typescript
export class MyAgent extends OutdoorAgent {
  public readonly name = "my_agent"
  public readonly agentType = "naturalist" // or "archivist"

  public readonly personality: AgentPersonality = {
    tone: "gentle",
    teachingStyle: "socratic",
    philosophy: "Your agent's guiding philosophy",
    languagePatterns: ["What do you notice...", "Have you seen..."],
    responseStyle: {
      pacing: "measured",
      curiosityLevel: 0.7,
      storytelling: 0.3
    }
  }

  protected getSystemPrompt(): string {
    return "Your detailed system prompt defining personality and behavior..."
  }

  public async canHandleQuery(query: string, context?: any): Promise<number> {
    // Return 0-1 confidence score based on query analysis
  }

  public async execute(args: Record<string, unknown>): Promise<OutdoorAgentResponse> {
    // Generate and return agent response
  }
}
```

2. Register with the router:

```typescript
agentRouter.registerAgent(new MyAgent(languageInterface))
```

No other changes needed — the router automatically evaluates the new agent for every query.

---

## Adding New Tools

1. Implement the `Tool` interface:

```typescript
export class MyTool {
  public readonly name = "my_tool"
  public readonly description = "What this tool does and when to use it"

  public readonly parameters = {
    type: "object",
    properties: {
      query: { type: "string", description: "User query" }
    },
    required: ["query"]
  }

  public async execute(args: Record<string, unknown>): Promise<ToolResult> {
    // Implementation
    return { success: true, result: { message: "..." }, executionTime: 0 }
  }
}
```

2. Register with an agent:

```typescript
agent.registerTool(new MyTool())
```

---

## Troubleshooting

### API Token Issues
**Error**: `RemoteServiceGateway authentication failed`
- Verify token in `RemoteServiceGatewayCredentials`
- Regenerate token if expired

### Audio Feedback
**Issue**: Echo or feedback during preview
- Use headphones during development
- Disable `haveAudioOutput` temporarily in GeminiAssistant

### Agent Routing Issues
**Error**: `No agent met confidence threshold`
- Check `confidenceThreshold` setting in AgentRouter (default 0.6)
- Review agent `canHandleQuery()` keyword matching
- Default fallback agent will handle the query

### Storage Limit
**Issue**: Storage approaching 10MB limit
- System auto-manages with truncation
- Call `storageManager.resetAllStorage()` to clear manually

---

## Contributing

Key design principles to maintain:

1. **AI-First Routing**: Use LLM reasoning for decisions, not hard-coded rules
2. **Agent Contract**: Follow the `IOutdoorAgent` interface and `OutdoorAgent` base class patterns
3. **Tool Contract**: Every tool implements `{ name, description, parameters, execute() }`
4. **Character Limits**: 300 characters for AR display, enforced by `TextLimiter`
5. **Voice-First**: Default to voice output; use `textOnly: true` only for internal operations
6. **Spectacles Compatibility**: All features must work on Spectacles hardware
7. **Provider Abstraction**: Never call OpenAI/Gemini directly — always through `AgentLanguageInterface`

---

## License & Compliance

- Educational and research use encouraged
- Commercial deployment subject to [Snap's Developer Terms](https://www.snap.com/terms/spectacles)
- AI API usage subject to provider terms ([OpenAI](https://openai.com/policies/usage-policies/), [Gemini](https://ai.google.dev/gemini-api/terms))
- Please comply with your institution's privacy and data policies when handling user data

---

## External References

- [Snap Spectacles Developer Portal](https://developers.snap.com/spectacles)
- [Remote Service Gateway Documentation](https://developers.snap.com/spectacles/about-spectacles-features/apis/remoteservice-gateway)
- [Design for Spectacles](https://developers.snap.com/spectacles/best-practices/design-for-spectacles/introduction-to-spatial-design)
- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)

---

*Built by the Spectacles team*
