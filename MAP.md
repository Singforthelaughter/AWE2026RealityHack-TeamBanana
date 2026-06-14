# Project Map — Team Banana (AWE 2026 Reality Hack)

---

## Instructions for AI Agents

**Read this file first** before making any changes to the project.

### How to update this file

This file uses **section ownership** to prevent merge conflicts.  
Each team member owns one clearly-delimited section of this file.

Rules:
1. **Only edit your own section** (the one matching your team folder, e.g. `_Boon`, `_Niko`).  
   Never rewrite another person's section, even to fix a typo.
2. **Do a `git pull` before editing** this file. Always work from the latest version.
3. **Update your section immediately** after adding, removing, or significantly changing a script.  
   An outdated map is worse than no map.
4. When a **new script file is created**, add it to your section AND update the  
   [Dependency Graph](#dependency-graph) if it introduces cross-file links.
5. When a **script is deleted or renamed**, remove or update its entry and any  
   arrows pointing to it in the dependency graph.
6. **Do not restructure the file** (reorder sections, rename headers, change delimiter  
   comments). Structure changes must be agreed on by the whole team.

Section delimiters look like this — they are the anchors for safe editing:
```
<!-- BEGIN_SECTION: _Owner -->
...your content here...
<!-- END_SECTION: _Owner -->
```

---

## Project Overview

| Field | Value |
|---|---|
| **Project** | AWE 2026 Reality Hack — Team Banana |
| **Platform** | Snap Spectacles AR glasses (Lens Studio 5.x) |
| **Language** | TypeScript (`isolatedModules: true`, target ES2021) |
| **World units** | 1 unit = 1 cm (important for all world-space positioning) |
| **Module system** | CommonJS — use `import`/`export`, not `require` for new code |
| **Asset root** | `TeamBanana/Assets/` |
| **tsconfig** | `TeamBanana/tsconfig.json` |

### Team folders

Each team member works in their own `Assets/_Name/` folder to minimise conflicts.

| Folder | Owner | Status |
|---|---|---|
| `Assets/_Boon/` | Boon | Active — GPS / nearby sighting feature |
| `Assets/_Niko/` | Niko | Active — ML object detection pipeline |
| `Assets/_Aggy/` | Agrika | Active — butterfly detection + Kindwise identification |
| `Assets/_Joe/` | Joe | Reserved (no scripts yet) |
| `Assets/_Marina/` | Marina | Reserved (no scripts yet) |
| `Assets/_UtilityScripts/` | Shared | Utility components usable by all |

### Third-party packages (read-only, do not modify)

| Package | Path | Purpose |
|---|---|---|
| SpectaclesInteractionKit | `Assets/SpectaclesInteractionKit.lspkg/` | Hand/gesture interaction, events, utilities |
| SpectaclesUIKit | `Assets/SpectaclesUIKit.lspkg/` | UI components (buttons, sliders, frames) |
| SpectaclesInteractionKitExamples | `Assets/SpectaclesInteractionKitExamples.lspkg/` | Reference examples (not used in production) |

---

## Dependency Graph

Arrows show import direction: `A → B` means A imports from B.  
Only project scripts are listed; third-party package imports are noted inline.

```
── _Boon ──────────────────────────────────────────────────
NearbyMapManager        (no project imports — standalone)
NearbyPinManager        (no project imports — standalone)

── _Aggy ──────────────────────────────────────────────────
ButterflyIdentifier  ──► SupabaseDBManager (_Boon)
                     ──► ButterflyWingGenerator (_Boon)
MLSpatializer           (no project imports — standalone)
YOLODetectionProcessor ──► DetectionHelpers
BoundingBoxVisualizer  ──► MLSpatializer
DetectionHelpers        (no project imports — standalone)
EventModule             (no project imports — standalone)
KindwiseTypes           (no project imports — standalone)

── _Niko ──────────────────────────────────────────────────
DepthCacheSpatializer ──► MLSpatializer
                      ──► DepthCache
                      ──► DebugVisualizer
                      ──► DetectionContainer ──► ClosedPolyline
                      ──► DetectionHelpers
                      ──► SpatializerUtils

MLSpatializer         ──► YOLODetectionProcessor
                      ──► DetectionHelpers

ButterflyCropApiBridge ──► MLSpatializer
                       ──► DetectionHelpers

YOLODetectionProcessor ──► DetectionHelpers

DetectionHelpers        (no project imports — standalone)
SpatializerUtils        (no project imports — standalone)
DebugVisualizer         (no project imports — standalone)
DepthCache              (no project imports — standalone)
ClosedPolyline          (no project imports — standalone)

── _UtilityScripts ────────────────────────────────────────
TimeManager             (no project imports — singleton, global.timeManager)
TimeManagerExample  ──► TimeManager (via global), external Logger package

── Cross-team ─────────────────────────────────────────────
NearbySightingsTool     ──► SupabaseDBManager (_Boon)
ButterflyIdentificationTool ──► ButterflyIdentifier (_Aggy)
NaturalistAgent         ──► ButterflyIdentifier (_Aggy)
ArchivistAgent          ──► ButterflyIdentifier (_Aggy)
```

---

<!-- BEGIN_SECTION: _Boon -->
## _Boon — GPS / Nearby Sighting

Owner: **Boon**  
Folder: `Assets/_Boon/NearbySighting/Scripts/`  
Feature: Shows nearby GPS locations on a 2D minimap and as 3D AR world pins.

---

### NearbyMapManager.ts

**Purpose:** 2D minimap panel. Places flat pin prefabs on a `ScreenTransform` panel,  
north-up, with the user at the centre. An optional heading indicator rotates to show  
which direction the user is facing.

**Inspector inputs:**

| Input | Type | Required | Description |
|---|---|---|---|
| `pinPrefab` | ObjectPrefab | Yes | Prefab whose root has a ScreenTransform |
| `pinsContainer` | SceneObject | Yes | The map panel — pins are parented here |
| `userHeadingIndicator` | SceneObject | No | Arrow that rotates to show user heading |
| `mapRadiusMeters` | number | — | Real-world radius the map edge represents (default 300 m) |
| `mapModule` | MapModule | No | Optional Snap tile map background |
| `mapAnchorLocation` | LocationAsset | No | Anchor for the tile grid (required if mapModule is set) |
| `gpsUpdateInterval` | number | — | Seconds between GPS polls (default 1.0) |
| `updateEnabled` | boolean | — | Toggle to freeze all per-frame updates |

**Public API:**

| Method / Type | Description |
|---|---|
| `setLocations(locations: LocationInput[])` | Replaces all map pins with a new set. Clears previous set first. |
| `clearLocations()` | Destroys all pins. |
| `getDistanceToPin(index)` | Real GPS distance in metres to pin at index. Returns -1 if GPS unavailable. |
| `getBearingToPin(index)` | Absolute compass bearing (radians, 0=north CW) to pin at index. |
| `getAllPinInfo()` | Returns `PinInfo[]` — label, distance, and bearing for all active pins. |
| `type LocationInput` | `{ latitude, longitude, label? }` — input format for setLocations. |
| `type PinInfo` | `{ label, distanceMeters, bearingRadians }` — output snapshot per pin. |

**Key behaviours / gotchas:**
- Map coordinate convention: panel centre = user, +Y = north, +X = east.
- Pins use `ScreenTransform.anchors.setCenter(vec2)` (normalised −1 to 1), not world position.
- Two pin placement modes: bearing/distance (default) or MapModule tile-ratio (if wired).
- GPS heading from `onNorthAlignedOrientationUpdate`; uses `extractYaw()` not `quat.toEulerAngles()`.
- Editor heading sign is flipped vs. real device (handled internally).

**Imports from project:** none  
**Imported by:** none currently — call `setLocations()` from your own script.

---

### NearbyPinManager.ts

**Purpose:** 3D AR world-space pins. Places pooled prefab instances in the scene at  
compass-bearing directions from the user. All pins are at the same fixed distance  
(`placementDistanceMeters`) — direction only, not actual GPS distance.

**Inspector inputs:**

| Input | Type | Required | Description |
|---|---|---|---|
| `camera` | SceneObject | Yes | Main Spectacles camera SceneObject |
| `pinPrefab` | ObjectPrefab | Yes | 3D prefab (must have Transform, not ScreenTransform) |
| `pinsContainer` | SceneObject | No | Parent for pooled instances; defaults to this object |
| `initialPoolSize` | number | — | Pins pre-created in pool on awake (default 10) |
| `placementDistanceMeters` | number | — | Fixed visual distance from user (default 3 m) |
| `gpsUpdateInterval` | number | — | Seconds between GPS polls (default 1.0) |
| `updateEnabled` | boolean | — | Toggle to freeze all per-frame updates |

**Public API:**

| Method / Type | Description |
|---|---|
| `setLocations(locations: LocationInput[])` | Returns all active pins to pool, then places a fresh set. |
| `clearLocations()` | Returns all active pins to pool. |
| `acquirePin()` | Gets an enabled SceneObject from the pool (or instantiates if empty). |
| `releasePin(pin)` | Disables a SceneObject and returns it to the pool. |
| `getDistanceToPin(index)` | Real GPS distance in metres to pin at index. |
| `getBearingToPin(index)` | Absolute compass bearing (radians, 0=north CW) to pin at index. |
| `type LocationInput` | `{ latitude, longitude, label? }` — same shape as NearbyMapManager. |

**Object pool state machine:**
```
POOLED (enabled=false, in pinPool[])
  → acquirePin() →
ACTIVE (enabled=true, in activePins[])
  → releasePin() →
POOLED
```
**Never call `destroy()` on pool objects.**

**Key behaviours / gotchas:**
- Camera looks along its −Z axis; code uses `transform.back` (not `.forward`) for view direction.
- `projectOnPlane(vec3.up())` strips pitch so pins don't shift when user looks up/down.
- World offset = `direction × placementDistanceMeters × 100` (metres → cm world units).
- Same `extractYaw()` + editor sign-flip logic as NearbyMapManager.

**Imports from project:** none  
**Imported by:** none currently — call `setLocations()` from your own script.

---

### CustomLocationsLoader.ts

**Purpose:** Manages runtime-added custom map pins on the MapComponent map.  
Exposes a public API so any script (e.g. a Supabase fetcher) can push GPS locations  
onto the map after fetching them. Pins queued before the map is ready are buffered  
and placed automatically once `onInitialLocationSet` fires.

**Inspector inputs:**

| Input | Type | Required | Description |
|---|---|---|---|
| `mapComponent` | MapComponent | Yes | The MapComponent instance to add pins to |

**Public API:**

| Method / Type | Description |
|---|---|
| `setLocations(locations: CustomLocation[])` | Clears all current custom pins and places a fresh set. |
| `addLocation(location: CustomLocation)` | Adds a single pin. Safe to call before map is ready — queued automatically. Returns the `MapPin` or `null` if queued. |
| `clearLocations()` | Removes all custom pins. |
| `type CustomLocation` | `{ label: string, latitude: number, longitude: number }` |

**Key behaviours / gotchas:**
- Call `setLocations()` or `addLocation()` from whatever script fetches location data (e.g. Supabase).
- Pins placed before `onInitialLocationSet` fires are buffered in `pendingLocations[]` and flushed on map ready.

**Imports from project:** `MapComponent`, `MapPin`  
**Imported by:** any script that provides GPS location data at runtime.

---

### MarkerInteractableTrigger.ts

**Purpose:** Attached to a SceneObject that also carries an `Interactable` component.  
Changes the colour of two sibling Text objects and one sibling Image object in response  
to hover/trigger interaction events. On trigger start it also scales the common parent  
up by a configurable multiplier; on trigger end it restores the original parent scale.

**Inspector inputs:**

| Input | Type | Required | Description |
|---|---|---|---|
| `text1` | SceneObject | Yes | Sibling with a `Text` component |
| `text2` | SceneObject | Yes | Sibling with a `Text` component |
| `image1` | SceneObject | Yes | Sibling with an `Image` component |
| `normalColor` | vec4 | — | Colour when nothing is hovering (default white) |
| `hoverColor` | vec4 | — | Colour on hover enter |
| `triggerColor` | vec4 | — | Colour while trigger is held |
| `triggerEndColor` | vec4 | — | Colour immediately after trigger releases |
| `triggerScaleMultiplier` | vec3 | — | Per-axis multiplier on the parent's local scale during trigger (default 1.1, 1.1, 1.1) |

**Events handled:** `onHoverEnter`, `onHoverExit`, `onTriggerStart`, `onTriggerEnd`  
**Parent scale:** cached at `onAwake`; restored exactly on trigger end.

**Imports from project:** `Interactable`, `InteractorEvent` (SpectaclesInteractionKit)  
**Imported by:** none — attach directly in the Inspector.

<!-- END_SECTION: _Boon -->

---

<!-- BEGIN_SECTION: _Niko -->
## _Niko — ML Object Detection Pipeline

Owner: **Niko**  
Folder: `Assets/_Niko/Scripts/`  
Feature: Detects real-world objects using a YOLO model, spatialises them in 3D, and  
optionally crops + base64-encodes frames for an external API.

---

### MLSpatializer.ts

**Purpose:** Main entry point for the ML pipeline. Runs YOLO inference on a camera  
texture, parses detections, and emits them via an event system.  
Handles inference only — does not do 3D positioning itself.

**Key inputs:** `model` (MLAsset), `inputTexture`, `maxDetectionCount`, `scoreThreshold`, `detectionPersistence`  
**Emits:** detection events via `Events` module (external EventModule)  
**Imports:** `DetectionHelpers`, `YOLODetectionProcessor`, `Events` (external)  
**Imported by:** `DepthCacheSpatializer`, `ButterflyCropApiBridge`

---

### YOLODetectionProcessor.ts

**Purpose:** Pure logic class (not a component). Parses raw YOLO model output tensors  
into `Detection` objects. Handles anchor-based bounding box decoding and NMS  
(non-maximum suppression).

**Imports:** `DetectionHelpers`  
**Imported by:** `MLSpatializer`

---

### DepthCacheSpatializer.ts (`DepthSpatializer` class)

**Purpose:** Orchestrates the full 3D spatialization pipeline using depth data.  
Takes YOLO detections from `MLSpatializer` (or its own callback), uses `DepthCache`  
for matched colour+depth frames, and places `DetectionContainer` prefabs in 3D world  
space with smooth lerp transitions.

**Key inputs:** `camera`, `debugVisualizer`, `depthCache`, `depthPrefab`, `detectionContainer`,  
`mlSpatializer`, and various threshold/timing parameters.

**Note:** When using this alongside `MLSpatializer`, disable the event callback in  
`MLSpatializer` to avoid double-processing.

**Imports:** `MLSpatializer`, `DepthCache`, `DebugVisualizer`, `DetectionContainer`,  
`DetectionHelpers`, `SpatializerUtils`, `BaseButton` (SpectaclesUIKit)  
**Imported by:** nothing (top-level orchestrator)

---

### ButterflyCropApiBridge.ts

**Purpose:** Consumes detections from `MLSpatializer` and produces cropped, Base64-encoded  
camera frame images for each detection, ready to send to an external API (Butterfly Crop API).  
Uses Screen Crop Texture assets for concurrent crop operations.

**Key inputs:** `mlSpatializer`, `sourceTexture`, and up to 3 crop texture slots.  
**Exports:** `ButterflyCropPayload` type (the payload sent to the API).

**Imports:** `MLSpatializer`, `DetectionHelpers`, `Events` (external)  
**Imported by:** nothing (top-level consumer)

---

### DepthCache.ts

**Purpose:** Maintains a rolling buffer of paired colour camera frames and depth  
frames, matched by closest timestamp. Used by `DepthCacheSpatializer` to get the  
depth reading that corresponds to a given colour frame.

**Key inputs:** `camModule` (CameraModule)  
**Uses:** Lens Studio native `DepthModule` and `DeviceCamera` APIs.

**Imports:** nothing (standalone)  
**Imported by:** `DepthCacheSpatializer`

---

### DetectionContainer.ts

**Purpose:** Lightweight component that holds UI Text and polyline references for a  
single detection overlay. Instantiated as a prefab per detected object.

**Key inputs:** `categoryAndConfidence` (Text), `distanceFromCamera` (Text), `polyline` (ClosedPolyline), `polylinePoints`

**Imports:** `ClosedPolyline`  
**Imported by:** `DepthCacheSpatializer`

---

### ClosedPolyline.ts

**Purpose:** Renders a visual outline (polyline) around a detected object's bounding  
region. Supports continuous, split, and faded-end line styles.

**Key inputs:** `points` (SceneObject[]), `lineMaterial`, `lineWidth`, `lineStyle`, `continuousLine`  
**Uses:** `InteractorLineRenderer` from SpectaclesInteractionKit.

**Imports:** `InteractorLineRenderer`, `withAlpha` (both from SpectaclesInteractionKit)  
**Imported by:** `DetectionContainer`

---

### DetectionHelpers.ts

**Purpose:** Defines the `Detection` class (bounding box, score, label, index) and  
`DetectionHelpers` utility class. Pure data/logic — no Lens Studio APIs.  
Shared by the entire detection pipeline.

**Exports:** `Detection` class, `DetectionHelpers` class  
**Imports:** nothing (standalone)  
**Imported by:** `MLSpatializer`, `YOLODetectionProcessor`, `DepthCacheSpatializer`, `ButterflyCropApiBridge`

---

### SpatializerUtils.ts

**Purpose:** Shared utility functions and interfaces for spatialization logic.  
Includes `DetectionState`, `LerpState` interfaces, and helpers like `areVerticesSimilar`,  
`lerpVec3`, `easeOutCubic`, `alignVerticesToRectangle`.

**Imports:** nothing (standalone)  
**Imported by:** `DepthCacheSpatializer`

---

### DebugVisualizer.ts

**Purpose:** Development-only component for visualising detected 2D pixel positions  
and bounding box vertices overlaid on a camera frame plane.

**Key inputs:** `pointPrefab`, `pointPrefabVertex`, `testCamVisualObj`

**Imports:** nothing (standalone)  
**Imported by:** `DepthCacheSpatializer`

<!-- END_SECTION: _Niko -->

---

<!-- BEGIN_SECTION: _Agrika -->
## _Agrika

Owner: **Agrika**  
Folder: `Assets/_Aggy/` (note: folder is `_Aggy`, MAP.md section key is `_Agrika`)  
Feature: Butterfly detection + Kindwise identification pipeline. Self-contained.

**Imported by:** `ButterflyIdentificationTool` (_Joe) reads `KindwiseTypes` from this folder.

<!-- END_SECTION: _Agrika -->

---

<!-- BEGIN_SECTION: _Joe -->
## _Joe — Agent System & Tools

Owner: **Joe**  
Folder: `Assets/_Joe/Assets/Scripts/`  
Feature: AI agent system for butterfly outdoor education with tool-based architecture.

---

### Agent System (Agents/)

| Script | Purpose |
|---|---|
| `AgentOrchestrator.ts` | Top-level component. Wires agents, language interface, routing, and coordination. Inspector inputs: `dbManager` (enables nearby sightings), `butterflyIdentifier` (enables species identification). |
| `AgentRouter.ts` | Routes user queries to Naturalist (discovery) or Archivist (knowledge) based on confidence scoring. Passes `dbManager`, `mapManager`, and `butterflyIdentifier` to agents. |
| `AgentCoordinator.ts` | Manages cross-agent collaboration with priority queue and depth limits. |
| `AgentLanguageInterface.ts` | Abstraction over OpenAI/Gemini LLM providers. Interrupts in-progress auto-VAD responses before sending agent messages to prevent stale output during tool execution. |
| `AgentMemorySystem.ts` | In-memory conversation history management. |
| `AgentToolExecutor.ts` | Executes registered tools with parameter validation, timeout, and events. |
| `AgentTypes.ts` | Shared TypeScript interfaces: `Tool`, `ToolResult`, `Message`, `LLMResponse`, etc. |
| `OutdoorAgent.ts` | Abstract base class for agents. Defines `registerTool()`, `execute()`, `canHandleQuery()`. |
| `NaturalistAgent.ts` | Gentle Socratic discovery guide. Voice-only, no camera. Registers `general_conversation`, optionally `nearby_sightings` and `butterfly_identification` tools. Always uses voice/audio (no longer forces text-only when tool context is present). |
| `ArchivistAgent.ts` | Enthusiastic storyteller and knowledge curator. Can use camera for identification. Registers `general_conversation`, optionally `nearby_sightings` and `butterfly_identification` tools. Always uses voice/audio (no longer forces text-only when tool context is present). |

### Tools (Tools/)

| Script | Purpose |
|---|---|
| `NearbySightingsTool.ts` | Queries Supabase (via `SupabaseDBManager`) for butterfly sightings near the user's GPS location. Returns species, distances, photos. Cached for 30s. |
| `ButterflyIdentificationTool.ts` | **NEW** — Wraps Agrika's `ButterflyIdentifier` as an agent-callable tool. Triggers camera capture → Kindwise API identification. Returns species name, common name, probability. |
| `GeneralConversationTool.ts` | LLM fallback for general conversation. |
| `SpatialTool.ts` | Camera-based spatial analysis of the environment. |
| `LocationTool.ts` | Gets current GPS coordinates from Spectacles `LocationService`. |
| `WeatherTool.ts` | Gets weather conditions from Spectacles `UserContextSystem`. |
| `ToolRouter.ts` | AI-powered tool selection. Indexes `spatial_tool`, `general_conversation`, `nearby_sightings` (when `dbManager` is available), and `butterfly_identification` (when `butterflyIdentifier` is available). |
| `index.ts` | Tool exports and `createTools()` factory. Accepts optional `butterflyIdentifier` for `ButterflyIdentificationTool`. |

### Cross-team imports

`NearbySightingsTool` imports `SupabaseDBManager` from `_Boon/SupabaseInfoStoring&Retrieving/Scripts/`.  
`ButterflyIdentificationTool` imports `ButterflyIdentifier` from `_Aggy/Scripts/`.  
`AgentRouter`, `NaturalistAgent`, `ArchivistAgent` accept optional `ButterflyIdentifier` from `_Aggy/Scripts/`.

<!-- END_SECTION: _Joe -->

---

<!-- BEGIN_SECTION: _Marina -->
## _Marina

Owner: **Marina**  
Folder: `Assets/_Marina/`  
Status: No scripts yet. Add entries here when scripts are created.

<!-- END_SECTION: _Marina -->

---

<!-- BEGIN_SECTION: _UtilityScripts -->
## _UtilityScripts — Shared Utilities

Owner: **Shared** (any team member can use; coordinate before modifying)  
Folder: `Assets/_UtilityScripts/`

---

### TimeManager.ts

**Purpose:** Singleton component providing `setTimeout` and `setInterval` equivalents  
for Lens Studio, which has no native timer API. Exposes itself globally as  
`global.timeManager` so any script can access it without an import.

**Setup:** Add to one SceneObject in the scene. Must exist in the scene before any  
script calls `timeManager.setTimeout(...)`.

**Public API:**

| Method | Description |
|---|---|
| `setTimeout(callback, delayMs)` | Runs callback once after `delayMs` milliseconds. Returns an ID. |
| `clearTimeout(id)` | Cancels a pending timeout. |
| `setInterval(callback, delayMs)` | Runs callback every `delayMs` milliseconds. Returns an ID. |
| `clearInterval(id)` | Stops a repeating interval. |
| `TimeManager.getInstance()` | Static accessor for the singleton. |

**Usage from any script (no import needed):**
```typescript
timeManager.setTimeout(() => { print("hello") }, 1000)
```

**Imports:** nothing (standalone singleton)  
**Imported by:** any script that uses timer functionality

---

### TimeManagerExample.ts

**Purpose:** Usage example for TimeManager. Not for production use.

**Imports:** `TimeManager` (via global), `Logger` (external Utilities package)

<!-- END_SECTION: _UtilityScripts -->
