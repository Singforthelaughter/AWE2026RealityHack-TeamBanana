# Ideal Prompts — Team Banana (AWE 2026 Reality Hack)

> Curated set of prompts to test every feature end-to-end.
> Speak these or use them in the Gemini Live voice assistant on Spectacles.
>
> Last updated: 2026-06-15

---

## How to use this file

Each section below lists the **ideal prompts** for a specific feature. Say the prompt aloud
(or paste into the chat) and verify the expected outcome. If a prompt is labeled **"(DEVICE ONLY)"**,
it requires real Spectacles hardware — it will fail silently in Lens Studio Preview.

---

## 1. Gemini Live Voice Assistant — General Conversation

The core always-on voice pipeline. User speaks, Gemini replies with voice.

| # | Prompt | Expected Outcome |
|---|---|---|
| 1 | `"Hello! Who are you and what can you do?"` | Friendly self-introduction. Agent introduces itself and its capabilities. |
| 2 | `"What's the weather like today?"` | Weather tool fires (if Spectacles UserContextSystem available). Otherwise conversational fallback. |
| 3 | `"Tell me a fun fact about nature."` | Conversational response with an interesting nature fact. |
| 4 | `"How are butterflies different from moths?"` | Educational comparison. Likely routes to Archivist (storyteller). |

**Routed to:** `general_conversation` tool  
**Components:** `GeminiAssistant`, `AgentLanguageInterface`, `ChatBridge`, `ChatComponent`

---

## 2. Agent Routing — Naturalist vs. Archivist

The router picks the best agent based on the user's intent.

### Naturalist Agent (Socratic discovery guide)

| # | Prompt | Expected Outcome |
|---|---|---|
| 5 | `"What should I look for in this park?"` | Naturalist responds with Socratic observation guidance. "What do you notice about the plants around you?" style. |
| 6 | `"I see something orange on that flower — what do you notice about it?"` | Naturalist asks follow-up questions about the observation. Encourages closer looking. |
| 7 | `"Where should I look to find butterflies?"` | Naturalist gives discovery tips without lecturing. Suggests observing, not just telling. |
| 8 | `"What patterns do you see in how things move around here?"` | Naturalist engages with the user's observation, asks the user to reflect. |

**Expected routing:** `naturalist` (confidence > 0.5)  
**Personality:** Gentle, patient, asks questions rather than giving answers.

### Archivist Agent (Enthusiastic storyteller)

| # | Prompt | Expected Outcome |
|---|---|---|
| 9 | `"Why do butterflies have such colorful wings?"` | Archivist responds enthusiastically with a story-like explanation. "Did you know..." style. |
| 10 | `"Tell me about Monarch butterfly migration."` | Archivist shares a narrative about Monarch migration with fascinating facts. |
| 11 | `"How long do butterflies live? What's their life cycle?"` | Archivist tells the egg → caterpillar → chrysalis → butterfly story. |
| 12 | `"What do butterflies eat and what plants do they need?"` | Archivist explains host plants, nectar sources, and ecological relationships. |

**Expected routing:** `archivist` (confidence > 0.5)  
**Personality:** Enthusiastic, loves sharing stories and facts, "Did you know...?"

### Ambiguous / Boundary Test Prompts

| # | Prompt | Expected Outcome |
|---|---|---|
| 13 | `"I see a butterfly! What is it?"` | Should route to Archivist (ID + story), with `butterfly_identification` tool triggered. |
| 14 | `"Can you help me find something interesting?"` | Could route to either agent. Naturalist if discovery intent detected; Archivist if curiosity intent detected. Fallback = Naturalist. |
| 15 | `"What's that?"` (very short, pointing at something) | Low confidence for both — falls to Naturalist (the default). Naturalist asks "What do you notice?" |

---

## 3. Butterfly Identification (Camera → Kindwise API)

User asks to identify a specific butterfly they're looking at. Triggers camera frame capture, sends to
Kindwise insect API via Supabase Edge Function, returns species + common name + confidence.

| # | Prompt | Expected Outcome |
|---|---|---|
| 16 | `"What is this butterfly?"` | Camera captures a frame. Kindwise API returns species. Agent speaks the species name + a fun fact. 3D butterfly spawns with wing textures. Sighting stored to Supabase. Info card displayed. |
| 17 | `"Identify that butterfly right there!"` | Same as above. Identification pipeline fires. |
| 18 | `"What kind of butterfly is that?"` | Same. Matches `what kind` + `that` → identification trigger. |
| 19 | `"Can you tell me what species this is?"` | Same. Matches `what species` + `this` → identification trigger. |
| 20 | `"I just spotted something — what is it?"` | Same. Matches `spotted` + `what is it` → identification trigger. |

**⚠️ DEVICE ONLY:** `CameraModule.requestImage` does not work in Lens Studio Preview for
`ButterflyIdentifier.identify()`. The `ButterflyIdentificationTool` (used by agents) uses
`VideoController` which works in both Preview and device.

**Components:** `ButterflyIdentificationTool`, `ButterflyIdentifier`, `ButterflyWingTextureGenerator`, `ButterflyInfoDisplayManager`, `FlyingButterflyManager`, `SupabaseDBManager`

---

## 4. Butterfly Detection (On-Device YOLO ML + Auto-ID)

The primary trigger is `"help me scan for butterflies"`. Runs a 10-second YOLO scan,
then automatically identifies any butterflies found via the Kindwise API. No bounding
boxes are drawn — results are delivered by voice only.

| # | Prompt | Expected Outcome |
|---|---|---|
| 21 | `"Help me scan for butterflies!"` | **PRIMARY PROMPT.** YOLO model runs continuously for 10s. User pans their head to scan the environment. Agent reports: "I spotted N butterflies: ..." If butterflies are found, a camera frame is auto-sent to the Kindwise API and the species is identified. Result delivered by voice. No visual bounding boxes. |
| 22 | `"Can you see any butterflies right now?"` | Same 10s scan + auto-ID flow. Agent reports what's visible with confidence scores. |
| 23 | `"Do you spot any butterflies around here?"` | Same. Scans, reports, auto-identifies if found. |
| 24 | `"Look for butterflies through the camera."` | Same 10s scan + auto-ID pipeline. |
| 25 | `"Is there a butterfly in my view right now?"` | Same. Scans the camera feed, reports what's visible, auto-IDs if detected. |

**Flow:** YOLO 10s scan → deduplicate detections across frames → auto-capture frame → Kindwise ID → voice result

**⚠️ DEVICE ONLY:** YOLO model inference requires real device ML runtime.

**Components:** `ButterflyDetectionTool`, `ButterflyIdentificationTool`, `MLSpatializer` (Aggy or Niko), `YOLODetectionProcessor`, `DetectionHelpers`

---

## 5. Nearby Sightings + AR Map

User asks about butterfly sightings near their location. Triggers GPS → Supabase query →
AR minimap with pins.

| # | Prompt | Expected Outcome |
|---|---|---|
| 26 | `"What butterflies have been spotted near me?"` | GPS acquired. Supabase queried for sightings within 5 miles. Agent reports nearest + count. AR map appears with pins. Pins are tappable for sighting details. |
| 27 | `"Show me a map of all nearby butterfly sightings."` | Same. Map scales in, pins placed, quest markers (floating labels) appear. |
| 28 | `"Are there any Monarch butterflies around here?"` | Species-filtered nearby search. Reports if Monarchs are in the area. |
| 29 | `"What's been found within 10 miles of here?"` | Wider radius search. Results sorted nearest-first. |
| 30 | `"Has anyone seen any Swallowtails nearby?"` | Species-specific nearby search. Map shows Swallowtail pins if found. |

### AR Map UI Prompts

| # | Prompt | Expected Outcome |
|---|---|---|
| 31 | `"Close the map"` / `"Hide the map"` / `"Dismiss the map"` | Map scales out. Pins cleared. Agent confirms: "Map closed!" |
| 32 | (Pinch-zoom on map) | Map zooms in/out via `MapUIController` buttons. |
| 33 | (Drag map) | Map repositions via `InteractableManipulation`. |
| 34 | (Tap a map pin) | Sighting info card appears for that pin. |

**Components:** `NearbySightingsTool`, `NearbySightingManager`, `CustomLocationsLoader`, `MapUIController`, `MapContainerController`, `QuestMarkController`, `MapManipulation`, `SupabaseDBManager`

---

## 6. Butterfly Collection

User asks to see their personal collection of identified butterflies.

| # | Prompt | Expected Outcome |
|---|---|---|
| 35 | `"Show me my butterfly collection."` | Supabase fetches user's sightings. 3D butterflies spawn with wing textures. Agent reports: "You've collected N species: ..." Butterflies fly around; reach out your finger — one lands on it. |
| 36 | `"What butterflies have I collected so far?"` | Same as above. |
| 37 | `"Show me my butterflies."` | Same. |
| 38 | `"What have I seen so far?"` | Same — `butterfly_collection` tool triggered. |

### Collection UI Prompts

| # | Prompt | Expected Outcome |
|---|---|---|
| 39 | `"Hide my collection"` / `"Clear butterflies"` / `"Remove butterflies"` | All spawned collection butterflies destroyed. Agent confirms. |
| 40 | (Scroll the collection GridLayout) | 3-column scrollable grid of species cards with preview images. |
| 41 | (Tap a collection card) | Spawns the corresponding 3D butterfly via `FlyingButterflyManager`. |

**Components:** `ButterflyCollectionTool`, `ButterflyCollectionDynamicTestManagerNew`, `ButterflyCollectionLiteManager`, `FlyingButterflyManager`, `SupabaseDBManager`

---

## 7. 3D Flying Butterfly System + Hand Interaction

3D butterflies fly lifelike in AR, can land on the user's finger.

| # | Prompt / Action | Expected Outcome |
|---|---|---|
| 42 | (After identification: butterfly spawns) | 3D butterfly appears, flies with fluttery wing animation within FOV. Scale-in tween on spawn. |
| 43 | (Reach out finger toward a flying butterfly) | Butterfly flies to and lands on index finger, perched with gentle bobbing. Wing animation slows. |
| 44 | (Move hand around with a perched butterfly) | Butterfly stays on finger, body rotates to face user (adjustable via `fingerRotationFollow`). |
| 45 | (Lose hand tracking / move hand away) | Butterfly takes off and resumes free flight. |
| 46 | (Multiple butterflies spawned) | Only the one closest to the finger (and within FOV) lands. All others stay in free flight. |

**Components:** `FlyingButterflyManager`, `ButterflyMovementController`, SIK hand tracking

---

## 8. Palm Push-to-Talk Gesture

Palm-up gesture for push-to-talk mic streaming. Hardware only.

| # | Prompt / Action | Expected Outcome |
|---|---|---|
| 47 | (Raise open hand toward face, palm up) | Hand menu appears, anchored to palm. Mic button / activity indicator visible. |
| 48 | (Bring index + thumb close together) | "Pinch to record" tooltip appears (approaching pinch). |
| 49 | (Pinch and hold) | Activity indicator lights up. Gemini begins streaming mic audio. Live subtitles show partial→final transcribed speech. |
| 50 | (While pinching, speak a prompt like "What butterfly is this?") | Subtitle updates in real-time (gray = partial, white = final). Gemini responds after release. |
| 51 | (Release pinch) | Stops streaming. Indicator dims. Gemini answers the spoken prompt. Tooltip returns after glow fade. |

**⚠️ DEVICE ONLY:** Hand tracking + Gemini streaming require real Spectacles hardware.

**Components:** `PalmPushToTalk`, `GeminiAssistant`, `ActivityIndicatorController`

---

## 9. Spatial / Environmental Analysis

Camera-based analysis of the user's environment.

| # | Prompt | Expected Outcome |
|---|---|---|
| 52 | `"What do you see right now?"` | Spatial tool fires. Camera frame captured and sent to Gemini vision. Agent describes the visible environment. |
| 53 | `"What's happening in front of me?"` | Same — `spatial_tool` triggered. Describes current camera view. |
| 54 | `"Is this a good spot for butterflies?"` | Habitat analysis mode. Checks sunlight, plants, temperature. Returns habitat quality score + suggested species. |
| 55 | `"What plants do you see that could attract butterflies?"` | Camera-based plant analysis. Identifies potential host/nectar plants. |

**Components:** `SpatialTool`, `AgentLanguageInterface`, `VideoController`

---

## 10. Image Generation

Generate images from text prompts via DALL-E 3 or Gemini 2.0 Flash.

| # | Prompt | Expected Outcome |
|---|---|---|
| 56 | `"Generate an image of a blue morpho butterfly on a tropical leaf."` | Image generation triggered. Texture loads into the Image component. Supports OpenAI DALL-E 3 or Gemini 2.0 Flash. |
| 57 | `"Create a scientific illustration of butterfly wing scales."` | Image generated and displayed. |

**Components:** `ImageGen`, `ImageGenBridge`, OpenAI/Gemini APIs via `RemoteServiceGateway`

---

## 11. 3D Model Generation

Generate 3D models from text prompts via Snap3D API.

| # | Prompt | Expected Outcome |
|---|---|---|
| 58 | `"Generate a 3D model of a butterfly chrysalis."` | 3D model generated and placed in AR scene at target position. |
| 59 | `"Create a 3D model of a milkweed plant."` | 3D model appears. Supports refinement and vertex color options. |

**Components:** `ModelGen`, `ModelGenBridge`, Snap3D API via `RemoteServiceGateway`

---

## 12. Butterfly Info Card Display

After identification, a detailed info card appears.

| # | Prompt / Action | Expected Outcome |
|---|---|---|
| 60 | (After successful identification) | Info card prefab instantiates with: species name, scientific name, common names, probability, reference photo(s), user's captured photo. Conservation status bar shows IUCN/red-list level. Season calendar shows active months as an animated blob. |
| 61 | (Hover over conservation status bar) | Tooltip shows status label (e.g., "Least Concern") and explanation. |
| 62 | (Hover over season calendar) | Tooltip shows flight season details. |
| 63 | (Tap close button on info card) | Card animates out and is destroyed. |

**Components:** `ButterflyInfoDisplayManager`, `ButterflyInfoPrefabComponentsManager`, `ConservationStatusBar`, `SeasonCalendar`, `CloseFrameParent`

---

## 13. Onboarding / Instructions

First-launch instruction sequence.

| # | Prompt / Action | Expected Outcome |
|---|---|---|
| 64 | (App launch / scene start) | `InstructionManager` scales in instruction panel. After 1s delay, `CustomHandHintAnimation.play()` shows hand animation. After 4s, text updates to: *'Try saying "Show me a map of all nearby sightings"'.* Text fades after 3s. |
| 65 | `"Show me a map of all nearby sightings."` (the suggested prompt) | Nearby sightings query fires → AR map opens with pins. Completes the onboarding flow. |

**Components:** `InstructionManager`, `CustomHandHintAnimation`

---

## 14. Butterfly Hover Animations (Collection Grid)

Hover interactions on the collection cards.

| # | Action | Expected Outcome |
|---|---|---|
| 66 | (Hover over a butterfly card in the collection grid) | Wing-flap animation plays (`ButterflyHoverAnimationController`). Dynamically created collider + interactable. |
| 67 | (Hover exit from card) | Animation resets to idle. |

**Components:** `ButterflyHoverAnimationController`, `Interactable`

---

## 15. Supabase Database — Full Pipeline

End-to-end butterfly sighting storage and retrieval.

| # | Prompt / Action | Expected Outcome |
|---|---|---|
| 68 | `"What butterflies have I seen?"` (after at least one identification) | `getMySightings()` returns the user's stored sightings with wing textures loaded in batches of 3. |
| 69 | (Identify a butterfly — then check Supabase dashboard) | `storeSighting()` inserted a row with: photo URL, wing texture URL, GPS coordinates, species data, identified_at timestamp. |
| 70 | (Use `NearbySightingsTool` — check Supabase response) | `getNearbySightings()` bounding-box query + Haversine client-side filter returns correctly sorted nearest-first results. |
| 71 | (Use seed test data) | `seedTestData()` inserts 5 simulated sightings (London + Singapore clusters) — idempotent per user. |

**Components:** `SupabaseDBManager`, `SimulatedData`

---

## 16. Multi-Turn Conversation / Context Retention

Test that agents remember context across a conversation.

| # | Prompt Sequence | Expected Outcome |
|---|---|---|
| 72 | 1. `"What do butterflies eat?"` → 2. `"And where do they find that food?"` | Agent remembers the conversation is about butterfly diet. Second response builds on the first. |
| 73 | 1. `"I'm at a park with lots of flowers."` → 2. `"What butterflies might I see here?"` → 3. `"And which ones are most common?"` | Naturalist stays in discovery mode. Each response references previous observations. 3rd response narrows to common species. |
| 74 | 1. `"Tell me about Monarchs."` → 2. `"How far do they migrate?"` → 3. `"That's amazing! Where do they go in winter?"` | Archivist stays in storyteller mode. Each response builds the narrative. |

**Components:** `AgentMemorySystem`, `ChatStorage`, conversation context passed in `buildMessages()`

---

## 17. Tool Router — Edge Cases

Test that the AI-powered tool router correctly handles ambiguous or edge-case queries.

| # | Prompt | Expected Outcome |
|---|---|---|
| 75 | `"Hi"` / `"Hello"` / `"Hey there"` | Routes to `general_conversation`. Friendly greeting response. |
| 76 | `"Thanks!"` / `"That's cool!"` | `general_conversation`. Acknowledges, offers follow-up. |
| 77 | `"What time is it?"` | `general_conversation` (no clock tool registered — falls to general). |
| 78 | (Complete gibberish: `"asdfghjkl"`) | Falls to `general_conversation`. Asks user to clarify. |
| 79 | `"I see a butterfly but I also want to know what's nearby."` | Complex query. Agent picks one tool (likely `butterfly_identification` if present-context words match, else `nearby_sightings`). May trigger agent coordination. |

**Components:** `ToolRouter`, all registered tools

---

## 18. Location & Environment Tools

Spectacles sensor-based tools.

| # | Prompt | Expected Outcome |
|---|---|---|
| 80 | `"Where am I right now?"` | `LocationTool` fires. Returns GPS coordinates from `GeoLocation.createLocationService()`. |
| 81 | `"What's the temperature outside?"` | `WeatherTool` fires. Returns conditions from `UserContextSystem`. |

**⚠️ DEVICE ONLY:** GPS and UserContext sensors require real Spectacles hardware.

**Components:** `LocationTool`, `WeatherTool`

---

## Summary: Quick-Test Checklist

Run through these 10 prompts for a fast smoke test of all major features:

| # | Prompt | Feature Tested |
|---|---|---|
| 1 | `"Hello! What can you do?"` | General conversation + agent voice |
| 2 | `"What should I look for in nature around here?"` | Naturalist agent routing |
| 3 | `"Why are butterfly wings so colorful?"` | Archivist agent routing + storytelling |
| 4 | `"What is this butterfly?"` (while looking at one) | Butterfly identification pipeline |
| 5 | `"Help me scan for butterflies."` | 10s ML scan + auto-ID detection |
| 6 | `"What butterflies have been spotted near me?"` | Nearby sightings + AR map |
| 7 | `"Show me my butterfly collection."` | Personal collection + 3D spawning |
| 8 | `"What do you see right now?"` | Spatial/camera awareness |
| 9 | `"Close the map."` | Map dismissal (UI control) |
| 10 | (Palm-up gesture → pinch → speak) | Push-to-talk gesture |

---

## Notes

- Prompts with `butterfly` in them are more likely to trigger identification or nearby tools
  (keyword-based gating in `shouldUseButterflyIdentification()`, `shouldUseNearbySightings()`, etc.).
- The agents use **word-level matching**, not exact phrases, so variations work — e.g.,
  `"what butterfly is that"` ≠ exact match, but still triggers due to `what` + `butterfly` + `that`.
- "What" and "where" are intentionally both matched for butterfly ID due to common ASR confusion
  (`what` ↔ `where`) on Spectacles microphones.
- Responses are capped at ~300 characters for AR display readability.
- All agent responses are delivered as **voice + text** (no text-only mode).
