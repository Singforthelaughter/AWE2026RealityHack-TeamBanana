## Inspiration

## What it does

- **Butterfly Info Display**: spawns a 3D info card and fills it with species data + photos, from either a live identification or a stored sighting.
- **Supabase Store / Retrieve**: cloud persistence that writes sightings (data + images + GPS) and reads them back, gated by Snap identity.
- **Wing Texture Generator**: calls a serverless function to turn a butterfly photo into a procedural wing texture + opacity map.
- **Nearby Sighting Map**: a floating AR minimap that pins real-world sightings around the user and opens detail cards on tap.

## How we built it

**Identity and persistence.** We used **Supabase on Snap Cloud** with **Snap OIDC** authentication via `signInWithIdToken({ provider: "snapchat" })`. Each player gets a stable Supabase UUID bound to their Snapchat account, so sightings stay attributed even if they rename themselves. Row-level security sets `user_id` server-side from `auth.uid()`, so the client is never trusted with identity.

**Storing sightings.** When a butterfly is identified, `SupabaseDBManager` grabs GPS (`GeoLocation` LocationService at navigation accuracy) and the Snap display name, uploads the photo and generated wing textures to Supabase Storage, and inserts a structured species row, all in parallel via `Promise.all`.

**Finding nearby sightings.** "Butterflies near me" is a two-stage query. A cheap lat/lon **bounding box** runs on the database to limit rows, then a precise **Haversine** distance filter runs on-device and sorts nearest-first. For two points the great-circle distance is:

$$
d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\varphi}{2}\right) + \cos\varphi_1 \cos\varphi_2 \sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)
$$

where φ is latitude, λ is longitude, and R ≈ 6371 km.

**AI-generated wing textures of the species you found.** Heavy generation runs off-device on a **Snap Cloud (Supabase) Edge Function**: `ButterflyWingGenerator` POSTs a reference image of the **just-identified species** to our `generate-wing-texture` function, which uses **Replicate** to run **Nano Banana Pro** and produce both a clean **wing texture** and a matching **opacity map**. The function returns both as base64; the lens decodes them in parallel and applies them (`baseTex` / `opacityTex`) to a live 3D butterfly mesh, so the butterfly that flutters in front of you is the _same species you just identified_, with bespoke AI-generated wings, and none of the model inference runs on the headset.

**The AR map.** Built on Snap's Map Component. `NearbySightingManager` reads GPS once and drops live pins; `CustomLocationsLoader` manages runtime pins (queuing any added before the map finishes initializing). Marker taps run through the Spectacles Interaction Kit to rehydrate the full info card from the stored record.

**Info cards.** The card binds data by **SceneObject name** (case-insensitive), so designers can rearrange the prefab without touching code, and it's dismissable via a UI Kit `Frame` close button.

## Challenges we ran into

**Flaky CDN images.** Some species reference images return HTTP 200 but silently fail at `loadResourceAsImageTexture`. We had to detect and filter those URLs (and prefer alternates) before display so cards never showed broken slots.

**Readable AR markers.** When several sightings cluster, their floating labels overlap into an unreadable pile. We wrote a **sweep-line collision solver** that spreads overlapping markers apart in 1D (along screen edges) and 2D (in-view), so off-screen quest markers and labels stay legible.

**Wing generation from Spectacles photos.** Photos captured directly from Spectacles are often insufficient quality for AI wing generation — lighting, angle, and resolution can all degrade results. We fell back to reference images from the Kindwise insect.id database instead. The trade-off is that the generated wing pattern and colours reflect the canonical species appearance rather than the specific individual the user spotted in real life.

**Wing generation latency.** Running the wing texture through Replicate takes roughly a minute end-to-end. This is a meaningful UX cost, but the quality of the resulting wing texture and opacity map is substantially better than faster alternatives, so we accepted the wait rather than compromise the visual output.

## Accomplishments that we're proud of

- A **fully shared, persistent sighting world**: sightings logged by one player show up as real-world AR pins for everyone else, with photos, species data, and attribution intact.
- Real **geospatial "near me" queries** running end-to-end on the headset, from GPS capture to bounding-box DB filtering to on-device Haversine sorting.
- An AR map that stays **legible under motion**: directional quest markers plus a custom collision solver keep clustered sightings readable.

## What we learned

- How much of good AR UX is **legibility under motion**: directional markers and collision-resolved labels matter as much as the data behind them.

## What's next for Butterfly Spotting & Social Sightings

## Built with (Snap / Spectacles platform features)

- **Snap Spectacles + Lens Studio 5.x**
- **Snap OIDC auth + Supabase on Snap Cloud** (`signInWithIdToken({ provider: "snapchat" })`)
- **Supabase Postgres table** (`butterfly_sightings`): stores each sighting's species data, GPS, attribution, and image URLs, with row-level security
- **Supabase Storage**: hosts captured photos and generated wing/opacity textures (public URLs stored in the DB)
- **Supabase Edge Functions**: serverless backend for species ID (Kindwise) and wing-texture generation (Replicate + Nano Banana Pro)
- **`userContextSystem.requestDisplayName`**: Snap display name for attribution
- **RawLocationModule / `GeoLocation` LocationService**: real-world GPS
- **Snap Map Component**: the AR world map, pins, and user location
- **Spectacles Interaction Kit (SIK)**: `Interactable`, `PinchButton`, `ToggleButton`, `ContainerFrame`, hand/mobile interactors, `OneEuroFilter`, `WorldCameraFinderProvider`
- **Spectacles UI Kit**: `Frame` cards with close buttons
- **InternetModule + RemoteServiceHttpRequest + RemoteMediaModule**: runtime image download
- **`Base64.encodeTextureAsync` / `decodeTextureAsync`**: texture (de)serialization
- **LSTween**: map open and minimap to full animations
- **Kindwise insect-ID API** (via Supabase Edge Function): species identification
