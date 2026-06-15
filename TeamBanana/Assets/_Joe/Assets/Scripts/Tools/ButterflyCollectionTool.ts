import {SupabaseDBManager} from "_Boon/SupabaseInfoStoring&Retrieving/Scripts/SupabaseDBManager"
import {FlyingButterflyManager} from "_Boon/ButterflyMovement/Scripts/FlyingButterflyManager"

/**
 * ButterflyCollectionTool — surfaces the user's butterfly collection.
 *
 * "show me my butterfly collection" triggers this tool, which:
 * 1. Fetches all the current user's sightings from Supabase
 * 2. Spawns a 3D animated butterfly for each sighting (with wing textures)
 * 3. Returns a natural-language summary for the agent to speak
 */
export class ButterflyCollectionTool {
  public readonly name = "butterfly_collection"
  public readonly description =
    "Show the user's personal butterfly collection — every butterfly they've identified and saved. Spawns 3D butterflies with real wing textures."

  public readonly parameters = {
    type: "object",
    properties: {
      maxButterflies: {
        type: "number",
        description: "Maximum butterflies to spawn (default 10, to avoid overwhelming)",
        default: 10
      }
    },
    required: []
  }

  private dbManager: SupabaseDBManager
  private flyingButterflyManager: FlyingButterflyManager | null

  constructor(dbManager: SupabaseDBManager, flyingButterflyManager?: FlyingButterflyManager) {
    this.dbManager = dbManager
    this.flyingButterflyManager = flyingButterflyManager ?? null
    print("ButterflyCollectionTool: Initialized")
  }

  public async execute(args: Record<string, unknown>): Promise<{
    success: boolean
    result?: any
    error?: string
    executionTime: number
  }> {
    const startTime = Date.now()
    try {
      const maxButterflies = (args.maxButterflies as number) ?? 10

      print(`ButterflyCollectionTool: Fetching user's sightings...`)

      const sightings = await this.dbManager.getMySightings()

      if (!sightings || sightings.length === 0) {
        return {
          success: true,
          result: {
            count: 0,
            message: "You haven't collected any butterflies yet. Try identifying one — just look at a butterfly and ask me 'what is this?'"
          },
          executionTime: Date.now() - startTime
        }
      }

      // Spawn butterflies for each sighting (capped)
      const spawnCount = Math.min(sightings.length, maxButterflies)
      let spawnedCount = 0
      const speciesList: string[] = []

      if (this.flyingButterflyManager) {
        for (let i = 0; i < spawnCount; i++) {
          const s = sightings[i]
          const wingTexture = s.wing_texture ?? null
          const opacityTexture = s.wing_opacity_map ?? null

          const controller = this.flyingButterflyManager.spawnButterfly(wingTexture, opacityTexture)
          if (controller) {
            spawnedCount++
          }

          const name = s.species_common_names?.[0] ?? s.species_scientific_name ?? "Unknown butterfly"
          if (!speciesList.includes(name)) {
            speciesList.push(name)
          }
        }
      } else {
        // No FlyingButterflyManager wired — still list what's in the collection
        for (let i = 0; i < spawnCount; i++) {
          const s = sightings[i]
          const name = s.species_common_names?.[0] ?? s.species_scientific_name ?? "Unknown butterfly"
          if (!speciesList.includes(name)) {
            speciesList.push(name)
          }
        }
      }

      const message = this.buildCollectionMessage({
        total: sightings.length,
        spawned: spawnedCount,
        species: speciesList
      })

      print(`ButterflyCollectionTool: ${spawnedCount} butterflies spawned, ${sightings.length} in collection`)

      return {
        success: true,
        result: {
          count: sightings.length,
          spawned: spawnedCount,
          species: speciesList,
          message
        },
        executionTime: Date.now() - startTime
      }
    } catch (error) {
      print(`ButterflyCollectionTool: ERROR — ${error}`)
      return {
        success: false,
        error: `Failed to load collection: ${error}`,
        executionTime: Date.now() - startTime
      }
    }
  }

  /** Hide all spawned collection butterflies. */
  public clearButterflies(): boolean {
    if (!this.flyingButterflyManager) return false
    this.flyingButterflyManager.clearAllButterflies()
    return true
  }

  private buildCollectionMessage(opts: {total: number; spawned: number; species: string[]}): string {
    if (opts.total === 0) {
      return "Your collection is empty. Go find some butterflies!"
    }

    const speciesText = opts.species.length > 0
      ? ` — ${opts.species.join(", ")}`
      : ""

    if (opts.spawned > 0) {
      return `You've collected ${opts.total} butterfly sighting${opts.total > 1 ? "s" : ""}${speciesText}. I've brought ${opts.spawned} to life around you — reach out your finger and they might land on it!`
    }

    return `You've collected ${opts.total} butterfly sighting${opts.total > 1 ? "s" : ""}${speciesText}. Tap on any to see more details.`
  }
}
