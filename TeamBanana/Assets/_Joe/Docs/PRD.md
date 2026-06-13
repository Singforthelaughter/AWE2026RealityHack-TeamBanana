# Butterfly Outdoor Education System - Product Requirements Document

## Executive Summary

An immersive outdoor education platform featuring two specialized AI agents that collaborate to help users discover and learn about butterflies in their natural environment. The system builds upon the existing Agentic Playground architecture: AgentOrchestrator, ToolRouter, AgentToolExecutor, and AgentLanguageInterface.

### Core Value Proposition
Transform passive observation into active discovery through collaborative AI guidance, making butterfly observation accessible, educational, and engaging for learners of all levels.

---

## 1. System Overview

### 1.1 Architecture Context
This system extends the existing Agentic Playground framework with:

- **AgentOrchestrator**: Central coordinator managing query flow and agent coordination
- **AgentLanguageInterface**: Unified OpenAI/Gemini provider abstraction
- **ToolRouter**: AI-powered routing between specialized tools
- **AgentToolExecutor**: Runtime validation and tool execution
- **StorageManager**: Persistent conversation and discovery history

### 1.2 Agent Architecture
Two complementary agents with distinct personalities and expertise:

| Agent | Role | Tone | Primary Tools | Knowledge Sources |
|--------|------|-------|---------------|------------------|
| **Naturalist** | Discovery guide | Gentle Socratic | Spatial, GeneralConversation, ButterflySpotter | iNaturalist, eButterfly.org, Conservation DBs |
| **Archivist** | Knowledge curator | Enthusiastic storyteller | Spatial, GeneralConversation, ButterflyKnowledge | Species databases, ecosystem models |

### 1.3 Interaction Model
**Collaborative Dialogue Pattern:**
- Naturalist initiates discovery through Socratic questioning
- Archivist enriches with facts, stories, and species identification
- Both agents can reference each other's contributions
- Users can explicitly switch between agents or let the router decide

---

## 2. Agent Specifications

### 2.1 Naturalist Agent

#### Personality & Tone
```
Voice: Gentle, patient, encouraging
Teaching Style: Socratic - asks questions rather than lecturing
Philosophy: "I help you discover, you make the connections"
Language Pattern: "What do you notice?", "Have you seen...?", "How might...?"
Discovery Focus: Observation, patterns, ecology, behavior
```

#### Core Responsibilities

1. **Guided Discovery**
   - Prompts user to observe specific butterfly behaviors
   - Directs attention to habitat features that affect butterfly presence
   - Asks Socratic questions about wing patterns, flight behavior, plant interactions
   - Encourages user to make connections between observations and concepts

2. **Ecological Context**
   - Explains relationships between butterflies and their environment
   - Highlights host plants, nectar sources, microhabitats
   - Discusses seasonal patterns and migration behaviors
   - Connects local observations to broader ecological principles

3. **Butterfly Behavior Coaching**
   - Teaches observation techniques for different behaviors
   - Explains mating displays, territorial behavior, feeding patterns
   - Guides users to recognize behavior patterns they might otherwise miss

#### Available Tools

| Tool | Purpose | Usage Pattern |
|-------|---------|----------------|
| **SpatialTool** | Understand current outdoor environment | Continuous environmental awareness during discovery sessions |
| **GeneralConversationTool** | Handle non-butterfly outdoor questions | Fallback for broader naturalist inquiries |
| **ButterflySpotter** (Future) | Detect and identify butterflies | Image-based species identification via camera |
| **HabitatAnalyzer** (Future) | Analyze habitat characteristics | Location-based species probability assessment |

#### Knowledge Sources
- **iNaturalist API**: Real-time observation data, species occurrence maps
- **eButterfly.org**: Life cycle data, distribution maps, flight season information
- **Butterfly Conservation databases**: Conservation status, endangered species, habitat requirements

#### Example Interactions
```
User: "What kind of butterflies should I look for here?"
Naturalist: "What kind of plants do you see around you? Are there any flowering
plants or tall grasses? Butterflies often have favorite spots they return to."

User: "I see some purple flowers and tall grass"
Naturalist: "That's a great start! Purple flowers might attract different species than
white or yellow ones. Can you notice any differences in how the butterflies move?
Some flutter rapidly, others glide more smoothly. What patterns do you observe?"
```

---

### 2.2 Archivist Agent

#### Personality & Tone
```
Voice: Enthusiastic, knowledgeable, passionate
Teaching Style: Storyteller - brings facts to life through narrative
Philosophy: "Every butterfly has a story to tell"
Language Pattern: "Did you know...?", "What's fascinating about...", "Here's something amazing..."
Knowledge Focus: Species identification, life cycles, historical context
```

#### Core Responsibilities

1. **Species Identification**
   - Provides detailed species information when butterflies are observed
   - Explains distinguishing features, range, and habitat preferences
   - Shares conservation status and interesting facts

2. **Ecological Knowledge**
   - Deep expertise in butterfly ecosystems and food webs
   - Explains species interactions and ecological roles
   - Discusses evolutionary adaptations and survival strategies

3. **Storytelling & Curiosity**
   - Shares fascinating stories about butterfly species
   - Connects observations to historical, scientific, or cultural context
   - Piques curiosity through unexpected facts and connections

#### Available Tools

| Tool | Purpose | Usage Pattern |
|-------|---------|----------------|
| **SpatialTool** | Contextualize observations in environment | Enhances identification with habitat data |
| **GeneralConversationTool** | Handle general queries | Fallback for broader educational questions |
| **ButterflyKnowledge** (Future) | Species database queries | Detailed taxonomy, life history, range data |
| **EcosystemExplorer** (Future) | Explore ecological relationships | Food web visualization, host plant connections |

#### Knowledge Sources
- **Comprehensive species databases**: Global butterfly taxonomy and distribution
- **Life history databases**: Host plant relationships, development stages
- **Research publications**: Recent findings in butterfly ecology and conservation
- **Natural history collections**: Historical range data, phenology records

#### Example Interactions
```
User: "I think I see a Monarch butterfly"
Archivist: "That's a wonderful find! Monarchs are famous for their incredible
migration - some travel up to 3,000 miles from Canada to Mexico. What's
amazing is that they've never made this journey before - it's their grandchildren
who return to the same mountains their great-grandparents left! Did you notice
if it had any distinct orange wing patterns?"

User: "Yes, it had black veins on the orange parts"
Archivist: "Perfect! Those black veins are one of the Monarch's signature features.
They're not just for show - the pattern tells predators 'I taste terrible!'
Monarchs accumulate toxins from milkweed plants they eat as caterpillars. Would
you like to know what plants Monarchs need to complete their life cycle?"
```

---

## 3. Tool Architecture

### 3.1 Existing Tools (Enhanced)

#### SpatialTool
**Purpose**: Outdoor environment understanding

**Enhanced Capabilities**:
- Butterfly habitat analysis (plant identification, microclimate assessment)
- Environmental conditions (sunlight, wind, temperature patterns)
- Species probability scoring based on current location

**Updated Parameters**:
```typescript
{
  query: string,
  context: array,
  enableImageInput: boolean,
  butterflyHabitatFocus: boolean,  // NEW
  environmentalConditions: {         // NEW
    sunlight: "direct" | "filtered" | "shade",
    temperature: number,
    windLevel: "calm" | "moderate" | "windy"
  }
}
```

#### GeneralConversationTool
**Purpose**: Fallback for non-specialized queries

**Enhanced Capabilities**:
- Context-aware responses based on current agent (Naturalist vs. Archivist)
- Outdoor education context when appropriate
- Agent personality consistency across all responses

### 3.2 Environment Tools (Implemented)

#### LocationTool
**Purpose**: GPS location services using Spectacles LocationService

**Implementation**: Uses Spectacles `LocationService` API for real-time location data

**Parameters**:
```typescript
{
  // No parameters - auto-fetches from Spectacles
}
```

**Response**:
```typescript
{
  success: boolean,
  result: {
    latitude: number,
    longitude: number,
    altitude: number | null,
    accuracy: number,
    timestamp: number
  } | undefined,
  error: string | undefined
}
```

**Features**:
- Auto-caches location for 30 seconds
- Calculates distance between coordinates (Haversine formula)
- Battery-conscious with start/stop tracking methods
- Permission handling built-in

**Usage Example**:
```typescript
const locationTool = new LocationTool()
const result = await locationTool.execute({})

if (result.success) {
  const {latitude, longitude} = result.result
  // Use for species occurrence lookup via iNaturalist
}
```

#### WeatherTool
**Purpose**: Current weather conditions using Spectacles UserContextSystem

**Implementation**: Uses Spectacles `UserContextSystem` API for weather data

**Parameters**:
```typescript
{
  useCelsius: boolean  // Default: true
}
```

**Response**:
```typescript
{
  success: boolean,
  result: {
    temperature: number,
    condition: WeatherCondition,  // enum: Clear, Cloudy, Rain, etc.
    conditionString: string,
    isButterflyWeather: boolean,
    butterflyActivityLevel: "low" | "moderate" | "high",
    timestamp: number
  } | undefined,
  error: string | undefined
}
```

**Features**:
- Temperature in Celsius or Fahrenheit
- Butterfly activity assessment based on weather
- Sunlight level determination (direct/filtered/shade)
- Wind level categorization (calm/moderate/windy)
- Auto-caches for 60 seconds

**Butterfly Activity Logic**:
- **High**: 18-30°C + clear/partly cloudy
- **Moderate**: 15-35°C + acceptable conditions
- **Low**: Outside optimal range or poor conditions

**Usage Example**:
```typescript
const weatherTool = new WeatherTool()
const result = await weatherTool.execute({useCelsius: true})

if (result.success && result.result.isButterflyWeather) {
  const activity = result.result.butterflyActivityLevel
  // "high" → Great time for butterfly observation
  // "moderate" → Some butterflies active
  // "low" → Consider habitat learning instead
}
```

**Combined Usage**:
```typescript
// Agents can fetch full environmental context
const locationTool = new LocationTool()
const weatherTool = new WeatherTool()

const [location, weather] = await Promise.all([
  locationTool.execute({}),
  weatherTool.execute({})
])

// Pass to SpatialTool for habitat analysis
const spatialTool = new SpatialTool(languageInterface)
await spatialTool.execute({
  query: "What butterflies might be here?",
  butterflyHabitatFocus: true,
  environmentalConditions: {
    sunlight: weatherTool.getSunlightLevel(),
    temperature: weather.result.temperature,
    windLevel: weatherTool.getWindLevel()
  }
})
```

### 3.3 Future Tools (Not Yet Implemented)

#### ButterflySpotter
**Purpose**: Real-time butterfly detection and identification

**Parameters**:
```typescript
{
  query: string,
  image: string,              // Base64 encoded image from camera
  location: {                  // GPS coordinates
    latitude: number,
    longitude: number,
    accuracy: number
  },
  timeOfDay: string,           // "morning" | "midday" | "afternoon" | "evening"
  season: string,              // "spring" | "summer" | "fall"
  includeRareSpecies: boolean    // Expand search beyond common species
}
```

**Response**:
```typescript
{
  identifications: [
    {
      species: string,          // Scientific name
      commonName: string,
      confidence: number,        // 0-1
      description: string,      // Key identification features
      probability: number,      // Likelihood given location/season
      conservationStatus: string
    }
  ],
  habitatAnalysis: {
    plantsObserved: string[],
    environmentalSuitability: number,
    suggestedSpecies: string[]
  }
}
```

**Implementation Notes**:
- Use vision models for species classification
- Cross-reference with location-based occurrence data
- Season and time-of-day filtering
- Confidence scoring based on visual match + environmental context

#### ButterflyKnowledge
**Purpose**: Comprehensive butterfly species information

**Parameters**:
```typescript
{
  species: string,             // Scientific or common name
  includeLifeCycle: boolean,
  includeDistribution: boolean,
  includeConservation: boolean,
  includeStories: boolean,     // Engaging narratives
  languageLevel: "beginner" | "intermediate" | "advanced"
}
```

**Response**:
```typescript
{
  species: {
    scientificName: string,
    commonNames: string[],
    taxonomy: {
      family: string,
      subfamily: string,
      genus: string
    }
  },
  lifeCycle: {
    stages: string[],          // egg, larva, pupa, adult
    hostPlants: string[],      // Plants required for development
    duration: string,          // Time from egg to adult
    generationsPerYear: number
  },
  distribution: {
    range: string,             // Geographic description
    habitat: string[],          // Preferred environments
    flightSeason: string,        // When adults are typically active
    migration: boolean
  },
  conservation: {
    status: string,            // IUCN status
    threats: string[],          // Known threats to survival
    conservationEfforts: string[]
  },
  stories: string[],           // Engaging narratives and facts
  relatedSpecies: string[]      // Similar species users might encounter
}
```

#### HabitatAnalyzer
**Purpose**: Assess habitat suitability for butterfly observation

**Parameters**:
```typescript
{
  location: {
    latitude: number,
    longitude: number
  },
  image: string,              // Environmental image for plant ID
  season: string,
  timeOfDay: string
}
```

**Response**:
```typescript
{
  habitatQuality: {
    score: number,             // 0-100 habitat quality index
    factors: string[],         // What contributes to score
    improvements: string[]       // Suggestions for enhancement
  },
  expectedSpecies: {
    highProbability: string[],  // Very likely to find
    mediumProbability: string[],
    seasonalSpecies: string[]   // Species active in current season
  },
  plantInventory: {
    hostPlants: string[],      // Butterfly larval food plants
    nectarPlants: string[]    // Adult food sources
  }
}
```

---

## 4. Knowledge Base Integration

### 4.1 iNaturalist API

**Purpose**: Real-time species occurrence data and community observations

**Endpoints**:
- `GET /observations`: Recent butterfly observations near location
- `GET /taxa`: Species information and taxonomy
- `POST /observations`: Submit user observations

**Usage Patterns**:
```typescript
// Get species likely in current area
const observations = await iNaturalist.getObservations({
  taxon_id: [ButterflyTaxonIDs],  // Lepidoptera filter
  lat: currentLocation.latitude,
  lng: currentLocation.longitude,
  radius: 5,                       // 5km radius
  order: "desc",
  order_by: "observed_on"
})

// Verify species identification probability
const speciesData = await iNaturalist.getTaxonInfo({
  id: identifiedSpeciesId,
  preferred_place_id: currentRegionId
})
```

**Data Fields Used**:
- Species occurrence counts (relevance weighting)
- Observation dates (seasonal activity)
- Geographic distribution (location-based filtering)
- Community identifiers (identification confidence)

### 4.2 eButterfly.org

**Purpose**: Detailed life history and distribution data

**Endpoints**:
- Species pages with life cycle information
- Distribution maps by state/region
- Flight season calendars

**Usage Patterns**:
```typescript
const speciesInfo = await EButterfly.getSpecies({
  scientificName: "Danaus plexippus",
  region: "North America"
})

// Get flight season for current location
const flightSeason = await EButterfly.getFlightSeason({
  speciesId: speciesInfo.id,
  state: currentLocation.state,
  month: currentMonth
})
```

**Data Fields Used**:
- Host plant requirements
- Number of generations per year
- Regional flight patterns
- Habitat preferences

### 4.3 Butterfly Conservation Databases

**Purpose**: Conservation status and threatened species information

**Sources**:
- IUCN Red List API
- Xerces Society databases
- Regional conservation organizations

**Usage Patterns**:
```typescript
const conservationStatus = await ConservationAPI.getStatus({
  species: "Danaus plexippus",
  region: "North America"
})

// Get conservation priorities for local area
const priorities = await ConservationAPI.getLocalPriorities({
  region: currentLocation.state,
  habitatType: "meadow"
})
```

**Data Fields Used**:
- IUCN threat categories
- Population trends
- Conservation actions
- Priority species for regions

---

## 5. Agent Interaction & Coordination

### 5.1 Collaborative Dialogue Pattern

**Flow Diagram**:
```
User Query
    ↓
AgentOrchestrator.processUserQuery()
    ↓
ToolRouter.getAIRoutingDecision()
    ↓
Selected Agent (Naturalist or Archivist)
    ↓
Agent.execute() → Generate response
    ↓
If reference to other agent → CoordinationRequest
    ↓
Other Agent.contribute() → Provide additional insights
    ↓
Combined response returned to user
```

### 5.2 Coordination Scenarios

#### Scenario 1: Naturalist initiates, Archivist enriches
```
User: "What should I look for?"
Naturalist: "Notice the flowers. Different butterflies prefer different colors.
What colors do you see?"
User: "Mostly purple and yellow"
Naturalist: "Those are great nectar sources! Have you noticed any butterflies
visiting them yet?"
User: "I see some small ones on the yellow flowers"
Naturalist: "Can you tell me anything about their wing patterns or how they fly?
I'm wondering if we can figure out what family they might belong to..."
[Coordination Request to Archivist]
Archivist: "Small butterflies visiting yellow flowers - that could be several
species! Sulphurs love yellow flowers, and there are some beautiful blues that
like bright blooms too. I've got some fascinating stories about how some of
these little butterflies navigate using UV patterns we can't even see. Would
you like to hear about that?"
```

#### Scenario 2: Archivist identifies, Naturalist guides observation
```
User: "I see a big orange and black butterfly"
Archivist: "That sounds like it might be a Monarch! They're famous for their
migration - some travel thousands of miles. The black veins on orange wings
are their signature. Can you see if it has white spots on the wing edges?"
User: "Yes, it has white spots"
Archivist: "Then it's almost certainly a Monarch! Here's something amazing -
they've never made this migration journey before, but somehow find the same
mountains in Mexico their ancestors visited generations ago."
[Coordination Request to Naturalist]
Naturalist: "That's wonderful you've spotted a Monarch! I'm curious - have you
noticed what plants it's visiting? Monarchs have a very special relationship with
milkweed that's fascinating to observe. Can you find any milkweed plants nearby?"
```

### 5.3 Agent Routing Logic

**Routing Decision Factors**:
```typescript
function determineAgent(query, context): string {
  const agentWeights = {
    naturalist: 0,
    archivist: 0
  }

  // Query content analysis
  if (query.includes("what should I look for")) agentWeights.naturalist += 3
  if (query.includes("notice") || query.includes("observe")) agentWeights.naturalist += 2
  if (query.includes("identify") || query.includes("what is")) agentWeights.archivist += 3
  if (query.includes("tell me about") || query.includes("information")) agentWeights.archivist += 2

  // Context analysis
  if (recentQueries.includes("discovery")) agentWeights.naturalist += 1
  if (recentQueries.includes("identification")) agentWeights.archivist += 1

  // Environmental context
  if (locationData.hasButterflies) agentWeights.archivist += 1
  if (!locationData.hasButterflies) agentWeights.naturalist += 2

  return agentWeights.naturalist > agentWeights.archivist ? "naturalist" : "archivist"
}
```

---

## 6. Technical Implementation

### 6.1 Agent System Architecture

**New Components**:
```
AgentOrchestrator (Enhanced)
├── AgentRouter (New)
│   ├── NaturalistAgent
│   │   ├── SpatialTool
│   │   ├── GeneralConversationTool
│   │   ├── ButterflySpotter (Future)
│   │   └── HabitatAnalyzer (Future)
│   └── ArchivistAgent
│       ├── SpatialTool
│       ├── GeneralConversationTool
│       ├── ButterflyKnowledge (Future)
│       └── EcosystemExplorer (Future)
├── KnowledgeBaseManager (New)
│   ├── iNaturalistAdapter
│   ├── EButterflyAdapter
│   └── ConservationDataAdapter
└── AgentCoordinator (New)
    ├── DialogueStateManager
    └── CoordinationProtocol
```

### 6.2 Agent Interface

**Base Agent Class**:
```typescript
abstract class OutdoorEducationAgent {
  protected languageInterface: AgentLanguageInterface
  protected personality: AgentPersonality
  protected tools: Map<string, Tool>

  abstract getName(): string
  abstract getSystemPrompt(): string
  abstract execute(args: Record<string, unknown>): Promise<AgentResponse>

  protected async coordinateWithAgent(
    agentName: string,
    context: string
  ): Promise<AgentResponse>
}

interface AgentPersonality {
  tone: "gentle" | "enthusiastic"
  teachingStyle: "socratic" | "storyteller"
  philosophy: string
  languagePatterns: string[]
}
```

### 6.3 Knowledge Base Manager

**Interface**:
```typescript
class KnowledgeBaseManager {
  private adapters: Map<string, KnowledgeBaseAdapter>

  getSpeciesInfo(species: string): Promise<SpeciesData>
  getLocalSpecies(location: Location): Promise<Species[]>
  getHabitatData(location: Location): Promise<HabitatData>
  getConservationStatus(species: string): Promise<ConservationData>

  private async aggregateData(sources: string[], query: any): Promise<any>
}

interface KnowledgeBaseAdapter {
  name: string
  query(query: any): Promise<any>
  normalizeResponse(response: any): StandardDataFormat
}
```

---

## 7. User Experience Design

### 7.1 Core User Journey

**Discovery Session Flow**:
1. User arrives at outdoor location
2. Naturalist welcomes and prompts environmental observation
3. User describes surroundings (plants, conditions)
4. Naturalist guides toward butterfly observation
5. User spots butterfly, describes what they see
6. Archivist identifies and shares stories
7. Naturalist encourages deeper observation
8. Archivist provides additional ecological context
9. User may submit observation to iNaturalist (future)

### 7.2 Voice Interaction Design

**Agent Voice Distinction**:
- **Naturalist**: Calmer, measured pacing, more pauses for user thinking
- **Archivist**: More energy, slightly faster pace, enthusiasm in tone

**Conversation Flow**:
```
[Visual Agent Indicator shows Naturalist or Archivist]
[Text displays agent name: "Naturalist: ..."]
[Audio characteristics adjust to agent personality]
```

### 7.3 Spatial Context Integration

**Camera Usage**:
- Continuous environmental understanding during discovery sessions
- Butterfly capture for identification (ButterflySpotter tool)
- Habitat analysis for species probability (HabitatAnalyzer tool)

**Location Awareness**:
- GPS data for species occurrence lookup
- Regional flight season information
- Local conservation priorities

---

## 8. Success Metrics

### 8.1 Learning Outcomes
- Users can identify 3+ common butterfly species by location
- Users understand butterfly life cycles and host plant relationships
- Users demonstrate improved observation skills (noticing details they previously missed)
- Users express increased curiosity and engagement with nature

### 8.2 Engagement Metrics
- Session duration (>10 minutes indicates successful discovery)
- Agent coordination frequency (collaborative dialogue)
- Tool usage diversity (spatial, knowledge, identification)
- Return usage (users continuing sessions)

### 8.3 Technical Metrics
- Knowledge base query success rate (>95%)
- Agent routing accuracy (appropriate agent for query type)
- Tool execution latency (<2 seconds for knowledge, <5 for identification)
- Voice transcription accuracy for outdoor environments

---

## 9. Implementation Phases

### Phase 1: Foundation (Current)
- [x] Review existing architecture
- [x] Define agent personalities and roles
- [x] Specify knowledge base integrations
- [x] Design agent coordination protocol
- [ ] Create PRD and get stakeholder approval
- [ ] Set up development environment for butterfly system

### Phase 2: Agent Implementation
- [x] Implement NaturalistAgent class
- [x] Implement ArchivistAgent class
- [x] Create AgentRouter for agent selection
- [x] Implement AgentCoordinator for collaboration
- [x] Enhanced SpatialTool for habitat analysis
- [x] Agent personality prompt engineering

### Phase 3: Knowledge Base Integration
- [ ] Implement KnowledgeBaseManager
- [ ] Create iNaturalistAdapter
- [ ] Create EButterflyAdapter
- [ ] Create ConservationDataAdapter
- [ ] Implement species data aggregation
- [ ] Add caching for frequent queries

### Phase 4: Butterfly Detection Tools
- [ ] Implement ButterflySpotter with image recognition
- [ ] Implement HabitatAnalyzer
- [ ] Implement ButterflyKnowledge database tool
- [ ] Implement EcosystemExplorer
- [ ] Integrate camera capture workflows

### Phase 5: User Experience & Testing
- [ ] Implement agent voice distinction
- [ ] Create visual agent indicators
- [ ] Test collaborative dialogue flows
- [ ] Outdoor field testing
- [ ] User feedback collection and iteration

### Phase 6: Launch & Iteration
- [ ] Performance optimization
- [ ] Knowledge base expansion
- [ ] Additional feature requests evaluation
- [ ] Long-term engagement analysis
- [ ] Platform expansion considerations

---

## 10. Open Questions & Considerations

### Technical Considerations
- **Model Selection**: Should different agents use different LLM models or personalities be prompt-based only?
- **Image Recognition**: Build custom butterfly classifier or use existing computer vision APIs?
- **Offline Capability**: What functionality should work without internet connection?
- **Privacy Considerations**: How to handle location data and user observations?

### Educational Considerations
- **Age Appropriateness**: Should system adapt explanation complexity to user's apparent knowledge level?
- **Scaffolding Balance**: How much guidance vs. independent discovery is optimal?
- **Progress Tracking**: Should we track learning progress across sessions?

### Future Enhancements
- **Gamification**: Achievements for species observed, habitats explored
- **Community Sharing**: Share observations with local naturalist community
- **Seasonal Events**: Notify users of butterfly migration periods or rare species in area
- **Expert Connection**: Connect users with local butterfly experts for deeper learning

---

## Appendix A: Glossary

**Socratic Method**: Teaching approach that uses questions to stimulate critical thinking and illuminate ideas, rather than providing direct instruction.

**Host Plant**: Specific plant species that butterfly caterpillars require for food and development. Many butterflies are highly specialized to specific host plants.

**Flight Season**: Time period when adult butterflies of a species are typically active and visible. Varies by region and species.

**Lepidoptera**: Scientific order that includes butterflies and moths.

**Nectar Plant**: Flowering plants that provide food for adult butterflies.

**Phenology**: Study of cyclic and seasonal natural phenomena, especially in relation to climate and plant and animal life.

**Taxonomy**: Scientific classification system for organizing biological organisms.

**Conservation Status**: Assessment of a species' risk of extinction, typically based on IUCN Red List categories.

---

## Appendix B: Example Butterfly Species

### Monarch (Danaus plexippus)
- **Migration**: Famous 3,000 mile North America migration
- **Host Plants**: Milkweed (Asclepias) species only
- **Conservation**: Near Threatened (IUCN)
- **Story**: Multi-generational migration - grandchildren return to ancestral great-grandparent wintering sites

### Painted Lady (Vanessa cardui)
- **Migration**: Pan-hemispheric migrant found worldwide
- **Host Plants**: Thistles, mallows, various legumes
- **Conservation**: Least Concern
- **Story**: One of the most widespread butterflies, capable of population explosions

### Eastern Tiger Swallowtail (Papilio glaucus)
- **Migration**: Limited regional movement
- **Host Plants**: Cherry, ash, tulip tree
- **Conservation**: Least Concern
- **Story**: Mimicry patterns - mimics toxic pipevine swallowtails for protection

---

**Document Version**: 1.0
**Last Updated**: 2025-01-15
**Status**: Draft - Open for Stakeholder Feedback
