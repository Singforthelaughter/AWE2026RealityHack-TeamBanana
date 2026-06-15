## Inspiration

Nature is vast, beautiful, and inspirational, a treasure trove of discoveries for naturalists and researchers of any age. But we kept running into two challenges. Naturalists and researchers constantly seek efficient ways to identify and document species in the field. Learners and educators seek more engaging ways to learn about local biodiversity.

We created **The Butterfly Path** to address both, through the example of butterflies: by simplifying ecological observation and transforming butterfly discovery into an interactive, gamified learning experience.

To get it right, we started by talking to the people who live this every day. We interviewed naturalists and researchers who are experts in the whole process of noticing, identifying, recording, and sharing wildlife, and asked ourselves how that expertise could be shared with everyone through the wonderful technology that is Spectacles.

A recurring theme was that real curiosity starts with first-hand exposure and close observation. As Professor Antonia Monteiro, an expert in the evolution and development of butterfly wing patterns, told us:

> "Experiences that got me hooked into butterfly research, I would have to say that it was plenty of exposure to nature outings during college, where I could observe butterflies first hand at close distance. It was their colors and beautiful patterns that attracted me to them. Then, a book by physicist Fred Hoyle, that mentioned that some patterns, such as eyespots, should not be able to evolve gradually, got me thinking about eyespot evolution. Those two things got me started in the research I do now."

That stuck with us: close observation plus a story that piques your curiosity is what turns a passing glance into a lifelong interest. So we built the experience around that idea. We leveraged trusted databases like iNaturalist and Kindwise for real species data, and developed AI personas that encourage curiosity and noticing, model Socratic questioning, and share stories that pull you in, all on the headset, in the moment you spot a butterfly in the wild.

## What it does

The experience follows a natural discovery loop (**Noticing → Identifying → Recording → Sharing**), all driven by voice and your gaze.

**1. Noticing.** A **Gemini Live** voice agent runs the whole experience hands-free, so you just talk and look. A **Naturalist** agent guides you to slow down and observe through Socratic questions ("what do you notice about its wings?"), turning a passing glance into real attention.

**2. Identifying.** When you point your gaze at a butterfly, the agent kicks off species **identification**, then spawns a **3D info card** filled with species data + photos. **AI wing generation** turns the identified species into a bespoke wing texture + opacity map applied to a live 3D butterfly that flutters into your space, while an **Archivist** agent shares facts, migration stories, and context.

**3. Recording.** Identified butterflies fly in and **perch on your index finger**, and each one is added to your **personal collection**, where you can revisit every species you've found, each rendered as its own AI-generated 3D butterfly. Sightings (species data, photos, and GPS) are persisted to the cloud via **Supabase**, gated by your Snap identity.

**4. Sharing.** A floating AR **minimap** pins real-world sightings around you (including ones logged by other players) and opens a detail card on tap, turning every identification into part of a shared, persistent sighting world.

## How we built it

**Identity and persistence.** We used **Supabase on Snap Cloud** with **Snap OIDC** authentication via `signInWithIdToken({ provider: "snapchat" })`. Each player gets a stable Supabase UUID bound to their Snapchat account, so sightings stay attributed even if they rename themselves. Row-level security sets `user_id` server-side from `auth.uid()`, so the client is never trusted with identity.

**Storing sightings.** When a butterfly is identified, `SupabaseDBManager` grabs GPS (`GeoLocation` LocationService at navigation accuracy) and the Snap display name, uploads the photo and generated wing textures to Supabase Storage, and inserts a structured species row, all in parallel via `Promise.all`.

**Finding nearby sightings.** "Butterflies near me" is a two-stage query. A cheap lat/lon **bounding box** runs on the database to limit rows, then a precise **Haversine** distance filter runs on-device and sorts nearest-first. For two points the great-circle distance is:

$$
d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\varphi}{2}\right) + \cos\varphi_1 \cos\varphi_2 \sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)
$$

where φ is latitude, λ is longitude, and R ≈ 6371 km.

**AI-generated wing textures of the species you found.** Heavy generation runs off-device on a **Snap Cloud (Supabase) Edge Function**: `ButterflyWingGenerator` POSTs a reference image of the **just-identified species** to our `generate-wing-texture` function, which uses **Replicate** to run **Nano Banana Pro** and produce both a clean **wing texture** and a matching **opacity map**. The function returns both as base64; the lens decodes them in parallel and applies them (`baseTex` / `opacityTex`) to a live 3D butterfly mesh, so the butterfly that flutters in front of you is the _same species you just identified_, with bespoke AI-generated wings, and none of the model inference runs on the headset.

**Voice-driven AI guide that teaches you about butterflies.** The whole experience is fronted by a **Gemini Live** agent (`gemini-2.0-flash-live-preview-04-09`) handling real-time speech-to-text, text-to-speech, and camera vision over a WebSocket, so the user just talks and looks. On top of it we built a **multi-agent education system**: an `AgentOrchestrator` runs **LLM-based routing** (no hard-coded `if/else`) to pick the right agent and tool per utterance, and two agents with distinct teaching styles collaborate mid-conversation: a **Naturalist** that guides discovery through Socratic questioning ("what do you notice about its wings?") and an **Archivist** that follows up with species facts, migration stories, and context. The same agent layer activates every feature hands-free through a `ToolRouter`: the `ButterflyIdentificationTool` kicks off species ID, while `SpatialTool` (camera → Gemini vision), `LocationTool` (GPS), and `WeatherTool` give the agents real-world context to teach from. A priority queue with a depth limiter keeps the two agents from ping-ponging forever.

**The AR map.** Built on Snap's Map Component. `NearbySightingManager` reads GPS once and drops live pins; `CustomLocationsLoader` manages runtime pins (queuing any added before the map finishes initializing). Marker taps run through the Spectacles Interaction Kit to rehydrate the full info card from the stored record.

**Info cards.** The card binds data by **SceneObject name** (case-insensitive), so designers can rearrange the prefab without touching code, and it's dismissable via a UI Kit `Frame` close button.

## Challenges we ran into

**Flaky CDN images.** Some species reference images return HTTP 200 but silently fail at `loadResourceAsImageTexture`. We had to detect and filter those URLs (and prefer alternates) before display so cards never showed broken slots.

**Readable AR markers.** When several sightings cluster, their floating labels overlap into an unreadable pile. We wrote a **sweep-line collision solver** that spreads overlapping markers apart in 1D (along screen edges) and 2D (in-view), so off-screen quest markers and labels stay legible.

**Wing generation from Spectacles photos.** Photos captured directly from Spectacles are often insufficient quality for AI wing generation, since lighting, angle, and resolution can all degrade results. We fell back to reference images from the Kindwise insect.id database instead. The trade-off is that the generated wing pattern and colours reflect the canonical species appearance rather than the specific individual the user spotted in real life.

**Wing generation latency.** Running the wing texture through Replicate takes roughly a minute end-to-end. This is a meaningful UX cost, but the quality of the resulting wing texture and opacity map is substantially better than faster alternatives, so we accepted the wait rather than compromise the visual output.

**Training our own butterfly SnapML model.** We tried to train a custom **SnapML** model for on-device butterfly identification _and_ bounding-box localization. We got reliable **detection** (knowing a butterfly is in the camera view and where) but couldn't reach accurate per-**species classification** in time, so we fell back to the Kindwise insect.id API for identification while keeping the on-device detection. Training our own classifier remains on the roadmap.

## Accomplishments that we're proud of

- A **fully shared, persistent sighting world**: sightings logged by one player show up as real-world AR pins for everyone else, with photos, species data, and attribution intact.
- Real **geospatial "near me" queries** running end-to-end on the headset, from GPS capture to bounding-box DB filtering to on-device Haversine sorting.
- An AR map that stays **legible under motion**: directional quest markers plus a custom collision solver keep clustered sightings readable.
- **AI-generated wings** with texture and opacity map upon butterfly identification: textures are applied to a live 3D butterfly mesh that spawns directly in the user's environment, with bespoke wings matching the identified species.
- **3D butterflies that land on the user's index finger**, managed by a butterfly lifecycle system that tracks, animates, and retains every species the user has collected.
- A **personal butterfly gallery**: users can revisit all the butterflies they have identified, with each one rendered as its AI-generated 3D model.
- **Gemini Live-controlled workflow** that activates tools and features entirely through voice, delivering a true hands-free AR experience.
- **Cross-continental team collaboration**: half the team was in Singapore, half in the US, and we shipped a cohesive, integrated experience across a 13-hour time difference with no in-person overlap.

## What we learned

- How much of good AR UX is **legibility under motion**: directional markers and collision-resolved labels matter as much as the data behind them.
- **Offload heavy work off the headset.** Moving species ID and wing generation to Supabase Edge Functions kept the lens responsive: the headset never runs model inference, it just decodes and applies the results.
- **Voice is a first-class input on Spectacles.** A Gemini Live agent driving tool activation removed the need for fiddly hand UI and made the whole flow genuinely hands-free.
- **Real-world data is messy.** CDN images that 200 but fail to decode, Spectacles photos too low-quality for wing generation, and clustered GPS pins all forced us to build defensive fallbacks rather than trust the happy path.
- **How to use Snap Cloud Supabase end-to-end.** We learned to wire up Supabase on Snap Cloud across all three layers: a Postgres **table** with row-level security for sightings, **Storage** buckets for photos and generated textures, and **Edge Functions** for the serverless species-ID and wing-generation backend.
- **How to build multi-agent AI for XR on Snap Spectacles.** Wiring a real-time voice agent, LLM-based routing, and collaborating Naturalist/Archivist agents into a Lens taught us how to structure an agent system (orchestrator, router, tool contract) that runs within Spectacles' constraints.
- **Remote teams can ship tight AR.** Coordinating across a 13-hour Singapore/US gap pushed us toward clear module boundaries (see `MAP.md`) so people could work in parallel without stepping on each other.

## What's next for Butterfly Spotting & Social Sightings

- **Faster wing generation.** Bring the ~1-minute Replicate round-trip down with a lighter model or cached/precomputed textures so the butterfly appears closer to real time.
- **On-device species photos.** Improve capture and pre-processing so we can generate wings from the user's _own_ Spectacles photo instead of falling back to a reference image.
- **Richer social layer.** Friend lists, leaderboards, and shared collection events so the persistent sighting world feels like a living community, not just shared pins.
- **Live multiplayer presence.** See other players' butterflies and avatars in real time when you're in the same place.
- **Beyond butterflies.** Generalize the identify → generate → collect loop to other species (birds, insects, plants) for a broader real-world AR nature collection.
- **Custom SnapML model.** Train our own SnapML butterfly classifier that identifies species with higher accuracy, running on-device for instant, offline identification.

## Built with (Snap / Spectacles platform features)

- **Snap Spectacles + Lens Studio 5.x**
- **Snap OIDC auth + Supabase on Snap Cloud** (`signInWithIdToken({ provider: "snapchat" })`)
- **Supabase Postgres table** (`butterfly_sightings`): stores each sighting's species data, GPS, attribution, and image URLs, with row-level security
- **Supabase Storage**: hosts captured photos and generated wing/opacity textures (public URLs stored in the DB)
- **Supabase Edge Functions**: serverless backend for species ID (Kindwise) and wing-texture generation (Replicate + Nano Banana Pro)
- **Gemini Live** (`gemini-2.0-flash-live-preview-04-09`, via Remote Service Gateway): real-time voice (speech-to-text + text-to-speech), camera vision, and transcription over WebSocket
- **Multi-agent education system**: `AgentOrchestrator` with LLM-based routing, collaborating Naturalist (Socratic) + Archivist (storyteller) agents, and a `ToolRouter` driving the butterfly ID, spatial/vision, location, and weather tools for hands-free activation
- **Spectacles ASR / TTS + Camera Module**: voice input and camera frames feeding the Gemini Live agent
- **`userContextSystem.requestDisplayName`**: Snap display name for attribution
- **RawLocationModule / `GeoLocation` LocationService**: real-world GPS
- **Snap Map Component**: the AR world map, pins, and user location
- **Spectacles Interaction Kit (SIK)**: `Interactable`, `PinchButton`, `ToggleButton`, `ContainerFrame`, hand/mobile interactors, `OneEuroFilter`, `WorldCameraFinderProvider`
- **Spectacles UI Kit**: `Frame` cards with close buttons
- **InternetModule + RemoteServiceHttpRequest + RemoteMediaModule**: runtime image download
- **`Base64.encodeTextureAsync` / `decodeTextureAsync`**: texture (de)serialization
- **LSTween**: map open and minimap to full animations
- **Kindwise insect-ID API** (via Supabase Edge Function): species identification
