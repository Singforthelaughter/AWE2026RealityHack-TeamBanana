/**
 * AGENT INSTRUCTION — SupabaseDBManager
 *
 * This component handles all Supabase reads and writes for butterfly sightings.
 * Add it to a SceneObject in the scene, then assign the SupabaseProject asset in the inspector.
 *
 * ── WRITING A SIGHTING ──────────────────────────────────────────────────────
 * Call `storeSighting(params)` after a butterfly is identified. You need:
 *   - `suggestion`    — the top Kindwise Suggestion (from IDResponse.result.classification.suggestions[0])
 *   - `photoTexture`  — Texture from the user's camera capture (or null)
 *   - `wingTexture`   — Texture of the butterfly wing material (or null)
 *   - `identifiedAt`  — optional Date; defaults to now()
 *
 * Auth, snap display name, and GPS coordinates are handled automatically — do not pass them.
 * Returns the inserted SightingRecord, or null on failure.
 *
 * Example:
 *   const record = await dbManager.storeSighting({
 *     suggestion: response.result.classification.suggestions[0],
 *     photoTexture: capturedTexture,
 *     wingTexture: wingTexture,
 *     latitude: 37.7749,
 *     longitude: -122.4194,
 *   })
 *
 * ── READING SIGHTINGS ────────────────────────────────────────────────────────
 * `getAllSightings()` — returns all users' sightings ordered newest-first (for the map).
 *                       Omits species_suggestion_raw to keep payload small.
 * `getMySightings()`  — returns only the current user's sightings with full data.
 *
 * Each result is a SightingRecord (see type below). Key fields for display:
 *   record.species_scientific_name  — e.g. "Danaus plexippus"
 *   record.species_common_names     — e.g. ["Monarch butterfly"]
 *   record.species_probability      — 0–1 confidence
 *   record.photo_url                — public URL to the user's capture photo
 *   record.wing_texture_url         — public URL to the wing texture image
 *   record.latitude / .longitude    — GPS position (auto-captured from RawLocationModule)
 *   record.snap_display_name        — user's Snap display name at time of sighting
 *   record.identified_at            — ISO timestamp string
 *
 * ── USER IDENTITY ────────────────────────────────────────────────────────────
 * `getUserId()` — returns the stable Supabase auth UUID for the current user.
 *                 Tied to their Snap account via OIDC; never changes on username change.
 *                 Returns null if not yet authenticated (auth runs async on start).
 *
 * ── INSPECTOR INPUTS ─────────────────────────────────────────────────────────
 * supabaseProject  — assign the SupabaseProject asset (Window > Supabase > Import Credentials)
 * storageBucket    — Supabase Storage bucket name; default "butterfly-photos"
 */

import { Suggestion } from "../../../_Aggy/Scripts/KindwiseTypes"
import { createClient, SupabaseClient } from "SupabaseClient.lspkg/supabase-snapcloud"
import { SIMULATED_SIGHTINGS } from "./SimulatedData"
require("LensStudio:RawLocationModule")
const internetModule = require("LensStudio:InternetModule") as { makeResourceFromUrl: (url: string) => any }

// One row from the butterfly_sightings table.
type SightingRecord = {
  id: string
  user_id: string
  snap_display_name: string | null
  latitude: number | null
  longitude: number | null
  photo_url: string | null
  wing_texture_url: string | null
  wing_opacity_map_url: string | null
  identified_at: string
  species_scientific_name: string | null
  species_common_names: string[] | null
  species_probability: number | null
  species_red_list: string | null
  species_description: string | null
  species_danger_description: string | null
  species_taxonomy: object | null
  species_danger: string[] | null
  species_role: string[] | null
  species_image_url: string | null
  species_gbif_id: number | null
  species_inaturalist_id: number | null
  species_suggestion_raw: object | null
  is_new: boolean
  // Populated at runtime by getMySightings() — not stored in DB.
  wing_texture: Texture | null
  wing_opacity_map: Texture | null
}

@component
export class SupabaseDBManager extends BaseScriptComponent {
  @input
  @hint("SupabaseProject asset from Asset Browser (Window > Supabase > Import Credentials)")
  supabaseProject!: SupabaseProject

  @input
  @hint("Storage bucket name for sighting photos (create in Supabase dashboard)")
  storageBucket: string = "butterfly-photos"

  @input
  @hint("Insert simulated sightings on start (idempotent — skipped if user already has data)")
  addYourSimulatedData: boolean = false

  private client!: SupabaseClient
  private uid: string | null = null
  private snapDisplayName: string | null = null
  private locationService: LocationService | null = null
  private readonly TABLE = "butterfly_sightings"
  private readonly remoteMediaModule = require("LensStudio:RemoteMediaModule") as RemoteMediaModule

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.initSupabase())
  }

  private async initSupabase() {
    this.client = createClient(
      this.supabaseProject.url,
      this.supabaseProject.publicToken,
      { realtime: { heartbeatIntervalMs: 2500 } }
    )
    global.userContextSystem.requestDisplayName((name: string) => {
      this.snapDisplayName = name || null
    })
    this.locationService = GeoLocation.createLocationService()
    this.locationService.accuracy = GeoLocationAccuracy.Navigation
    await this.signIn()
    print(`>>>>> UID START [${this.uid}] UID END <<<<<`)
    if (this.addYourSimulatedData) await this.seedTestData()
  }

  private async signIn(retryCount: number = 0): Promise<boolean> {
    const maxRetries = 3
    try {
      const { data, error } = await this.client.auth.signInWithIdToken({
        provider: "snapchat",
        token: "",
      })

      if (error) {
        // Check for an existing valid session before retrying
        try {
          const { data: sd } = await this.client.auth.getSession()
          if (sd?.session?.user?.id) {
            this.uid = JSON.stringify(sd.session.user.id).replace(/^"(.*)"$/, "$1")
            return true
          }
        } catch (_) {}

        if (retryCount < maxRetries && (error.name === "AuthRetryableFetchError" || error.status === 0)) {
          await this.delay(1.0)
          return this.signIn(retryCount + 1)
        }
        print(`[SupabaseDBManager] Auth failed: ${JSON.stringify(error)}`)
        return false
      }

      if (data?.user?.id) {
        this.uid = JSON.stringify(data.user.id).replace(/^"(.*)"$/, "$1")
        return true
      }
      return false
    } catch (e) {
      if (retryCount < maxRetries) {
        await this.delay(1.0)
        return this.signIn(retryCount + 1)
      }
      print(`[SupabaseDBManager] Auth exception: ${e}`)
      return false
    }
  }

  private async ensureAuth(): Promise<boolean> {
    if (this.uid) return true
    try {
      const { data: { session } } = await this.client.auth.getSession()
      if (session?.user?.id) {
        this.uid = JSON.stringify(session.user.id).replace(/^"(.*)"$/, "$1")
        return true
      }
    } catch (_) {}
    return this.signIn()
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  // Returns the stable Supabase auth UUID for the current user.
  // Tied to their Snap account via OIDC — never changes even if they rename themselves.
  // Returns null if called before authentication completes on start.
  public getUserId(): string | null {
    return this.uid
  }

  // ---------------------------------------------------------------------------
  // STORE — saves a butterfly sighting to Supabase DB + Storage
  // Textures are uploaded as binary JPEGs; only the public URL is stored in the DB row.
  // user_id and snap_display_name are set automatically — do not pass them.
  // ---------------------------------------------------------------------------

  async storeSighting(params: {
    suggestion: Suggestion
    photoTexture: Texture | null
    wingTexture?: Texture | null
    wingOpacityMap?: Texture | null
    wingTextureBase64?: string
    wingOpacityMapBase64?: string
    identifiedAt?: Date
  }): Promise<SightingRecord | null> {
    if (!(await this.ensureAuth())) {
      print("[SupabaseDBManager] storeSighting: not authenticated")
      return null
    }

    const ts = (params.identifiedAt ?? new Date()).toISOString()
    const slug = `${this.uid}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    // Fetch GPS and upload all textures in parallel.
    // Wing textures prefer the raw b64 path to avoid a re-encode round-trip that silently fails
    // for textures decoded via Base64.decodeTextureAsync.
    const [location, photoUrl, wingUrl, wingOpacityUrl] = await Promise.all([
      this.getLocation(),
      params.photoTexture
        ? this.uploadTexture(params.photoTexture, `photos/${slug}_photo.jpg`)
        : Promise.resolve(null),
      params.wingTextureBase64
        ? this.uploadBase64(params.wingTextureBase64, `wings/${slug}_wing.jpg`)
        : params.wingTexture
          ? this.uploadTexture(params.wingTexture, `wings/${slug}_wing.jpg`)
          : Promise.resolve(null),
      params.wingOpacityMapBase64
        ? this.uploadBase64(params.wingOpacityMapBase64, `wings/${slug}_wing_opacity.jpg`)
        : params.wingOpacityMap
          ? this.uploadTexture(params.wingOpacityMap, `wings/${slug}_wing_opacity.jpg`)
          : Promise.resolve(null),
    ])

    const d = params.suggestion.details
    const row = {
      // user_id is omitted — Supabase sets it to auth.uid() via DEFAULT + RLS
      snap_display_name:          this.snapDisplayName,
      latitude:                   location.latitude,
      longitude:                  location.longitude,
      photo_url:                  photoUrl,
      wing_texture_url:           wingUrl,
      wing_opacity_map_url:       wingOpacityUrl,
      identified_at:              ts,
      species_scientific_name:    params.suggestion.name,
      species_common_names:       d.common_names ?? null,
      species_probability:        params.suggestion.probability,
      species_red_list:           d.red_list ?? null,
      species_description:        d.description?.value ?? d.description_gpt ?? null,
      species_danger_description: d.danger_description ?? null,
      species_taxonomy:           d.taxonomy ?? null,
      species_danger:             d.danger ?? null,
      species_role:               d.role ?? null,
      species_image_url:          d.image?.value ?? null,
      species_gbif_id:            d.gbif_id ?? null,
      species_inaturalist_id:     d.inaturalist_id ?? null,
      species_suggestion_raw:     params.suggestion,
      is_new:                     true,
    }

    const { data, error } = await this.client.from(this.TABLE).insert(row).select().single()
    if (error) {
      print(`[SupabaseDBManager] insert error: ${JSON.stringify(error)}`)
      return null
    }
    return data as unknown as SightingRecord
  }

  private getLocation(): Promise<{ latitude: number | null; longitude: number | null }> {
    return new Promise((resolve) => {
      if (!this.locationService) {
        resolve({ latitude: null, longitude: null })
        return
      }
      this.locationService.getCurrentPosition(
        (geoPosition) => resolve({ latitude: geoPosition.latitude, longitude: geoPosition.longitude }),
        (error) => {
          print("[SupabaseDBManager] Location error: " + error)
          resolve({ latitude: null, longitude: null })
        },
      )
    })
  }

  // Texture → PNG base64 → Uint8Array → Storage upload → public URL.
  // Encodes and stores PNG so every upload path produces a consistent format whose
  // content-type and extension match the real bytes — a mismatch makes Lens's loader hang.
  private uploadTexture(texture: Texture, path: string): Promise<string | null> {
    const finalPath = path.replace(/\.[^./]+$/, "") + ".png"
    return new Promise((resolve) => {
      Base64.encodeTextureAsync(
        texture,
        async (b64: string) => {
          try {
            const bytes = this.base64ToUint8Array(b64)

            const { error } = await this.client.storage
              .from(this.storageBucket)
              .upload(finalPath, bytes, { contentType: "image/png", upsert: true })

            if (error) {
              print(`[SupabaseDBManager] storage upload error for ${finalPath}: ${JSON.stringify(error)}`)
              resolve(null)
              return
            }

            const { data } = this.client.storage.from(this.storageBucket).getPublicUrl(finalPath)
            resolve(data?.publicUrl ?? null)
          } catch (e) {
            print(`[SupabaseDBManager] uploadTexture exception: ${e}`)
            resolve(null)
          }
        },
        () => {
          print(`[SupabaseDBManager] Base64.encodeTextureAsync failed for ${finalPath}`)
          resolve(null)
        },
        CompressionQuality.HighQuality,
        EncodingType.Png
      )
    })
  }

  private async uploadBase64(b64: string, path: string): Promise<string | null> {
    try {
      const bytes = this.base64ToUint8Array(b64)
      // The wing edge function returns PNG bytes, so store them as PNG. Callers pass a ".jpg"
      // path out of habit; rewrite it to ".png" so the extension and content-type both match
      // the real data. Serving PNG bytes as image/jpeg makes Lens's loader stall at decode time.
      const finalPath = path.replace(/\.[^./]+$/, "") + ".png"
      const { error } = await this.client.storage
        .from(this.storageBucket)
        .upload(finalPath, bytes, { contentType: "image/png", upsert: true })
      if (error) {
        print(`[SupabaseDBManager] storage upload error for ${finalPath}: ${JSON.stringify(error)}`)
        return null
      }
      const { data } = this.client.storage.from(this.storageBucket).getPublicUrl(finalPath)
      return data?.publicUrl ?? null
    } catch (e) {
      print(`[SupabaseDBManager] uploadBase64 exception: ${e}`)
      return null
    }
  }

  private base64ToUint8Array(b64: string): Uint8Array {
    const data = b64.includes(",") ? b64.split(",")[1] : b64

    // Prefer Lens Studio's native decoder — the hand-rolled fallback below can mangle
    // padding/whitespace and silently produce a corrupt JPEG that later fails to load.
    const nativeBase64 = (global as any).Base64
    if (nativeBase64 && typeof nativeBase64.decode === "function") {
      try {
        const decoded = nativeBase64.decode(data)
        if (decoded && decoded.length > 0) return decoded
      } catch (e) {
        print(`[SupabaseDBManager] native Base64.decode failed, using fallback: ${e}`)
      }
    }

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    const clean = data.replace(/[^A-Za-z0-9+/]/g, "")
    let binary = ""
    let i = 0
    while (i < clean.length) {
      const e1 = chars.indexOf(clean[i++])
      const e2 = chars.indexOf(clean[i++])
      const e3 = chars.indexOf(clean[i++])
      const e4 = chars.indexOf(clean[i++])
      const bmp = (e1 << 18) | (e2 << 12) | (e3 << 6) | e4
      binary += String.fromCharCode((bmp >> 16) & 255)
      if (e3 !== 64) binary += String.fromCharCode((bmp >> 8) & 255)
      if (e4 !== 64) binary += String.fromCharCode(bmp & 255)
    }
    const bytes = new Uint8Array(binary.length)
    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j)
    return bytes
  }

  // ---------------------------------------------------------------------------
  // RETRIEVE — all sightings for the map (skips heavy suggestion blob)
  // ---------------------------------------------------------------------------

  async getAllSightings(): Promise<SightingRecord[]> {
    if (!(await this.ensureAuth())) return []

    const { data, error } = await this.client
      .from(this.TABLE)
      .select(
        "id,user_id,snap_display_name,latitude,longitude,identified_at," +
        "photo_url,species_scientific_name,species_common_names," +
        "species_probability,species_red_list,species_description,species_danger_description," +
        "species_taxonomy,species_danger,species_role,species_image_url," +
        "species_gbif_id,species_inaturalist_id"
      )
      .order("identified_at", { ascending: false })

    if (error) {
      print(`[SupabaseDBManager] getAllSightings error: ${JSON.stringify(error)}`)
      return []
    }
    return data as unknown as SightingRecord[]
  }

  // ---------------------------------------------------------------------------
  // RETRIEVE — sightings within a radius of a given position
  // Uses a lat/lon bounding box on the DB to limit rows, then precise Haversine
  // filtering on the client. Returns results sorted nearest-first.
  // Sightings with null lat/lon are excluded automatically.
  //
  // Usage:
  //   const nearby = await dbManager.getNearbySightings({
  //     latitude: 37.7749, longitude: -122.4194,
  //     radius: 5,                // unit defaults to "miles"; pass unit: "km" to override
  //   })
  //   // nearby[0] is the closest sighting
  // ---------------------------------------------------------------------------

  async getNearbySightings(params: {
    latitude: number
    longitude: number
    radius: number
    unit?: "km" | "miles"  // default: "miles"
    limit?: number          // max results to return after Haversine filtering; default: no limit
  }): Promise<SightingRecord[]> {
    if (!(await this.ensureAuth())) return []

    const { latitude, longitude, radius, unit = "miles", limit } = params
    const radiusKm = unit === "miles" ? radius * 1.60934 : radius

    // Bounding box: 1° lat ≈ 111 km; 1° lon ≈ 111 km * cos(lat)
    const deltaLat = radiusKm / 111
    const deltaLon = radiusKm / (111 * Math.cos(latitude * (Math.PI / 180)))

    const { data, error } = await this.client
      .from(this.TABLE)
      .select(
        "id,user_id,snap_display_name,latitude,longitude,identified_at," +
        "photo_url,species_scientific_name,species_common_names," +
        "species_probability,species_red_list,species_description,species_danger_description," +
        "species_taxonomy,species_danger,species_role,species_image_url," +
        "species_gbif_id,species_inaturalist_id"
      )
      .gte("latitude",  latitude  - deltaLat)
      .lte("latitude",  latitude  + deltaLat)
      .gte("longitude", longitude - deltaLon)
      .lte("longitude", longitude + deltaLon)
      .not("latitude",  "is", null)
      .not("longitude", "is", null)
      .order("identified_at", { ascending: false })

    if (error) {
      print(`[SupabaseDBManager] getNearbySightings error: ${JSON.stringify(error)}`)
      return []
    }

    const toRad = (deg: number) => deg * (Math.PI / 180)
    const earthR = 6371 // km

    return (data as unknown as SightingRecord[])
      .map((r) => {
        const lat2 = r.latitude as number
        const lon2 = r.longitude as number
        const dLat = toRad(lat2 - latitude)
        const dLon = toRad(lon2 - longitude)
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(latitude)) * Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2)
        const distKm = earthR * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return { r, distKm }
      })
      .filter(({ distKm }) => distKm <= radiusKm)
      .sort((a, b) => a.distKm - b.distKm)
      .slice(0, limit ?? undefined)
      .map(({ r }) => r)
  }

  // ---------------------------------------------------------------------------
  // RETRIEVE — current user's sightings (filtered by stable auth uid)
  // ---------------------------------------------------------------------------

  async getMySightings(): Promise<SightingRecord[]> {
    if (!(await this.ensureAuth())) return []

    const { data, error } = await this.client
      .from(this.TABLE)
      .select("*")
      .eq("user_id", this.uid)
      .order("identified_at", { ascending: false })

    if (error) {
      print(`[SupabaseDBManager] getMySightings error: ${JSON.stringify(error)}`)
      return []
    }

    const records = data as unknown as SightingRecord[]

    const newIds = records.filter((r) => r.is_new).map((r) => r.id)
    if (newIds.length > 0) {
      const { error: updateError } = await this.client
        .from(this.TABLE)
        .update({ is_new: false })
        .in("id", newIds)
      if (updateError) {
        print(`[SupabaseDBManager] getMySightings update is_new error: ${JSON.stringify(updateError)}`)
      }
    }

    // Load wing textures in small batches rather than all at once. Firing 20+ large remote
    // image loads simultaneously contends the engine's remote_assets_cache and produces a
    // transient "Cannot read file: .../remote_assets_cache/<hash>" error on a random asset.
    const BATCH_SIZE = 3
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map(async (r) => {
          r.wing_texture = await this.loadTextureFromUrl(r.wing_texture_url)
          r.wing_opacity_map = await this.loadTextureFromUrl(r.wing_opacity_map_url)
        })
      )
    }

    return records
  }

  private loadTextureFromUrl(url: string | null): Promise<Texture | null> {
    if (!url) return Promise.resolve(null)
    print(`[SupabaseDBManager] loadTextureFromUrl loading: ${url}`)
    return new Promise((resolve) => {
      const resource = internetModule.makeResourceFromUrl(url)
      this.remoteMediaModule.loadResourceAsImageTexture(
        resource,
        (texture: Texture) => resolve(texture),
        (errorMsg: string) => {
          // "Cannot read file: .../remote_assets_cache/<hash>" means the URL was reached but the
          // body was not a decodable image — usually a private-bucket 403/JSON body or a corrupt
          // upload. The card still renders without its wing texture; we just skip it.
          print(`[SupabaseDBManager] loadTextureFromUrl failed for ${url}: ${errorMsg}`)
          resolve(null)
        }
      )
    })
  }

  // ---------------------------------------------------------------------------
  // DEV — insert the 5 simulated sightings from SimulatedData.ts
  // Idempotent per user: skips insertion if simulated rows already exist for
  // the current user_id, so each teammate gets their own copy exactly once.
  // ---------------------------------------------------------------------------

  async seedTestData(): Promise<void> {
    if (!(await this.ensureAuth())) {
      print("[SupabaseDBManager] seedTestData: not authenticated")
      return
    }

    const { data: existing } = await this.client
      .from(this.TABLE)
      .select("id")
      .eq("user_id", this.uid)
      .limit(SIMULATED_SIGHTINGS.length)

    if (existing && existing.length >= SIMULATED_SIGHTINGS.length) {
      print("[SupabaseDBManager] seedTestData: user already has sightings, skipping")
      return
    }

    const rows = SIMULATED_SIGHTINGS.map((s) => ({ ...s, snap_display_name: this.snapDisplayName }))
    const { error } = await this.client.from(this.TABLE).insert(rows)
    if (error) {
      print(`[SupabaseDBManager] seedTestData error: ${JSON.stringify(error)}`)
    } else {
      print("[SupabaseDBManager] seedTestData: inserted 5 simulated sightings")
    }
  }

  // ---------------------------------------------------------------------------
  // UTIL
  // ---------------------------------------------------------------------------

  onDestroy() {
    if (this.client) this.client.removeAllChannels()
  }

  private delay(seconds: number): Promise<void> {
    return new Promise((resolve) => {
      const ev = this.createEvent("DelayedCallbackEvent")
      ev.bind(() => resolve())
      ev.reset(seconds)
    })
  }
}
