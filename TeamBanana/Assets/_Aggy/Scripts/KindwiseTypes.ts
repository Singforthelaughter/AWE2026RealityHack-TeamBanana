/**
 * KindwiseTypes — TypeScript types for the Kindwise insect.id identification response.
 *
 * This is the shape returned by the Supabase Edge Function (which proxies Kindwise). The lens parses
 * the response as `IDResponse`. These types were verified against a real Kindwise response, so they
 * match the live API (model_version insect_id:2.0.0).
 *
 * The detail fields you actually get back depend on the `details=` query param the Edge Function
 * sends. Fields you didn't request are simply absent (that's why most detail fields are optional).
 */

/** Scientific classification. Higher ranks may be null. */
export type Taxonomy = {
  kingdom: string | null
  phylum: string | null
  class: string | null
  order: string | null
  family: string | null
  genus: string | null
}

/** A licensed text block (e.g. a Wikipedia description). Cite the source if you display it. */
export type LicensedText = {
  value: string
  citation: string | null
  license_name: string | null
  license_url: string | null
}

/** A licensed image (`value` is the image URL). Cite the source if you display it. */
export type LicensedImage = {
  value: string
  citation: string | null
  license_name: string | null
  license_url: string | null
}

/** A representative image the model picked as visually similar to the input. */
export type SimilarImage = {
  id: string
  url: string
  url_small?: string
  similarity: number // 0-1
  license_name?: string
  license_url?: string
  citation?: string
}

/** The fixed set of "danger" tags Kindwise can return for an insect. */
export type DangerTag =
  | "harmless to human health"
  | "bites or stings"
  | "bites pets"
  | "disease transmission"
  | "rash or skin irritation"
  | "allergenic"
  | "non-venomous"
  | "mildly venomous"
  | "highly venomous"

/** The fixed set of ecological "role" tags Kindwise can return. */
export type RoleTag = "beneficial" | "pollinator" | "agriculture or garden pest" | "household pest" | "wood destroying"

/**
 * Extra info about a suggested species. Every field is optional because it's only present if
 * requested except for language and entity_id, which are always present in response -- default for language='en' (and field is `null` if Kindwise has no data for that taxon).
 * The Edge Function on Supabase requests all of the optional details.
 */
export type SuggestionDetails = {
  common_names?: string[] | null
  url?: string | null
  description?: LicensedText | null
  description_gpt?: string | null
  description_all?: LicensedText | null // combined Wikipedia + GPT description
  taxonomy?: Taxonomy | null
  rank?: string | null // e.g. "species"
  gbif_id?: number | null // id in the GBIF database
  inaturalist_id?: number | null // id in the iNaturalist database
  image?: LicensedImage | null
  images?: LicensedImage[] | null
  red_list?: string | null // IUCN conservation status, e.g. "LEAST_CONCERN"
  synonyms?: string[] | null
  danger?: DangerTag[] | null
  danger_description?: string | null
  role?: RoleTag[] | null
  language?: string // language of the localized text, e.g. "en"
  entity_id?: string
  // Escape hatch: any field Kindwise adds/renames is still accessible without a type error.
  [key: string]: any
}

/** One species (or higher-rank) suggestion, best first. */
export type Suggestion = {
  id: string
  name: string // scientific name, e.g. "Danaus plexippus"
  probability: number // confidence 0-1
  similar_images?: SimilarImage[]
  details: SuggestionDetails
}

export type Classification = {
  suggestions: Suggestion[] // ordered best-first; [0] is the top guess
}

/** Whether the model thinks the image even contains an insect. */
export type IsInsect = {
  binary: boolean // false => probably not an insect
  threshold: number
  probability: number
}

export type IdentificationResult = {
  classification: Classification
  is_insect: IsInsect
}

export type SuggestionFilter = {
  classification: string // e.g. "lepidoptera" to restrict to butterflies/moths
}

/** Echo of the request inputs Kindwise received. */
export type IdentificationInput = {
  images: string[]
  latitude?: number | null
  longitude?: number | null
  suggestion_filter?: SuggestionFilter
  similar_images?: boolean
  datetime?: string
  custom_id?: number | null
}

/**
 * The full identification response. Top guess is:
 *   response.result.classification.suggestions[0]
 */
export type IDResponse = {
  access_token: string // unique id for this identification (can re-fetch results)
  model_version: string
  custom_id: number | null
  input: IdentificationInput
  result: IdentificationResult
  status: string // e.g. "COMPLETED"
  sla_compliant_client: boolean
  sla_compliant_system: boolean
  created: number
  completed: number
}
