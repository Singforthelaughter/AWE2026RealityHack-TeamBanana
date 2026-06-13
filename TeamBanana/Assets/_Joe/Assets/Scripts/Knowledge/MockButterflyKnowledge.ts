/**
 * Mock butterfly knowledge base for agent system
 * Provides species information, fascinating facts, and stories
 * Used until real knowledge bases are integrated
 */

export interface ButterflySpecies {
  name: string // Common name
  scientificName: string
  family: string
  shortDescription: string
  fascinatingFacts: string[]
  lifeCycle: {
    stages: string[]
    hostPlants: string[]
    generationsPerYear: number
  }
  conservationStatus: string
  range: string
  flightSeason: string
  migration: boolean
  stories: string[]
}

/**
 * Mock knowledge base with butterfly species data
 */
export class MockButterflyKnowledge {
  private speciesDatabase: Map<string, ButterflySpecies> = new Map()

  constructor() {
    this.initializeSpecies()
    print("MockButterflyKnowledge: Database initialized with butterfly species")
  }

  /**
   * Initialize species database with common butterflies
   */
  private initializeSpecies(): void {
    // Monarch Butterfly
    this.addSpecies({
      name: "Monarch",
      scientificName: "Danaus plexippus",
      family: "Nymphalidae",
      shortDescription:
        "Famous for incredible 3,000 mile migration across North America. Distinctive orange wings with black veins and white spots.",
      fascinatingFacts: [
        "Monarchs have never made their migration journey before - it's their grandchildren who return to same mountains their ancestors left generations ago!",
        "They taste terrible to predators because of toxins accumulated from milkweed plants as caterpillars.",
        "Monarchs can navigate using Earth's magnetic field and the sun's position.",
        "A single Monarch butterfly can travel up to 100 miles in a day.",
        "During migration, millions of Monarchs can cluster in just a few acres of forest in Mexico."
      ],
      lifeCycle: {
        stages: ["egg", "caterpillar", "chrysallis (pupa)", "adult butterfly"],
        hostPlants: ["milkweed (various Asclepias species)"],
        generationsPerYear: 3
      },
      conservationStatus: "Near Threatened (IUCN)",
      range: "North America, from Canada to Mexico",
      flightSeason: "May to September in north, December to February in south",
      migration: true,
      stories: [
        "In 2009, millions of Monarchs died in Mexico due to severe storms. Scientists tracked the recovery and found populations bounced back, showing their remarkable resilience.",
        "Monarchs use the same exact wintering sites in Mexico for years - trees where their great-grandparents slept, now used by their great-grandchildren.",
        "Native peoples of Mexico have celebrated Monarch arrival for centuries, believing the butterflies carry spirits of ancestors returning for Day of Dead."
      ]
    })

    // Painted Lady Butterfly
    this.addSpecies({
      name: "Painted Lady",
      scientificName: "Vanessa cardui",
      family: "Nymphalidae",
      shortDescription:
        "One of the most widespread butterflies, found worldwide. Orange wings with black and white patterns, bright spots on hind wings.",
      fascinatingFacts: [
        "Painted Ladies can be found on every continent except Antarctica and South America.",
        "They can fly thousands of miles across oceans and have even been spotted in remote islands.",
        "They can produce up to four generations per year in favorable climates.",
        "Painted Ladies can enter a state of diapause (similar to hibernation) during winter.",
        "They're named for their resemblance to the 'painted ladies' of royal courts in historical Europe."
      ],
      lifeCycle: {
        stages: ["egg", "caterpillar", "chrysallis", "adult butterfly"],
        hostPlants: ["thistles", "mallows", "nettles", "legumes"],
        generationsPerYear: 4
      },
      conservationStatus: "Least Concern",
      range: "Worldwide except polar regions",
      flightSeason: "Spring through fall, multiple generations",
      migration: true,
      stories: [
        "Painted Ladies were studied extensively by early naturalists who used them to understand butterfly migration patterns long before modern tracking methods.",
        "Some Painted Ladies in Europe migrate to North Africa and back - a journey that was unknown until butterfly tagging technology revealed it.",
        "Their caterpillars build unique 'tents' from leaves to protect themselves during development."
      ]
    })

    // Eastern Tiger Swallowtail
    this.addSpecies({
      name: "Eastern Tiger Swallowtail",
      scientificName: "Papilio glaucus",
      family: "Papilionidae",
      shortDescription:
        "Large, beautiful butterfly with yellow and black stripes, tiger-like pattern. Blue and orange spots on hind wings, distinctive 'tails' on wing tips.",
      fascinatingFacts: [
        "Tiger Swallowtails are the largest butterflies in North America with a wingspan up to 5.5 inches.",
        "Their caterpillars have false eyespots to scare away predators, though the real butterfly doesn't have eyes.",
        "They're named 'swallowtails' because their hind wing projections resemble a swallow bird's forked tail.",
        "Some populations mimic toxic pipevine swallowtails for protection from predators.",
        "Male and female Tiger Swallowtails can look different - females sometimes have dark morphs for winter camouflage."
      ],
      lifeCycle: {
        stages: ["egg", "caterpillar", "chrysallis", "adult butterfly"],
        hostPlants: ["wild cherry", "ash", "tulip tree", "willow"],
        generationsPerYear: 2
      },
      conservationStatus: "Least Concern",
      range: "Eastern North America",
      flightSeason: "May to September, with partial second generation in south",
      migration: false,
      stories: [
        "Tiger Swallowtail caterpillars are green and brown with realistic eyespots - when they're small, they look like bird droppings to avoid being eaten!",
        "Their chrysallides can be green or brown, blending perfectly with tree bark or leaves as they transform.",
        "Early naturalists thought the different color forms were separate species until they observed them emerging from same chrysallides."
      ]
    })

    // Black Swallowtail
    this.addSpecies({
      name: "Black Swallowtail",
      scientificName: "Papilio polyxenes",
      family: "Papilionidae",
      shortDescription:
        "Striking black butterfly with iridescent blue and green on hind wings. Females are black with blue patches, males have more extensive blue coloring.",
      fascinatingFacts: [
        "Black Swallowtails are one of the few butterflies that visit flowers for nectar instead of puddling.",
        "Their caterpillars are green with fake eyespots and are found on spicebush (Piper) plants.",
        "Females are larger and less colorful than males - a pattern called sexual dimorphism.",
        "They're highly sought after by butterfly enthusiasts for their iridescent coloring.",
        "Their chrysallides are brown and green, perfectly camouflaged against branches and bark."
      ],
      lifeCycle: {
        stages: ["egg", "caterpillar", "chrysallis", "adult butterfly"],
        hostPlants: ["spicebush (Piper)"],
        generationsPerYear: 2
      },
      conservationStatus: "Least Concern",
      range: "Eastern and southern North America, into Central America",
      flightSeason: "April to October, sometimes into November",
      migration: false,
      stories: [
        "Black Swallowtail caterpillars are master mimics - their fake eyespots are so convincing they can scare birds away.",
        "The iridescent blue color on their wings isn't pigment - it's created by microscopic scales that reflect light in specific ways.",
        "In some regions, Black Swallowtails have declined due to loss of spicebush habitat from development."
      ]
    })

    // Cloudless Sulphur
    this.addSpecies({
      name: "Cloudless Sulphur",
      scientificName: "Phoebis sennae",
      family: "Pieridae",
      shortDescription:
        "Medium-sized sulphur with mostly yellow wings. Males have bright yellow with black borders, females are paler yellow with more black.",
      fascinatingFacts: [
        "Cloudless Sulphurs are one of the most common butterflies in eastern North America.",
        "They're migratory and sometimes fly in large groups, filling the sky with yellow.",
        "Caterpillars feed on clover and alfalfa, making them beneficial to agriculture.",
        "Males are territorial and will chase other butterflies away from their chosen perches.",
        "They're named 'cloudless' because they lack the dark clouding patterns seen in some other sulphur species."
      ],
      lifeCycle: {
        stages: ["egg", "caterpillar", "chrysallis", "adult butterfly"],
        hostPlants: ["clover", "alfalfa", "legumes"],
        generationsPerYear: 3
      },
      conservationStatus: "Least Concern",
      range: "Eastern North America, some migration to south",
      flightSeason: "Multiple generations spring through fall",
      migration: true,
      stories: [
        "Cloudless Sulphur migrations can be spectacular, with millions filling the sky during peak migration days.",
        "Their caterpillars are green with thin yellow stripes and feed at night to avoid bird predation.",
        "Native peoples considered sulphurs signs of good harvests because their caterpillars indicate healthy clover populations."
      ]
    })

    // Red Admiral
    this.addSpecies({
      name: "Red Admiral",
      scientificName: "Vanessa atalanta",
      family: "Nymphalidae",
      shortDescription:
        "Medium-sized butterfly with striking red bands on dark wings. Black and white patterns create a dramatic, butterfly-like appearance.",
      fascinatingFacts: [
        "Red Admirals are fast, powerful fliers and can be territorial.",
        "They feed on tree sap, rotting fruit, and flower nectar - one of the few butterflies that don't exclusively feed on nectar.",
        "Their caterpillars build communal nests by spinning silk around leaves.",
        "Red Admirals can hibernate as adults in sheltered locations, emerging on warm winter days.",
        "They're named for their red bands that resemble military admirals' uniforms."
      ],
      lifeCycle: {
        stages: ["egg", "caterpillar", "chrysallis", "adult butterfly"],
        hostPlants: ["nettle", "hop"],
        generationsPerYear: 2
      },
      conservationStatus: "Least Concern",
      range: "North America, Europe, Asia",
      flightSeason: "Spring through fall, hibernates as adult in winter",
      migration: false,
      stories: [
        "Red Admiral caterpillars living in silk nests is unique among butterflies and provides protection from predators.",
        "In autumn, Red Admirals sometimes gather on tree trunks to hibernate, creating clusters of butterflies.",
        "They're one of the few butterflies that can be seen flying in winter on sunny days when they emerge from hibernation."
      ]
    })

    // Viceroy
    this.addSpecies({
      name: "Viceroy",
      scientificName: "Limenitis archippus",
      family: "Nymphalidae",
      shortDescription:
        "Large butterfly with orange and black wings, patterned like a stained glass window. Similar to Monarch but lacks white spots on black borders.",
      fascinatingFacts: [
        "Viceroys are named after British viceroys, hence their regal appearance.",
        "Their caterpillars feed on willow trees and create distinctive shelters by rolling and tying leaves together.",
        "Viceroys in Europe have declined significantly due to habitat loss and climate change.",
        "They're one of the few butterflies that can be active in winter in southern regions.",
        "The stained-glass wing patterns help them blend into dappled light and shadow in forests."
      ],
      // Fix: Duplicate property
      lifeCycle: {
        stages: ["egg", "caterpillar", "chrysallis", "adult butterfly"],
        hostPlants: ["willow", "aspen", "poplar"],
        generationsPerYear: 2
      },
      conservationStatus: "Near Threatened (in parts of range)",
      range: "Europe, Asia, North America",
      flightSeason: "June to September in north, year-round in south",
      migration: true,
      stories: [
        "Viceroy caterpillars are architectural masters - they create elaborate shelters by tying leaves together with silk.",
        "In medieval times, Viceroys were believed to be spirits of the forest by some European cultures.",
        "Climate change has disrupted Viceroy timing, with butterflies emerging before their host plants are available."
      ]
    })
  }

  /**
   * Add a species to the database
   */
  private addSpecies(species: ButterflySpecies): void {
    const keys = [species.name.toLowerCase(), species.scientificName.toLowerCase()]
    keys.forEach((key) => {
      this.speciesDatabase.set(key, species)
    })
  }

  /**
   * Get species information
   */
  public getSpeciesInfo(speciesName: string): ButterflySpecies | null {
    const key = speciesName.toLowerCase()
    return this.speciesDatabase.get(key) || null
  }

  /**
   * Get all species names
   */
  public getAllSpeciesNames(): string[] {
    const species = Array.from(this.speciesDatabase.values())
    const uniqueSpecies = new Map<string, boolean>()

    species.forEach((s) => {
      uniqueSpecies.set(s.name, true)
    })

    return Array.from(uniqueSpecies.keys())
  }

  /**
   * Search for species by description or characteristics
   */
  public searchSpecies(searchTerm: string): ButterflySpecies[] {
    const lowerSearch = searchTerm.toLowerCase()
    const results: ButterflySpecies[] = []

    this.speciesDatabase.forEach((species) => {
      if (
        species.name.toLowerCase().includes(lowerSearch) ||
        species.shortDescription.toLowerCase().includes(lowerSearch) ||
        species.family.toLowerCase().includes(lowerSearch)
      ) {
        results.push(species)
      }
    })

    return results
  }

  /**
   * Identify species mentioned in a query
   */
  public identifySpeciesInQuery(query: string): string | null {
    const lowerQuery = query.toLowerCase()

    for (const [key, species] of this.speciesDatabase) {
      if (lowerQuery.includes(species.name.toLowerCase()) || lowerQuery.includes(species.scientificName.toLowerCase())) {
        return species.name
      }
    }

    return null
  }

  /**
   * Get fascinating facts about butterflies
   */
  public getRandomFascinatingFacts(count: number = 3): string[] {
    const allFacts: string[] = []

    this.speciesDatabase.forEach((species) => {
      allFacts.push(...species.fascinatingFacts)
    })

    // Shuffle array
    const shuffled = allFacts.sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }

  /**
   * Get species by migration status
   */
  public getMigratorySpecies(): ButterflySpecies[] {
    const migratorySpecies: ButterflySpecies[] = []

    this.speciesDatabase.forEach((species) => {
      if (species.migration) {
        migratorySpecies.push(species)
      }
    })

    return migratorySpecies
  }

  /**
   * Get species by conservation status
   */
  public getSpeciesByConservationStatus(status: string): ButterflySpecies[] {
    const matchingSpecies: ButterflySpecies[] = []

    this.speciesDatabase.forEach((species) => {
      if (species.conservationStatus.toLowerCase().includes(status.toLowerCase())) {
        matchingSpecies.push(species)
      }
    })

    return matchingSpecies
  }

  /**
   * Get habitat information (simplified for mock)
   */
  public getHabitatInfo(locationType: string): {
    commonSpecies: string[]
    plants: string[]
    seasonalPatterns: string
  } {
    // Simplified habitat responses based on location type
    const habitats: Record<
      string,
      {
        commonSpecies: string[]
        plants: string[]
        seasonalPatterns: string
      }
    > = {
      meadow: {
        commonSpecies: ["Cloudless Sulphur", "Painted Lady", "Black Swallowtail"],
        plants: ["clover", "wild flowers", "grasses"],
        seasonalPatterns: "Spring through fall activity, multiple generations"
      },
      forest: {
        commonSpecies: ["Eastern Tiger Swallowtail", "Red Admiral", "Viceroy"],
        plants: ["willow", "ash", "wild cherry", "nettle"],
        seasonalPatterns: "Summer peak, some species hibernate in winter"
      },
      garden: {
        commonSpecies: ["Painted Lady", "Cloudless Sulphur", "Red Admiral"],
        plants: ["butterfly bush", "cone flowers", "annual flowers"],
        seasonalPatterns: "Continuous activity through growing season"
      },
      wetland: {
        commonSpecies: ["Viceroy", "Painted Lady"],
        plants: ["milkweed", "swamp milkweed", "buttonbush"],
        seasonalPatterns: "Summer peak, depends on plant availability"
      }
    }

    return habitats[locationType as keyof typeof habitats] || {
      commonSpecies: ["Painted Lady", "Cloudless Sulphur"],
      plants: ["various flowers and weeds"],
      seasonalPatterns: "Spring through fall activity"
    }
  }

  /**
   * Get conservation stories (success and concern)
   */
  public getConservationStories(): {
    successStories: string[]
    concernStories: string[]
  } {
    const successStories = [
      "Monarch populations have shown remarkable resilience, recovering from devastating storms in their wintering grounds.",
      "Protected habitat areas have helped recover declining species like Viceroy in parts of their range.",
      "Community butterfly gardens have created corridors connecting fragmented habitats."
    ]

    const concernStories = [
      "Climate change is causing some species to emerge before their host plants are available.",
      "Habitat loss from development has reduced populations of many common butterfly species.",
      "Pesticide use affects both butterflies and their essential host plants.",
      "Light pollution at night disrupts butterfly orientation during migration."
    ]

    return {successStories, concernStories}
  }
}
