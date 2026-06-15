# Project Map — Team Banana (AWE 2026 Reality Hack)

---

## Instructions for AI Agents

**Read this file first** before making any changes to the project.

### How to update this file

This file uses **section ownership** to prevent merge conflicts.  
Each team member owns one clearly-delimited section of this file.

Rules:
1. **Do a `git pull` before editing** this file. Always work from the latest version.
2. **Update your section immediately** after adding, removing, or significantly changing a script.  
   An outdated map is worse than no map.
3. When a **new script file is created**, add it to your section AND update the  
   [Dependency Graph](#dependency-graph) if it introduces cross-file links.
4. When a **script is deleted or renamed**, remove or update its entry and any  
   arrows pointing to it in the dependency graph.
5. **Do not restructure the file** (reorder sections, rename headers, change delimiter  
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
| `Assets/_Boon/` | Boon | Active — Supabase DB, butterfly info display, wing generator, AR map |
| `Assets/_Niko/` | Niko | Active — ML object detection, butterfly collection UI |
| `Assets/_Aggy/` | Agrika | Active — butterfly detection + Kindwise identification |
| `Assets/_Joe/` | Joe | Active — Gemini Live, agent system, image/model gen |
| `Assets/_Marina/` | Marina | Reserved (no scripts yet) |
| `Assets/_UtilityScripts/` | Shared | Utility components usable by all |

### Third-party packages (read-only, do not modify)

| Package | Path | Purpose |
|---|---|---|
| SpectaclesInteractionKit | `Assets/SpectaclesInteractionKit.lspkg/` | Hand/gesture interaction, events, utilities |
| SpectaclesUIKit | `Assets/SpectaclesUIKit.lspkg/` | UI components (buttons, sliders, frames) |
| SpectaclesInteractionKitExamples | `Assets/SpectaclesInteractionKitExamples.lspkg/` | Reference examples (not used in production) |
| RemoteServiceGateway | `RemoteServiceGateway.lspkg/` | Gemini Live, audio/video helpers |
| SupabaseClient | `SupabaseClient.lspkg/` | Supabase JS client for Snap Cloud |
| LSTween | `LSTween.lspkg/` | Tween animation library |

---

## Dependency Graph

Arrows show import direction: `A → B` means A imports from B.  
Only project scripts are listed; third-party package imports are noted inline.

```
── _Boon ──────────────────────────────────────────────────
SupabaseDBManager       ──► KindwiseTypes (_Aggy)
                        ──► SimulatedData (_Boon)
SimulatedData           (no project imports — standalone data file)
ButterflyWingTextureGenerator (no project imports — standalone)
ButterflyInfoDisplayManager ──► KindwiseTypes (_Aggy)
                            ──► CustomLocationsLoader (_Boon)
                            ──► ButterflyInfoPrefabComponentsManager (_Boon)
ButterflyInfoPrefabComponentsManager (no project imports — standalone)
CloseFrameParent        (no project imports — standalone)
InsectIDAPITestScript   ──► KindwiseTypes (_Aggy)
                        ──► SupabaseDBManager (_Boon)
                        ──► ButterflyWingTextureGenerator (_Boon)
                        ──► ButterflyInfoDisplayManager (_Boon)
NearbySightingManager   ──► CustomLocationsLoader (_Boon)
                        ──► SupabaseDBManager (_Boon)
CustomLocationsLoader   (no project imports — standalone)
MapUIController         ──► MapComponent (lspkg)
MapContainerController  ──► MapComponent (lspkg), MapUIController (_Boon)
InteractableManipulation ──► MapComponent (lspkg)
MapMessageController    ──► MapComponent (lspkg)
QuestMarkController     ──► MapComponent (lspkg)
                        ──► CustomLocationsLoader (_Boon)
                        ──► UICollisionSolver (_Boon)
                        ──► MarkerInteractableTrigger (_Boon)
UICollisionSolver       (no project imports — standalone)
MarkerInteractableTrigger (no project imports — standalone)
ButterflyMovementController (no project imports — standalone)
FlyingButterflyManager  ──► ButterflyMovementController (_Boon)
CustomHandHintAnimation (no project imports — standalone)
InstructionManager      ──► CustomHandHintAnimation (_Boon)

── _Aggy ──────────────────────────────────────────────────
ButterflyIdentifier     ──► KindwiseTypes (_Aggy)
                        ──► SupabaseDBManager (_Boon)
                        ──► ButterflyWingTextureGenerator (_Boon)
                        ──► ButterflyInfoDisplayManager (_Boon)
                        ──► FlyingButterflyManager (_Boon)
BoundingBoxVisualizer   ──► MLSpatializer (_Aggy)
MLSpatializer (_Aggy)   ──► DetectionHelpers (_Aggy)
                        ──► YOLODetectionProcessor (_Aggy)
YOLODetectionProcessor (_Aggy) ──► DetectionHelpers (_Aggy)
DetectionHelpers (_Aggy) (no project imports — standalone)
EventModule             (no project imports — standalone)
KindwiseTypes           (no project imports — standalone)
ActivityIndicatorController (no project imports — standalone)
PalmPushToTalk          ──► GeminiAssistant (_Joe)
                        ──► ActivityIndicatorController (_Aggy)

── _Niko ──────────────────────────────────────────────────
DepthCacheSpatializer ──► MLSpatializer (_Niko)
                      ──► DepthCache
                      ──► DebugVisualizer
                      ──► DetectionContainer ──► ClosedPolyline
                      ──► DetectionHelpers (_Niko)
                      ──► SpatializerUtils

MLSpatializer (_Niko) ──► YOLODetectionProcessor (_Niko)
                      ──► DetectionHelpers (_Niko)

ButterflyCropApiBridge ──► MLSpatializer (_Niko)
                       ──► DetectionHelpers (_Niko)

YOLODetectionProcessor (_Niko) ──► DetectionHelpers (_Niko)

ButterflyCollectionDynamicTestManagerNew ──► SupabaseDBManager (_Boon)
                                         ──► FlyingButterflyManager (_Boon)
ButterflyCollectionLiteManager (no project imports — standalone)
ButterflyHoverAnimationController (no project imports — standalone)
ConservationStatusBar   (no project imports — standalone)
SeasonCalendar          (no project imports — standalone)
PromptCheatsheetCatalog (no project imports — standalone data file)
VisualPromptCheatsheetController ──► PromptCheatsheetCatalog (_Niko)

DetectionHelpers (_Niko) (no project imports — standalone)
SpatializerUtils         (no project imports — standalone)
DebugVisualizer          (no project imports — standalone)
DepthCache               (no project imports — standalone)
ClosedPolyline           (no project imports — standalone)

── _Joe ──────────────────────────────────────────────────
AgentOrchestrator   ──► AgentRouter, AgentTypes, AgentLanguageInterface
                    ──► AgentMemorySystem, AgentToolExecutor
AgentRouter         ──► NaturalistAgent, ArchivistAgent
                    ──► ButterflyIdentifier (_Aggy, optional)
NaturalistAgent     ──► OutdoorAgent, AgentTypes
                    ──► NearbySightingsTool, GeneralConversationTool
                    ──► ButterflyIdentificationTool (optional)
ArchivistAgent      ──► OutdoorAgent, AgentTypes
                    ──► NearbySightingsTool, GeneralConversationTool
                    ──► ButterflyIdentificationTool (optional)
AgentLanguageInterface ──► AgentTypes, GeminiAssistant (_Joe), OpenAIAssistant (_Joe)
ChatBridge          ──► AgentOrchestrator, ChatStorage, ChatComponent
                    ──► AgentTypes, ChatExtensions, TextLimiter
ChatComponent       (no project imports — standalone UI component)
GeminiAssistant     (no project imports — wraps RemoteServiceGateway.lspkg)
OpenAIAssistant     (no project imports — wraps RemoteServiceGateway.lspkg)
ImageGen            ──► GeminiAssistant (or similar provider)
ImageGenBridge      ──► ImageGen
ModelGen            (standalone — 3D model generation)
ModelGenBridge      ──► ModelGen
ChatStorage         ──► AgentTypes
StorageManager      (no project imports — standalone)
NearbySightingsTool    ──► SupabaseDBManager (_Boon)
ButterflyIdentificationTool ──► ButterflyIdentifier (_Aggy)
ButterflyCollectionTool ──► SupabaseDBManager (_Boon)
                        ──► FlyingButterflyManager (_Boon)
ButterflyDetectionTool  ──► MLSpatializer (_Aggy)
                        ──► DetectionHelpers (_Aggy)
                        ──► ButterflyIdentificationTool
DetectionCameraSetup    ──► MLSpatializer (_Aggy)
ToolRouter          ──► all registered tools
MockButterflyKnowledge (no project imports — standalone data)
ModelGenerationScheduler (no project imports — standalone)

── _UtilityScripts ────────────────────────────────────────
TimeManager             (no project imports — singleton, global.timeManager)
TimeManagerExample  ──► TimeManager (via global), external Logger package

── Cross-team ─────────────────────────────────────────────
NearbySightingsTool (_Joe)      ──► SupabaseDBManager (_Boon)
ButterflyIdentificationTool (_Joe) ──► ButterflyIdentifier (_Aggy)
ButterflyCollectionTool (_Joe)  ──► SupabaseDBManager (_Boon)
                                ──► FlyingButterflyManager (_Boon)
ButterflyDetectionTool (_Joe)   ──► MLSpatializer (_Aggy)
                                ──► DetectionHelpers (_Aggy)
DetectionCameraSetup (_Joe)     ──► MLSpatializer (_Aggy)
NaturalistAgent (_Joe)          ──► ButterflyIdentifier (_Aggy)
ArchivistAgent (_Joe)           ──► ButterflyIdentifier (_Aggy)
ButterflyIdentifier (_Aggy)     ──► SupabaseDBManager (_Boon)
                                ──► ButterflyWingTextureGenerator (_Boon)
                                ──► ButterflyInfoDisplayManager (_Boon)
                                ──► FlyingButterflyManager (_Boon)
ButterflyCollectionDynamicTestManagerNew (_Niko) ──► SupabaseDBManager (_Boon)
                                                 ──► FlyingButterflyManager (_Boon)
PalmPushToTalk (_Aggy)          ──► GeminiAssistant (_Joe)
```

---

<!-- BEGIN_SECTION: _Boon -->
## _Boon — Supabase, Butterfly Info, Wing Generator, AR Map

Owner: **Boon**  
Folders:
- `Assets/_Boon/SupabaseInfoStoring&Retrieving/Scripts/` — Supabase DB
- `Assets/_Boon/GenerateButterflyWingTexture/Scripts/` — Wing texture generation
- `Assets/_Boon/ButterflyInfoDisplay/Scripts/` — Info card UI
- `Assets/_Boon/ButterflyMovement/Scripts/` — Butterfly flight & spawn
- `Assets/_Boon/NearbySighting/Scripts/` — AR map, sighting pins, map controllers

---

### SupabaseInfoStoring&Retrieving/Scripts/SupabaseDBManager.ts

**Purpose:** All Supabase reads and writes for butterfly sightings. Handles authentication
(Snap OIDC), GPS capture, photo/wing-texture upload to Supabase Storage, and DB CRUD
on the `butterfly_sightings` table.

**Inspector inputs:**

| Input | Type | Required | Description |
|---|---|---|---|
| `supabaseProject` | SupabaseProject | Yes | Credentials asset (Window > Supabase > Import Credentials) |
| `storageBucket` | string | — | Storage bucket name (default `"butterfly-photos"`) |
| `addYourSimulatedData` | boolean | — | Insert simulated rows on start (idempotent per user) |

**Public API:**

| Method / Type | Description |
|---|---|
| `storeSighting(params)` | Upload photo + wing textures to Storage, then insert a `SightingRecord` row. Returns the inserted row or null. |
| `getAllSightings()` | All users' sightings ordered newest-first (omits raw suggestion blob). For the map. |
| `getMySightings()` | Current user's sightings with full data; clears `is_new` flag; loads wing textures in batches of 3. |
| `getNearbySightings(params)` | Bounding-box DB query + Haversine filter. Returns sightings within `radius` km/miles, sorted nearest-first. |
| `getUserId()` | Stable Supabase auth UUID (tied to Snap OIDC). Null before auth completes. |
| `seedTestData()` | Dev-only: insert 5 rows from `SimulatedData.ts` (idempotent per user). |
| `type SightingRecord` | Full DB row shape — see file header for all fields. |

**Key behaviours / gotchas:**
- Auth uses `signInWithIdToken({ provider: "snapchat" })`; retries up to 3× on network errors.
- Textures are re-encoded as PNG regardless of input format (`.jpg` paths in callers are rewritten internally) — the extension and content-type must match the real bytes or the remote loader hangs.
- `getMySightings()` loads wing textures in batches of 3 to avoid contention on `remote_assets_cache`.
- `getNearbySightings` does a rough bounding-box server-side, then precise Haversine client-side.

**Imports from project:** `KindwiseTypes` (_Aggy), `SimulatedData` (_Boon)  
**Imported by:** `ButterflyIdentifier` (_Aggy), `NearbySightingsTool` (_Joe),
  `NearbySightingManager` (_Boon), `ButterflyCollectionDynamicTestManagerNew` (_Niko),
  `InsectIDAPITestScript` (_Boon)

---

### SupabaseInfoStoring&Retrieving/Scripts/SimulatedData.ts

**Purpose:** Static test-data export (`SIMULATED_SIGHTINGS`) — 5 pre-built `SightingRecord`-shaped
rows covering London and Singapore clusters. Used only by `SupabaseDBManager.seedTestData()`.

**Imports from project:** none  
**Imported by:** `SupabaseDBManager`

---

### GenerateButterflyWingTexture/Scripts/ButterflyWingTextureGenerator.ts

**Purpose:** Calls the `generate-wing-texture` Supabase Edge Function with an image URL and
returns two decoded `Texture` objects (wing colour map + opacity map). Decodes both base64
responses in parallel; `onComplete` fires only after both succeed. Includes an optional
inspector test mode with live timing display.

**Inspector inputs:**

| Input | Type | Required | Description |
|---|---|---|---|
| `supabaseProject` | SupabaseProject | Yes | Credentials asset |
| `runTestModeAtStart` | boolean | — | Show test objects and run a test call on start |
| `testImageUrl` | string | — | Source URL for test mode |
| `testTextureImage` | Image | — | Preview target for wing colour map |
| `testOpacityImage` | Image | — | Preview target for opacity map |
| `testButterfly` | SceneObject | — | 3D preview butterfly (applies to child 2's RenderMeshVisual) |
| `timerText` | Text | — | Shows edge-function + decode timing |

**Public API:**

| Method | Description |
|---|---|
| `generateWingTextures(imageUrl, onComplete, onError?)` | Posts to the edge function, decodes both textures, calls `onComplete(wingTex, opacityTex, wingB64, opacityB64)`. |

**Imports from project:** none  
**Imported by:** `ButterflyIdentifier` (_Aggy), `InsectIDAPITestScript` (_Boon)

---

### ButterflyInfoDisplay/Scripts/ButterflyInfoDisplayManager.ts

**Purpose:** Instantiates a prefab and populates its `Text` and `Image` children from either
a live Kindwise identification (`displayResult`) or a stored sighting (`displaySighting`).
Each call re-instantiates the prefab (replacing the previous card).

**Inspector inputs:**

| Input | Type | Required | Description |
|---|---|---|---|
| `prefab` | ObjectPrefab | Yes | The butterfly info card prefab |
| `spawnParent` | SceneObject | No | Parent for the spawned prefab (defaults to this object) |
| `debugLogging` | boolean | — | Log field assignments to Logger |

**Public API:**

| Method | Description |
|---|---|
| `displayResult(suggestion, userPhotoTexture?)` | Populate from a live Kindwise `Suggestion`. Loads reference photos from Kindwise URLs. |
| `displaySighting(sighting)` | Populate from a stored `SightingInfo`. Loads spotter photo + species image from URLs. |

**Key behaviours / gotchas:**
- Wikidata CDN images (`/knowledge_base/wikidata/`) are silently skipped — they return HTTP 200 but fail in `loadResourceAsImageTexture`.
- Uses a static `ButterflyInfoPrefabComponentsManager._onReady` callback to capture the component reference synchronously during `prefab.instantiate()`.

**Imports from project:** `KindwiseTypes` (_Aggy), `CustomLocationsLoader` (SightingInfo), `ButterflyInfoPrefabComponentsManager`  
**Imported by:** `ButterflyIdentifier` (_Aggy), `InsectIDAPITestScript` (_Boon)

---

### ButterflyInfoDisplay/Scripts/ButterflyInfoPrefabComponentsManager.ts

**Purpose:** Lightweight component on the info card prefab root. Holds references to all
`Text` and `Image` components so `ButterflyInfoDisplayManager` can find them without
walking the hierarchy. Uses a static `_onReady` callback so the manager captures the
reference synchronously during `instantiate()`.

**Inspector inputs:** `textArray` (Text[]), `userPhotoImage` (Image), `dataPhotoImageArray` (Image[])

**Imports from project:** none  
**Imported by:** `ButterflyInfoDisplayManager`

---

### ButterflyInfoDisplay/Scripts/CloseFrameParent.ts

**Purpose:** Attaches to the prefab root that carries a SpectaclesUIKit `Frame` component.
On start, forces `frame.initialize()` (in case this card was instantiated at runtime after
the scene's normal `OnStartEvent` ordering), then wires the close button to `destroy()` the
parent SceneObject.

**Imports from project:** none (uses `Frame` from SpectaclesUIKit)  
**Imported by:** none — attach directly to the info card prefab root.

---

### ButterflyInfoDisplay/Scripts/InsectIDAPITestScript.ts

**Purpose:** Dev/test script. On start, encodes `inputTexture` as base64 and calls the
`identify-butterfly` Supabase Edge Function directly, then routes through
`ButterflyWingTextureGenerator` → `ButterflyInfoDisplayManager` and stores the result
via `SupabaseDBManager`. Use this to test the full identification pipeline without
hand-tracking or the production camera flow.

**Inspector inputs:** `supabaseProject`, `functionName`, `inputTexture`, `dbManager`,
`wingGenerator`, `infoDisplay`, `debugLogging`

**Imports from project:** `KindwiseTypes` (_Aggy), `SupabaseDBManager`, `ButterflyWingTextureGenerator`, `ButterflyInfoDisplayManager`  
**Imported by:** none — attach to a SceneObject for testing only.

---

### NearbySighting/Scripts/NearbySightingManager.ts

**Purpose:** Orchestrates the "nearby sightings on map" flow. Call `openNearbySighting()` to
animate the map in and fetch nearby sightings from Supabase within `searchRadius` miles,
then pin them via `CustomLocationsLoader`.

**Inspector inputs:**

| Input | Type | Required | Description |
|---|---|---|---|
| `map` | SceneObject | Yes | The AR map SceneObject (hidden until opened) |
| `customLocationLoader` | CustomLocationsLoader | Yes | Receives fetched sighting locations |
| `dbManager` | SupabaseDBManager | Yes | Auth + query handled automatically |
| `searchRadius` | number | — | Miles to search (default 5) |
| `maxResults` | number | — | Max pins (0 = unlimited, default 50) |

**Public API:**

| Method | Description |
|---|---|
| `openNearbySighting()` | Enables + scale-tweens the map in, then fetches + pins nearby sightings. |
| `closeNearbySighting()` | Clears all pins, scale-tweens the map out, then disables it. |
| `getNearbySighting()` | Fetch-and-pin only (no animation). Called internally by `openNearbySighting()`. |

**Imports from project:** `CustomLocationsLoader`, `SupabaseDBManager`  
**Imported by:** call `openNearbySighting()` from any agent or UI trigger script.

---

### NearbySighting/Scripts/CustomLocationsLoader.ts

**Purpose:** Manages runtime-added custom map pins on the `MapComponent` map. Pins queued
before the map is ready are buffered and flushed on `onInitialLocationSet`. Now also stores
a `SightingInfo` payload per pin so downstream scripts (e.g. `QuestMarkController`) can
show sighting details on tap.

**Inspector inputs:** `mapComponent` (MapComponent)

**Public API:**

| Method / Type | Description |
|---|---|
| `setLocations(locations)` | Clears all pins and places a fresh set. |
| `addLocation(location)` | Adds one pin; safe to call before map ready. Returns `MapPin` or null if queued. |
| `clearLocations()` | Removes all custom pins. |
| `getLocationForPin(pin)` | Returns the `CustomLocation` (including `sighting`) for a given `MapPin`. |
| `type CustomLocation` | `{ label, latitude, longitude, sighting? }` |
| `type SightingInfo` | Snapshot of a `SightingRecord` for display (scientific name, common names, photo URL, etc.) |

**Imports from project:** none  
**Imported by:** `NearbySightingManager`, `QuestMarkController`, `ButterflyInfoDisplayManager` (SightingInfo type)

---

### NearbySighting/Scripts/MarkerInteractableTrigger.ts

**Purpose:** Attached to a SceneObject that carries an `Interactable` component. Reacts to
hover/trigger events by changing the colour of two sibling `Text` objects and one sibling
`Image`, and scaling the parent on trigger. Now also holds a `SightingInfo` reference set
at runtime by `QuestMarkController` so tapping a map marker can show the sighting card.

**Inspector inputs:**

| Input | Type | Required | Description |
|---|---|---|---|
| `text1`, `text2` | SceneObject | Yes | Siblings with `Text` components |
| `image1` | SceneObject | Yes | Sibling with an `Image` component |
| `normalColor`, `hoverColor`, `triggerColor`, `triggerEndColor` | vec4 | — | State colours |
| `triggerScaleMultiplier` | vec3 | — | Per-axis scale multiplier during trigger (default 1.1×) |

**Key behaviours / gotchas:**
- Parent scale is cached at `onAwake`; restored exactly on trigger end.

**Imports from project:** `Interactable`, `InteractorEvent` (SpectaclesInteractionKit)  
**Imported by:** `QuestMarkController` — calls `setSightingData(sighting)` after spawning.

---

### NearbySighting/Scripts/MapUIController.ts

**Purpose:** Wires zoom-in, zoom-out, center-map, and mini/full-map toggle buttons to the
`MapComponent`. Tweens button positions between mini and full map layouts using `makeTween`.

**Inspector inputs:** `mapComponent`, `zoomInButton`, `zoomOutButton`, `centerMapButton`,
`toggleMiniMapButton`, `logObject` (optional debug)

**Imports from project:** `MapComponent` (lspkg), `MapUtils` (lspkg)  
**Imported by:** `MapContainerController` (imports `TWEEN_DURATION` constant)

---

### NearbySighting/Scripts/MapContainerController.ts

**Purpose:** Smooth-follows the AR map panel behind the camera using cylindrical coordinates
and `smoothDamp`. Handles mini↔full map transitions (resizing and repositioning the
`ContainerFrame`), drag start/end from the manipulation script, and a follow-button to
re-clamp to the camera frustum.

**Inspector inputs:** `mapComponent`, `translationXTime`, `translationYTime`, `translationZTime`,
`rotationTime`, `minFollowDistance`, `maxFollowDistance`

**Imports from project:** `MapComponent`, `MapUtils`, `MapUIController` (for `TWEEN_DURATION`)  
**Imported by:** none — top-level map controller.

---

### NearbySighting/Scripts/MapManipulation.ts

**Purpose:** Exports `InteractableManipulation` — enables pinch-drag repositioning of the AR
map. Handles direct and indirect (ray-cast) targeting modes, optional One Euro filter smoothing,
and Z-stretch for far manipulation. Switches colliders between mini and full map shapes when
the map toggles.

**Inspector inputs:** `mapSceneObject`, `mapComponent`, `fullMapCollider`, `miniMapCollider`,
`enableStretchZ`, `zStretchFactorMin`, `zStretchFactorMax`, `useFilter`, `minCutoff`, `beta`, `dcutoff`

**Imports from project:** `MapComponent` (lspkg), `MapUtils` (lspkg)  
**Imported by:** none — attach to the map's draggable SceneObject.

---

### NearbySighting/Scripts/MapMessageController.ts

**Purpose:** Shows/hides an error message panel (`ContainerFrame` + `Text`) in response to
`MapComponent` events: no nearby places found, nearby places fetch failed, and search started
(which closes any open message).

**Inspector inputs:** `mapComponent`, `container`, `textComponent`, `renderOrder`

**Public API:** `showMessage(message)`, `closePanel()`

**Imports from project:** `MapComponent` (lspkg)  
**Imported by:** none — attach to the error message SceneObject.

---

### NearbySighting/Scripts/QuestMarkController.ts

**Purpose:** Manages floating AR quest markers for each map pin. On each late-update frame,
projects the GPS bearing of every pin onto a screen-space boundary rectangle and positions
the marker accordingly (in-view = actual screen position; out-of-view = clamped to edge).
Uses `UICollisionSolver` to prevent overlapping labels.

Wires each spawned marker to its `MarkerInteractableTrigger` and passes the `SightingInfo`
from `CustomLocationsLoader` so tapping shows the sighting card.

**Inspector inputs:** `mapComponent`, `questMarkerPrefab`, `inViewMaterial`, `outOfViewMaterial`,
`customLocationsLoader`, `scale`, `markerImageOffsetInDegree`, `markerHalfWidth`,
`markerHalfHeight`, `labelHalfHeight`

**Imports from project:** `MapComponent`, `MapPin`, `MapUtils`, `QuestMarker` (lspkg);
  `UICollisionSolver`, `CustomLocationsLoader`, `MarkerInteractableTrigger` (_Boon)  
**Imported by:** none — top-level marker orchestrator.

---

### NearbySighting/Scripts/UICollisionDetector.ts

**Purpose:** Exports `UICollisionSolver`. Pure-logic utility — no Lens Studio APIs.
Resolves 1-D label collisions (edge markers on the map boundary) and 2-D label collisions
(in-view markers) using a sweep-line algorithm. Used by `QuestMarkController`.

**Imports from project:** none  
**Imported by:** `QuestMarkController`

---

### ButterflyMovement/Scripts/ButterflyMovementController.ts

**Purpose:** Drives a single butterfly's flight. Spawns it in front of the camera (with a
scale-in tween), wanders lifelike inside the user's field of view, and lands on a hand
finger joint when a hand is tracked — taking off again when tracking is lost.
Attach this directly to the butterfly SceneObject (it moves the object it is on).

**Inspector inputs:**

| Input | Type | Required | Description |
|---|---|---|---|
| `camera` | SceneObject | Yes | Main Spectacles camera. Origin/orientation for flight and spawning. |
| `fingerJointName` | string | — | SIK hand-joint to land on (default `indexTip`; e.g. `thumbTip`, `middleTip`, `wrist`). |
| `handViewAngleLimit` | number | — | Only land when the finger is within this angle (deg) of the camera view center (default 30). |
| `landingSmoothing` | number | — | Exponential ease rate onto the finger (default 3). Lower = slower/gentler landing. |
| `landPositionOffset` | vec3 | — | Perch offset from the joint, camera-relative cm: x=right, y=up, z=forward (default 0,0,0). |
| `speed` | number | — | Base flight speed in cm/s (default 25). |
| `scale` | number | — | Final scale; spawns at 0 and tweens up (default 1). |
| `spawnPositionOffset` | vec3 | — | Camera-local spawn offset in cm: x=right, y=up, z=forward (default 0,−5,60). |
| `spawnRotation` | vec3 | — | Camera-local spawn rotation in degrees (default 0,0,0). |
| `minDistance` / `maxDistance` | number | — | Wander distance band from camera in cm (default 40 / 90). |
| `horizontalAngle` / `verticalAngle` | number | — | Half-FOV bounds in degrees the butterfly stays within (default 22 / 16). |
| `spawnScaleDuration` | number | — | Scale-in tween duration in ms (default 700). |
| `flutterAmount` | number | — | Wobble size as a fraction of speed (default 0.55). 0 = straight glide. |
| `flutterFrequency` | number | — | Baseline wing-wobble rate in Hz (default 11). |
| `flutterNoise` | number | — | Randomness in the flutter rate (default 0.4). 0 = steady, 1 = erratic. |
| `headPitchFollow` | number | — | How much the head pitches toward vertical motion (default 0.25). 0 = body stays level. |
| `modelForwardAxis` | vec3 | — | Local axis that is the nose/front (default 0,1,0). Tune if the head points wrong. |
| `modelUpAxis` | vec3 | — | Local axis pointing up out of the back (default 0,0,−1). Tune if it flies upside-down. |
| `flyingRotationOffset` | vec3 | — | Extra local-degree rotation on top of the heading while flying (default 0,0,0). |
| `landedRotationOffset` | vec3 | — | Local-degree rotation while perched on a finger (default 0,0,0). |
| `fingerRotationFollow` | number | — | How much the perched butterfly rotates with the finger (default 0.4). 0 = face user, 1 = match finger. |
| `flyingAnimationSpeed` | number | — | AnimationPlayer playback speed while flying (default 4). |
| `landedAnimationSpeed` | number | — | AnimationPlayer playback speed while perched (default 0.25). |
| `debugFreezeHeading` | boolean | — | Hover in place facing straight ahead to read off head direction; off for normal flight. |

**Key behaviours / gotchas:**
- Free flight picks wander targets in camera-relative spherical coords, so it stays in view as the user looks around.
- Movement is velocity-steered with high-frequency perpendicular "wing wobble" for a fluttery, erratic path.
- Orientation aligns `modelForwardAxis` → heading and `modelUpAxis` → camera-up via `alignRotation()` (R = T·Sᵀ), not `quat.lookAt`. If the head points wrong, the mesh's real forward axis differs from the assumed one — set `debugFreezeHeading` and try the six axis options for `modelForwardAxis`.
- Hand tracking via SIK (`SIK.HandInputData`); right hand wins if both are tracked. Lands only when the finger is within `handViewAngleLimit` of the camera view (not merely when a hand is tracked).
- Landing approach is a frame-rate-independent exponential ease (`1 − e^(−landingSmoothing·dt)`) toward the joint — glides in and slows as it arrives. Once landed it tracks the joint exactly (no smoothing) plus a small idle bob. Free flight is still velocity-steered.
- Joint resolved dynamically by name off `TrackedHand` (e.g. `indexTip`), reading `Keypoint.position`/`.forward`/`.up`.
- Perched orientation (`facePerched`) slerps between facing the user and the finger's basis (mapped through model axes) by `fingerRotationFollow`.
- Camera view direction uses `transform.back` (camera looks along −Z), same convention as the map managers.
- Optional `AnimationPlayer` on the same SceneObject: sets every clip's `playbackSpeed` to `flyingAnimationSpeed` while airborne and `landedAnimationSpeed` while perched (no-op if absent).
- Landing requires a real device (hand tracking does not run in Preview).

**Public API (for `FlyingButterflyManager`):**

| Method | Description |
|---|---|
| `setLandingPermitted(permitted)` | Gate flying-to/landing-on the finger. `false` forces free flight / take-off. Default permitted. |
| `getWorldPosition()` | Current world position of the butterfly. |
| `isLanded()` | True once actually settled on the finger. |

**Imports from project:** none  
**Imports (packages):** `SIK`, `HandInputData`, `TrackedHand` (SpectaclesInteractionKit); `LSTween`, `Easing` (LSTween)  
**Imported by:** `FlyingButterflyManager`.

---

### Instruction/Scripts/CustomHandHintAnimation.ts

**Purpose:** Custom hand hint animation controller, forked from `InteractionHintController` in
`Spectacles3DHandHints.lspkg`. Drives animated hand hint models with left/right/both modes,
pinch glow effects, fade transitions, and animation sequencing — but with the cursor permanently
hidden. Call `play()` to start the animation from code at any time.

**Inspector inputs:**

| Input | Type | Description |
|---|---|---|
| `autoPlay` | boolean | Start playing automatically on awake |
| `animationSpeed` | float (0.5–3) | Playback speed multiplier |
| `numberOfLoops` | int (1–10) | Number of times to repeat the sequence |
| `hintAnimations` | HintAnimation[] | Sequence of animations with Hand Type, animation, and position |

**Public API:**

| Method | Description |
|---|---|
| `play()` | Reset and start playing the configured animation sequence |
| `animationEndEvent` | `DelayedCallbackEvent` fired when the full sequence finishes |

**Key differences from `InteractionHintController`:**
- Cursor (`HandHints_Cursor`) is permanently hidden — no cursor logic
- No Logger dependency
- `play()` method for manual start control (in addition to `autoPlay`)

**Imports from project:** none  
**Imports (packages):** `LSTween`, `Easing` (LSTween.lspkg); `LSTween`, `Tween`, `mainGroup` (Spectacles3DHandHints.lspkg)  
**Imported by:** any instruction/onboarding script that needs to trigger hand hints programmatically

---

### ButterflyMovement/Scripts/FlyingButterflyManager.ts

**Purpose:** Spawns butterfly prefabs, skins their wings with supplied textures, and coordinates
them so at most one flies to / lands on the user's finger at a time.

**Inspector inputs:**

| Input | Type | Required | Description |
|---|---|---|---|
| `butterflyPrefab` | ObjectPrefab | Yes | Prefab whose root has a `ButterflyMovementController`; 3rd child is the wing visual. |
| `camera` | SceneObject | Yes | Main camera; passed to each spawned butterfly and used for the facing test. |
| `fingerJointName` | string | — | SIK joint the butterflies land on; must match the prefab controller (default `indexTip`). |
| `facingAngleLimit` | number | — | A butterfly is "faced" when within this angle (deg) of the camera view center (default 30). |

**Public API:**

| Method | Description |
|---|---|
| `spawnButterfly(wingTexture, opacityTexture)` | Instantiates the prefab, clones the wing material and assigns `baseTex`/`opacityTex` (3rd child's RenderMeshVisual), registers the controller, sets its `camera`, returns it. |

**Coordination (per frame):** eligible = butterflies within `facingAngleLimit` of the view; among those,
the one closest to the finger (when the hand is in view) else closest to the camera is permitted to land
via `setLandingPermitted(true)`; all others `false`.

**Imports from project:** `ButterflyMovementController`  
**Imports (packages):** `SIK`, `HandInputData`, `TrackedHand` (SpectaclesInteractionKit)  
**Imported by:** `ButterflyIdentifier` (_Aggy) — calls `spawnButterfly()` after identification; `ButterflyCollectionDynamicTestManagerNew` (_Niko) — calls `spawnButterfly()` when a collection card is selected; `ButterflyCollectionTool` (_Joe) — calls `spawnButterfly()` for each sighting in the collection.

---

### Instruction/Scripts/CustomHandHintAnimation.ts

**Purpose:** Plays a sequenced 3D hand-hint animation using the `Spectacles3DHandHints.lspkg`
package. Configured via a list of `HintAnimation` typedef items (each specifying hand type —
left/right/both — and a gesture clip name). Handles outline fade-in/out, pinch glow detection,
loop control, and multi-clip sequencing. Call `play()` to start the sequence.

**Inspector inputs:** `autoPlay` (bool), `animationSpeed` (0.5–3), `numberOfLoops` (1–10),
  `hintAnimations` (HintAnimation[])

**Public API:** `play()` — starts the sequence from the beginning.

**Exports:** `CustomHandHintAnimation`, `HintAnimation` (typedef), `HandAnimationClipInfo`, `HandMode` (enum)

**Imports from project:** none  
**Imported by:** `InstructionManager`

---

### Instruction/Scripts/InstructionManager.ts

**Purpose:** Onboarding instruction panel. Scale-tweens in on start, then after a short delay
plays the `CustomHandHintAnimation` hand hint and shows a prompt text (`"Show me a map of all
nearby sightings"`), which auto-clears after 3 seconds. Requires `global.timeManager`.

**Inspector inputs:** `text` (Text), `handHint` (CustomHandHintAnimation)

**Imports from project:** `CustomHandHintAnimation`  
**Imported by:** none — attach to the onboarding SceneObject.

<!-- END_SECTION: _Boon -->

---

<!-- BEGIN_SECTION: _Niko -->
## _Niko — ML Object Detection Pipeline & Butterfly Collection UI

Owner: **Niko**  
Folder: `Assets/_Niko/Scripts/`  
Feature: Detects real-world objects using a YOLO model, spatialises them in 3D, crops frames for the API, and provides the butterfly collection/archive UI.

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

---

### ButterflyCollectionDynamicTestManagerNew.ts

**Purpose:** Experimental dynamic collection/archive manager. Reads butterfly sightings
from `SupabaseDBManager`, builds a scrollable `GridLayout` of species cards (3-column),
and spawns the flying butterfly via `FlyingButterflyManager` when a card is selected.
Injects lightweight preview and `Text` children into existing `Button` slots rather than
instantiating a new prefab per slot.

**Key safety notes:**
- Do NOT run alongside `ButterflyCollectionLiteManager` — both populate the same `GridLayout`.
- Uses `butterfly_low` preview prefab only; does NOT instantiate the old crashing collection slot prefab.

**Key inputs:** `supabaseDBManager`, `flyingButterflyManager`, `gridLayout`, `scrollWindow`,
`butterflyPreviewPrefab`, and various cell sizing parameters.

**Imports:** `SupabaseDBManager` (_Boon), `FlyingButterflyManager` (_Boon);  
  SIK: `Interactable`, `findAllComponentsInSelfOrChildren`;  
  SpectaclesUIKit: `GridLayout`, `ScrollWindow`, `RectangleButton`  
**Imported by:** nothing (top-level collection manager)

---

### ButterflyCollectionDynamicTestManager.ts

**Purpose:** Earlier iteration of the dynamic collection manager. Kept as a reference /
fallback. Do not activate alongside `ButterflyCollectionDynamicTestManagerNew`.

**Imports:** `SupabaseDBManager` (_Boon), `FlyingButterflyManager` (_Boon)  
**Imported by:** nothing

---

### ButterflyCollectionLiteManager.ts

**Purpose:** Stable, lightweight alternative collection UI. Drives the same `GridLayout`
from a JSON string (`collectionDataJson`) rather than live Supabase data. Supports hover
label fade animations. Use this when the dynamic manager is unstable or not needed.

**Inspector inputs:** `collectionDataJson` (JSON string of `LiteButterflyEntry[]`), `cellWidth`,
`cellHeight`, `cellGap`

**Public API:** `buildCollection()` — rebuilds the grid from the current JSON.

**Imports:** SIK: `Interactable`; SpectaclesUIKit: `GridLayout`, `ScrollWindow`, `RoundedRectangle`  
**Imported by:** nothing (top-level collection manager)

---

### ButterflyHoverAnimationController.ts

**Purpose:** Attaches to a spawned butterfly SceneObject. Dynamically creates a `ColliderComponent`
(box shape) and `Interactable`, then plays a wing-flap animation clip on hover-enter and resets
it on hover-exit. The clip name is resolved by trying a list of known names (e.g. `"Armature_wingFlap"`)
unless overridden in the inspector.

**Inspector inputs:** `clipName` (override; blank = auto-resolve), `colliderSize` (vec3, default 6×4.5×4.5 cm)

**Imports:** SIK: `Interactable`, `InteractorEvent`, `TargetingMode`, `NativeLogger`  
**Imported by:** nothing — attach directly to butterfly SceneObjects.

---

### ConservationStatusBar.ts

**Purpose:** Visual component that renders a colour-gradient status bar (Secure → Critical)
for a butterfly's IUCN/red-list conservation status. Shows a tooltip with label and explanation
on hover. Reads the `species_red_list` field from `SightingRecord` (or similar data) and maps
it to a 0–1 position on the gradient.

**Imports:** SpectaclesUIKit: `VisualElement`, `Tooltip`, `RoundedRectangleVisual`, `SnapOS2Styles`  
**Imported by:** nothing — attach to the info card prefab's status bar object.

---

### SeasonCalendar.ts

**Purpose:** Visual component that renders a 12-month calendar showing a butterfly's active
flight season as an animated gradient "blob". Reads month data from a flexible field schema
(e.g. `activeMonths`, `flightMonths`, `startMonth`/`endMonth`) and animates the blob position.
Shows a tooltip on hover.

**Imports:** SpectaclesUIKit: `VisualElement`, `Tooltip`, `RoundedRectangleVisual`, `RoundedRectangle`  
**Imported by:** nothing — attach to the info card prefab's season calendar object.

---

### PromptCheatsheetCatalog.ts

**Purpose:** Static prompt-card data for the in-lens visual cheatsheet. Groups demo prompts
by mode (`idle`, `voice`, `identification`, `detection`, `map`, `collection`, `spatial`,
`generation`, `palmTalk`) with expected outcome, runtime support, and component notes.

**Imports:** nothing  
**Imported by:** `VisualPromptCheatsheetController`

---

### VisualPromptCheatsheetController.ts

**Purpose:** Visual controller for rendering the prompt catalog into an existing Lens
Studio panel or a generated fallback text layout. Supports title/summary/status text,
multiple prompt card text slots, public mode-switching methods for buttons, optional
prompt-page rotation, and optional context watching via assigned SceneObject roots
(map, info card, collection, chat, palm talk).

**Inspector inputs:** `panelRoot`, `titleText`, `summaryText`, `statusText`,
`promptTextSlots`, `autoCreateLayout`, `startMode`, `autoDetectContext`,
`autoRotatePrompts`, `rotateSeconds`, `contextPollSeconds`, and optional context roots (`mapRoot`, `identificationRoot`,
`infoCardRoot`, `collectionRoot`, `chatRoot`, `palmTalkRoot`).

**Public API:** `showPanel()`, `hidePanel()`, `togglePanel()`, `setMode(mode)`,
`showIdle()`, `showVoice()`, `showIdentification()`, `showDetection()`, `showMap()`,
`showCollection()`, `showSpatial()`, `showGeneration()`, `showPalmTalk()`, `nextMode()`,
`previousMode()`, `nextPromptPage()`, `previousPromptPage()`, `getCurrentPromptText()`.

**Imports:** `PromptCheatsheetCatalog`  
**Imported by:** `Intro Screen` prefab — can also be attached to other help panels and
optionally wired to buttons or other scripts through its public methods.

<!-- END_SECTION: _Niko -->

---

<!-- BEGIN_SECTION: _Agrika -->
## _Agrika — Butterfly Detection + Kindwise Identification

Owner: **Agrika**  
Folder: `Assets/_Aggy/` (note: folder is `_Aggy`, MAP.md section key is `_Agrika`)  
Feature: Butterfly detection + Kindwise identification pipeline. Self-contained.

---

### Scripts/ButterflyIdentifier.ts

**Purpose:** Main identification component. Captures a high-res photo via `CameraModule.requestImage`,
encodes it as base64, and calls the `identify-butterfly` Supabase Edge Function. On success:
shows the species in `resultText`, calls `SupabaseDBManager.storeSighting`, calls
`ButterflyWingTextureGenerator.generateWingTextures`, calls `ButterflyInfoDisplayManager.displayResult`,
and calls `FlyingButterflyManager.spawnButterfly`.

**Inspector inputs:** `supabaseProject`, `functionName`, `resultText` (optional),
  `dbManager` (SupabaseDBManager), `wingGenerator` (ButterflyWingTextureGenerator),
  `infoDisplay` (ButterflyInfoDisplayManager), `flyingButterflyManager` (FlyingButterflyManager),
  `debugLogging`

**Public API:** `identify()` — trigger from a button, gesture, or agent tool.

**Key behaviours / gotchas:**
- `CameraModule.requestImage` does NOT work in Lens Studio Preview — must test on real Spectacles.
- The Kindwise API key lives in Supabase secrets (server-side), never in this lens.

**Imports:** `KindwiseTypes` (_Aggy), `SupabaseDBManager` (_Boon),
  `ButterflyWingTextureGenerator` (_Boon), `ButterflyInfoDisplayManager` (_Boon),
  `FlyingButterflyManager` (_Boon)  
**Imported by:** `ButterflyIdentificationTool` (_Joe); `AgentRouter`, `NaturalistAgent`, `ArchivistAgent` (_Joe)

---

### Scripts/BoundingBoxVisualizer.ts

**Purpose:** Draws bounding box overlays (via `MLSpatializer` detection events) as 2D screen-space
rectangles on a canvas. Development/debug tool for verifying YOLO detection output.

**Imports:** `MLSpatializer` (_Aggy)  
**Imported by:** nothing — attach to a SceneObject for debug visualisation.

---

### Scripts/MLSpatializer.ts

**Purpose:** _Aggy's local copy of the ML inference runner (same role as `_Niko/Scripts/MLSpatializer.ts`
but kept separately). Runs YOLO inference and emits detection events.

**Imports:** `DetectionHelpers` (_Aggy), `YOLODetectionProcessor` (_Aggy)  
**Imported by:** `BoundingBoxVisualizer` (_Aggy)

---

### Scripts/YOLODetectionProcessor.ts

**Purpose:** _Aggy's local copy. Pure logic — parses raw YOLO tensors into `Detection` objects with NMS.

**Imports:** `DetectionHelpers` (_Aggy)  
**Imported by:** `MLSpatializer` (_Aggy)

---

### Scripts/DetectionHelpers.ts

**Purpose:** _Aggy's local copy of the `Detection` class and helper utilities (no Lens Studio APIs).

**Imports:** nothing  
**Imported by:** `MLSpatializer` (_Aggy), `YOLODetectionProcessor` (_Aggy)

---

### Scripts/EventModule.ts

**Purpose:** Lightweight typed event bus used by the _Aggy ML pipeline.

**Imports:** nothing  
**Imported by:** `MLSpatializer` (_Aggy)

---

### Scripts/KindwiseTypes.ts

**Purpose:** TypeScript type definitions for the Kindwise API response format:
`IDResponse`, `Suggestion`, `SuggestionDetails`, taxonomy fields, etc. Shared across all
scripts that call the `identify-butterfly` edge function.

**Imports:** nothing  
**Imported by:** `ButterflyIdentifier` (_Aggy), `SupabaseDBManager` (_Boon),
  `ButterflyInfoDisplayManager` (_Boon), `InsectIDAPITestScript` (_Boon)

---

### Scripts/ActivityIndicatorController.ts

**Purpose:** Drives a `RenderMeshVisual` material's `in_out` shader parameter with a smooth
`animate()` tween. Call `show()` to fade the indicator in, `hide()` to fade it out.
Used by `PalmPushToTalk` to light up the mic button while recording.

**Inspector inputs:** `transitionDuration` (seconds, default 0.5)

**Public API:** `show()`, `hide()`

**Imports:** SIK: `animate`, `CancelSet`  
**Imported by:** `PalmPushToTalk` (_Aggy)

---

### Scripts/PalmPushToTalk.ts

**Purpose:** Palm-up gesture "push to talk" wired to Joe's `GeminiAssistant`. Detects when
the user raises an open hand toward their face, shows a hand-anchored menu, and streams
mic audio to Gemini while a pinch is held. Optional tooltip and live subtitle text.

**Flow:** Raise hand → menu appears → approach pinch → tooltip shows → pinch + hold →
`GeminiAssistant.streamData(true)` → speak → release → `streamData(false)` → Gemini replies.

**Inspector inputs:** `geminiAssistant`, `handMenu`, `activityIndicator` (optional),
  `tooltip` (optional), `subtitleText` (optional)

**Key behaviours / gotchas:**
- Device-only: hand tracking + Gemini streaming do not run in Preview.
- Wires to `GeminiAssistant` only via `streamData(bool)` and `userSpeechEvent`.

**Imports:** `GeminiAssistant` (_Joe), `ActivityIndicatorController` (_Aggy); SIK: `SIK`, `HandInputData`, `TrackedHand`, `WorldCameraFinderProvider`  
**Imported by:** nothing — attach to a SceneObject alongside GeminiAssistant.

<!-- END_SECTION: _Agrika -->

---

<!-- BEGIN_SECTION: _Joe -->
## _Joe — Gemini Live, Agent System, Image/Model Generation

Owner: **Joe**  
Folder: `Assets/_Joe/Assets/Scripts/`  
Feature: AI agent system for butterfly outdoor education, Gemini Live voice assistant,
image/3D model generation, and chat UI.

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
| `AgentTypes.ts` | Shared TypeScript interfaces: `Tool`, `ToolResult`, `Message`, `LLMResponse`, `ChatMessage`, etc. |
| `OutdoorAgent.ts` | Abstract base class for agents. Defines `registerTool()`, `execute()`, `canHandleQuery()`. |
| `NaturalistAgent.ts` | Gentle Socratic discovery guide. Voice-only, no camera. Registers `general_conversation`, optionally `nearby_sightings` and `butterfly_identification` tools. Always uses voice/audio. |
| `ArchivistAgent.ts` | Enthusiastic storyteller and knowledge curator. Can use camera for identification. Registers `general_conversation`, optionally `nearby_sightings` and `butterfly_identification` tools. Always uses voice/audio. |

### Core (Core/)

| Script | Purpose |
|---|---|
| `GeminiAssistant.ts` | Wraps `RemoteServiceGateway.lspkg` Gemini Live WebSocket. Streams mic audio to Gemini, plays back audio response, and optionally streams video frames. Exposes `streamData(bool)` and `userSpeechEvent` for PalmPushToTalk. Inspector: `websocketRequirementsObj`, `dynamicAudioOutput`, `microphoneRecorder`, `haveVideoInput`, `haveAudioOutput`, `voice`. |
| `OpenAIAssistant.ts` | LLM wrapper for OpenAI API via RemoteServiceGateway. |
| `ImageGen.ts` | Sends an image + prompt to a Gemini/image-gen endpoint. Returns a base64-encoded result image. |
| `ImageGenBridge.ts` | Inspector-facing component that wires `ImageGen` to scene inputs (texture, prompt text) and outputs (Image component). |
| `ModelGen.ts` | Requests 3D model generation from an external endpoint. |
| `ModelGenBridge.ts` | Inspector-facing component that wires `ModelGen` to scene objects. |

### Components (Components/)

| Script | Purpose |
|---|---|
| `ChatBridge.ts` | Bridge between `AgentOrchestrator` and `ChatComponent`. Polls `ChatStorage` for new messages each frame, splits long bot responses into timed sequential cards, and pushes them to `ChatComponent` for display. |
| `ChatComponent.ts` | Pure UI component. Renders chat messages as cards in a scrollable list. No agent logic — driven entirely by `ChatBridge`. |

### Storage (Storage/)

| Script | Purpose |
|---|---|
| `ChatStorage.ts` | In-memory log of `ChatMessage` objects (user + agent turns). Read by `ChatBridge`. |
| `StorageManager.ts` | Thin wrapper around Lens Studio's `PersistentStorageSystem` for key-value persistence. |

### Knowledge (Knowledge/)

| Script | Purpose |
|---|---|
| `MockButterflyKnowledge.ts` | Static mock dataset of butterfly facts used during development when the live API / Supabase is not available. |

### Tools (Tools/)

| Script | Purpose |
|---|---|
| `NearbySightingsTool.ts` | Queries Supabase (via `SupabaseDBManager`) for butterfly sightings near the user's GPS location. Returns species, distances, photos. Cached for 30s. |
| `ButterflyIdentificationTool.ts` | Wraps `ButterflyIdentifier` as an agent-callable tool. Triggers camera capture → Kindwise API identification. Returns species name, common name, probability. |
| `GeneralConversationTool.ts` | LLM fallback for general conversation. |
| `SpatialTool.ts` | Camera-based spatial analysis of the environment. |
| `LocationTool.ts` | Gets current GPS coordinates from Spectacles `LocationService`. |
| `WeatherTool.ts` | Gets weather conditions from Spectacles `UserContextSystem`. |
| `ToolRouter.ts` | AI-powered tool selection. Indexes `spatial_tool`, `general_conversation`, `nearby_sightings` (when `dbManager` is available), and `butterfly_identification` (when `butterflyIdentifier` is available). |
| `index.ts` | Tool exports and `createTools()` factory. Accepts optional `butterflyIdentifier` for `ButterflyIdentificationTool`. |
| `ButterflyCollectionTool.ts` | Fetches the user's sightings from `SupabaseDBManager.getMySightings()`, spawns 3D butterflies via `FlyingButterflyManager`, and returns a natural-language summary. Trigger phrase: "show me my butterfly collection". |
| `ButterflyDetectionTool.ts` | Runs a 10-second YOLO scan via `MLSpatializer` (_Aggy). Deduplicates frame-to-frame detections by IoU overlap, then auto-triggers `ButterflyIdentificationTool` if butterflies are found. Returns a `ButterflyDetectionResult` with detected species and an identification result. Trigger phrase: "help me scan for butterflies". |
| `EnvironmentalToolsExample.ts` | Example / reference showing how to register environment-query tools. Not used in production. |

### Utils (Utils/)

| Script | Purpose |
|---|---|
| `APIKeyHint.ts` | Inspector helper that displays a warning if required API keys are not configured. |
| `ChatExtensions.ts` | Utility functions for formatting and processing `ChatMessage` objects (e.g. truncating, stripping markdown). |
| `ModelGenerationScheduler.ts` | Throttles and queues model generation requests to avoid hitting rate limits. |
| `TextLimiter.ts` | Exports `CHARACTER_LIMITS` constants and `TextLimiter` utility for enforcing display character caps per message type. |

### DetectionCameraSetup (DetectionCameraSetup.ts)

**Purpose:** Drop on the same SceneObject as `MLSpatializer` (_Aggy). Requests the left
RGB camera feed at runtime via `CameraModule.requestCamera(CameraId.Left_Color)` and
auto-wires the resulting texture to `mlSpatializer.inputTexture`.

**Inspector inputs:** `mlSpatializer` (MLSpatializer from _Aggy)

**Key behaviours / gotchas:** Device-only — `CameraModule.requestCamera` returns null in
Lens Studio Preview; the script logs a warning and continues safely.

**Imports from project:** `MLSpatializer` (_Aggy)  
**Imported by:** none — attach to the detection SceneObject.

### Cross-team imports

`NearbySightingsTool` imports `SupabaseDBManager` from `_Boon/SupabaseInfoStoring&Retrieving/Scripts/`.  
`ButterflyIdentificationTool` imports `ButterflyIdentifier` from `_Aggy/Scripts/`.  
`ButterflyCollectionTool` imports `SupabaseDBManager` (_Boon) and `FlyingButterflyManager` (_Boon).  
`ButterflyDetectionTool` imports `MLSpatializer` and `DetectionHelpers` from `_Aggy/Scripts/`, and `ButterflyIdentificationTool`.  
`DetectionCameraSetup` imports `MLSpatializer` from `_Aggy/Scripts/`.  
`AgentRouter`, `NaturalistAgent`, `ArchivistAgent` accept optional `ButterflyIdentifier` from `_Aggy/Scripts/`.  
`AgentLanguageInterface` uses `GeminiAssistant` and `OpenAIAssistant` from `Core/`.  
`PalmPushToTalk` (_Aggy) imports `GeminiAssistant` from `Core/GeminiAssistant.ts`.

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
