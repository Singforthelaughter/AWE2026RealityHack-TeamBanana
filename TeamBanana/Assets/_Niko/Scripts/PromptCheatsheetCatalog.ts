export type PromptCheatsheetMode =
  | "idle"
  | "voice"
  | "identification"
  | "detection"
  | "map"
  | "collection"
  | "spatial"
  | "generation"
  | "palmTalk"

export type RuntimeSupport = "preview-ok" | "device-only" | "mixed"

export type PromptCheatsheetEntry = {
  mode: PromptCheatsheetMode
  feature: string
  prompt: string
  outcome: string
  runtime: RuntimeSupport
  components: string
}

export const PROMPT_CHEATSHEET_MODE_ORDER: PromptCheatsheetMode[] = [
  "idle",
  "voice",
  "identification",
  "detection",
  "map",
  "collection",
  "spatial",
  "generation",
  "palmTalk"
]

export const PROMPT_CHEATSHEET_MODE_TITLES: Record<PromptCheatsheetMode, string> = {
  idle: "Field Guide",
  voice: "Voice Assistant",
  identification: "Identify Butterflies",
  detection: "Scan For Butterflies",
  map: "Nearby Sightings",
  collection: "Collection",
  spatial: "Spatial Awareness",
  generation: "Generate Assets",
  palmTalk: "Palm Push To Talk"
}

export const PROMPT_CHEATSHEET_MODE_SUMMARIES: Record<PromptCheatsheetMode, string> = {
  idle: "Start here during demos. These prompts exercise the main flows.",
  voice: "Use voice for agent routing, facts, and multi-turn conversation.",
  identification: "Use when the user is looking at a butterfly and wants species details.",
  detection: "Use when the headset should scan the camera feed before identifying.",
  map: "Use when the user asks about sightings near their current location.",
  collection: "Use when the user wants their saved butterflies or spawned 3D collection.",
  spatial: "Use when the user asks about what is visible or whether the habitat is good.",
  generation: "Use for image and 3D model generation demos.",
  palmTalk: "Use while the palm menu is visible and the user is holding pinch to talk."
}

export const PROMPT_CHEATSHEET_ENTRIES: PromptCheatsheetEntry[] = [
  {
    mode: "idle",
    feature: "Fast smoke test",
    prompt: "Hello! What can you do?",
    outcome: "Introduces the assistant and confirms voice plus chat are alive.",
    runtime: "preview-ok",
    components: "GeminiAssistant, AgentOrchestrator, ChatBridge"
  },
  {
    mode: "idle",
    feature: "Discovery guide",
    prompt: "What should I look for in nature around here?",
    outcome: "Routes to Naturalist and gives observation guidance.",
    runtime: "preview-ok",
    components: "AgentRouter, NaturalistAgent"
  },
  {
    mode: "idle",
    feature: "Story mode",
    prompt: "Why are butterfly wings so colorful?",
    outcome: "Routes to Archivist and gives a short educational story.",
    runtime: "preview-ok",
    components: "AgentRouter, ArchivistAgent"
  },
  {
    mode: "voice",
    feature: "General conversation",
    prompt: "Tell me a fun fact about nature.",
    outcome: "Answers conversationally and keeps the response AR-sized.",
    runtime: "preview-ok",
    components: "GeneralConversationTool, AgentLanguageInterface"
  },
  {
    mode: "voice",
    feature: "Agent routing",
    prompt: "How are butterflies different from moths?",
    outcome: "Routes to the best agent and answers as voice plus text.",
    runtime: "preview-ok",
    components: "AgentRouter, ChatComponent"
  },
  {
    mode: "voice",
    feature: "Multi-turn context",
    prompt: "And where do they find that food?",
    outcome: "Uses recent conversation context instead of treating it as a fresh topic.",
    runtime: "preview-ok",
    components: "AgentMemorySystem, ChatStorage"
  },
  {
    mode: "identification",
    feature: "Species ID",
    prompt: "What is this butterfly?",
    outcome: "Captures an image, identifies species, stores the sighting, shows an info card, and spawns a butterfly.",
    runtime: "device-only",
    components: "ButterflyIdentifier, SupabaseDBManager, FlyingButterflyManager"
  },
  {
    mode: "identification",
    feature: "Info card",
    prompt: "Can you tell me what species this is?",
    outcome: "Populates the info card with species name, confidence, photos, status, and season details.",
    runtime: "device-only",
    components: "ButterflyInfoDisplayManager, ConservationStatusBar, SeasonCalendar"
  },
  {
    mode: "identification",
    feature: "Wing generation",
    prompt: "Identify that butterfly right there.",
    outcome: "Uses the Kindwise reference image to generate wing and opacity textures before spawn.",
    runtime: "device-only",
    components: "ButterflyWingTextureGenerator, FlyingButterflyManager"
  },
  {
    mode: "detection",
    feature: "YOLO scan",
    prompt: "Help me scan for butterflies.",
    outcome: "Runs the scan flow, deduplicates detections, and auto-identifies if a butterfly is found.",
    runtime: "device-only",
    components: "ButterflyDetectionTool, MLSpatializer, YOLODetectionProcessor"
  },
  {
    mode: "detection",
    feature: "Camera check",
    prompt: "Can you see any butterflies right now?",
    outcome: "Reports visible butterflies and confidence scores through the agent response.",
    runtime: "device-only",
    components: "ButterflyDetectionTool, ButterflyIdentificationTool"
  },
  {
    mode: "map",
    feature: "Nearby sightings",
    prompt: "What butterflies have been spotted near me?",
    outcome: "Gets GPS, queries Supabase, summarizes nearest sightings, and opens the AR map.",
    runtime: "device-only",
    components: "NearbySightingsTool, NearbySightingManager, SupabaseDBManager"
  },
  {
    mode: "map",
    feature: "Map display",
    prompt: "Show me a map of all nearby butterfly sightings.",
    outcome: "Displays map pins and quest markers for nearby sightings.",
    runtime: "device-only",
    components: "CustomLocationsLoader, MapUIController, QuestMarkController"
  },
  {
    mode: "map",
    feature: "Map dismiss",
    prompt: "Close the map.",
    outcome: "Closes the map panel and clears the visual map focus.",
    runtime: "preview-ok",
    components: "MapContainerController, MapUIController"
  },
  {
    mode: "collection",
    feature: "Show collection",
    prompt: "Show me my butterfly collection.",
    outcome: "Loads saved sightings and spawns collected butterflies with available wing textures.",
    runtime: "device-only",
    components: "ButterflyCollectionTool, SupabaseDBManager, FlyingButterflyManager"
  },
  {
    mode: "collection",
    feature: "Collection grid",
    prompt: "What butterflies have I collected so far?",
    outcome: "Shows the user's species list and supports selecting a card to spawn a butterfly.",
    runtime: "mixed",
    components: "ButterflyCollectionDynamicTestManagerNew, ButterflyCollectionLiteManager"
  },
  {
    mode: "collection",
    feature: "Clear collection",
    prompt: "Hide my collection.",
    outcome: "Removes spawned collection butterflies from the scene.",
    runtime: "preview-ok",
    components: "ButterflyCollectionTool, FlyingButterflyManager"
  },
  {
    mode: "spatial",
    feature: "Scene awareness",
    prompt: "What do you see right now?",
    outcome: "Captures camera context and describes the visible environment.",
    runtime: "mixed",
    components: "SpatialTool, AgentLanguageInterface, VideoController"
  },
  {
    mode: "spatial",
    feature: "Habitat read",
    prompt: "Is this a good spot for butterflies?",
    outcome: "Analyzes visible habitat cues such as plants, light, and microclimate.",
    runtime: "mixed",
    components: "SpatialTool, WeatherTool, LocationTool"
  },
  {
    mode: "generation",
    feature: "Image generation",
    prompt: "Generate an image of a blue morpho butterfly on a tropical leaf.",
    outcome: "Generates a texture and displays it in the assigned image output.",
    runtime: "preview-ok",
    components: "ImageGen, ImageGenBridge"
  },
  {
    mode: "generation",
    feature: "3D model generation",
    prompt: "Generate a 3D model of a butterfly chrysalis.",
    outcome: "Requests a Snap3D model and places it at the configured scene target.",
    runtime: "preview-ok",
    components: "ModelGen, ModelGenBridge"
  },
  {
    mode: "palmTalk",
    feature: "Start recording",
    prompt: "Pinch and hold, then say: What butterfly is this?",
    outcome: "Streams microphone audio while the palm menu is active.",
    runtime: "device-only",
    components: "PalmPushToTalk, GeminiAssistant, ActivityIndicatorController"
  },
  {
    mode: "palmTalk",
    feature: "Live subtitle",
    prompt: "Keep holding pinch while speaking.",
    outcome: "Shows partial and final speech text, then sends the final prompt to the assistant.",
    runtime: "device-only",
    components: "PalmPushToTalk, GeminiAssistant"
  }
]
