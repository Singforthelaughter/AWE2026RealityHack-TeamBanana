# Agent Test Cases for Voice Testing

This document contains comprehensive test cases for testing the new agent system using microphone input. Each test case includes expected tool calls, debug logs, and routing decisions.

## Important Agent Architecture Notes

### Naturalist Agent
- **Voice-only**: Does NOT use camera or image input
- Responds to verbal observations with follow-up questions
- Guides users through Socratic dialogue based on what they say
- Does NOT capture or analyze visual input

### Archivist Agent
- Can use knowledge sources and tools for factual information
- May invoke camera-based tools for identification when needed
- Provides knowledge, facts, and educational content

### Spatial Tool
- Uses camera input for visual analysis
- Used by Archivist agent or directly when visual analysis is requested
- NOT used by Naturalist agent (which is voice-only)

## Table of Contents

1. [Naturalist Agent Tests](#naturalist-agent-tests)
2. [Archivist Agent Tests](#archivist-agent-tests)
3. [Agent Router Tests](#agent-router-tests)
4. [Agent Coordinator Tests](#agent-coordinator-tests)
5. [Agent Orchestrator Tests](#agent-orchestrator-tests)
6. [Cross-Agent Coordination Tests](#cross-agent-coordination-tests)
7. [Knowledge Source Tests](#knowledge-source-tests)
8. [Tool Use Tests](#tool-use-tests)
9. [Nearby Sightings Tool Tests](#nearby-sightings-tool-tests)

---

## Naturalist Agent Tests

**IMPORTANT**: The Naturalist agent is **voice-only** and does NOT use camera input. It guides users through Socratic dialogue based on verbal observations.

### Test 1: Initial Discovery Request

**Scenario**: User starts outdoor butterfly discovery session

**Voice Command**: "What should I look for?"

**Expected Tool Calls**:
```typescript
{
  tool: "general_conversation",
  parameters: {
    query: "What should I look for?",
    maxLength: 200
  }
}
```

**Expected Debug Logs**:
```
AgentOrchestrator: Processing voice input: "What should I look for?"
AgentOrchestrator: Checking active agent...
AgentOrchestrator: No active agent, routing query...
AgentRouter: Routing query: "What should I look for?"
AgentRouter: 'naturalist' confidence: 0.70
AgentRouter: 'archivist' confidence: 0.30
AgentRouter: ✅ Routing decision:
  Selected: naturalist
  Confidence: 0.70
  Reasoning: Selected naturalist with confidence 0.70. Alternatives considered: archivist(0.30).
NaturalistAgent: Processing discovery query: "What should I look for?"
NaturalistAgent: Voice-only mode - no camera input
NaturalistAgent: Generated discovery response: "What do you notice about the plants around you..."
AgentOrchestrator: 🎯 Routed to naturalist (confidence: 0.70)
AgentOrchestrator: Response from naturalist ready
```

**Expected Response Characteristics**:
- Gentle, questioning tone
- Contains Socratic question prompts
- Focuses on environmental awareness
- Measured pacing for voice output
- Encourages verbal descriptions
- Asks user to describe what they see

**Expected Routing Decision**:
```typescript
{
  selectedAgent: "naturalist",
  confidence: 0.70,
  reasoning: "Selected naturalist with confidence 0.70. Alternatives considered: archivist(0.30).",
  alternativeAgents: [
    {name: "archivist", confidence: 0.30}
  ]
}
```

---

### Test 2: Environmental Observation

**Scenario**: User reports plant observations

**Voice Command**: "I see some purple flowers"

**Expected Tool Calls**:
```typescript
{
  tool: "general_conversation",
  parameters: {
    query: "I see some purple flowers",
    maxLength: 200
  }
}
```

**Expected Debug Logs**:
```
AgentOrchestrator: Processing voice input: "I see some purple flowers"
AgentOrchestrator: Active agent: naturalist
AgentOrchestrator: Continuing with naturalist
NaturalistAgent: Processing discovery query: "I see some purple flowers"
NaturalistAgent: Voice-only mode - responding to verbal observation
NaturalistAgent: Updated discovery state: plantsIdentified=true
NaturalistAgent: Generated discovery response: "I love that you noticed the purple flowers. Can you tell me more about their shape or size?"
AgentOrchestrator: Response from naturalist ready
```

**Expected Response**:
- Acknowledges user's verbal observation
- Asks follow-up question based on what user said
- Does NOT capture or analyze camera input
- Encourages continued verbal description

**Expected Discovery State**:
```typescript
{
  environmentNoticed: true,
  plantsIdentified: true,
  butterflySighted: false,
  behaviorObservations: [],
  currentFocus: "environment"
}
```

---

### Test 3: Butterfly Sighting

**Scenario**: User spots a butterfly

**Voice Command**: "I just saw a butterfly"

**Expected Tool Calls**:
```typescript
{
  tool: "general_conversation",
  parameters: {
    query: "I just saw a butterfly",
    maxLength: 200
  }
}
```

**Expected Debug Logs**:
```
AgentOrchestrator: Processing voice input: "I just saw a butterfly"
AgentOrchestrator: Active agent: naturalist
AgentOrchestrator: Continuing with naturalist
NaturalistAgent: Processing discovery query: "I just saw a butterfly"
NaturalistAgent: Voice-only mode - responding to verbal observation
NaturalistAgent: Updated discovery state: butterflySighted=true
NaturalistAgent: Generated discovery response: "How exciting! What do you notice about its colors or size?"
AgentOrchestrator: Response from naturalist ready
```

**Expected Discovery State**:
```typescript
{
  environmentNoticed: true,
  plantsIdentified: true,
  butterflySighted: true,
  behaviorObservations: [],
  currentFocus: "observation"
}
```

---

### Test 4: Behavior Observation

**Scenario**: User describes butterfly behavior

**Voice Command**: "It's flying from flower to flower"

**Expected Tool Calls**:
```typescript
{
  tool: "general_conversation",
  parameters: {
    query: "It's flying from flower to flower",
    maxLength: 200
  }
}
```

**Expected Debug Logs**:
```
AgentOrchestrator: Processing voice input: "It's flying from flower to flower"
AgentOrchestrator: Active agent: naturalist
AgentOrchestrator: Continuing with naturalist
NaturalistAgent: Processing discovery query: "It's flying from flower to flower"
NaturalistAgent: Voice-only mode - responding to verbal observation
NaturalistAgent: Added behavior observation: "It's flying from flower to flower"
NaturalistAgent: Generated discovery response: "What patterns do you notice in its flight path? Is it moving quickly or slowly?"
AgentOrchestrator: Response from naturalist ready
```

---

## Archivist Agent Tests

### Test 5: Species Identification Request

**Scenario**: User asks for butterfly identification

**Voice Command**: "What kind of butterfly is this?"

**Expected Tool Calls**:
```typescript
{
  tool: "general_conversation",
  parameters: {
    query: "What kind of butterfly is this?",
    maxLength: 250
  }
}
```

**Expected Debug Logs**:
```
AgentOrchestrator: Processing voice input: "What kind of butterfly is this?"
AgentOrchestrator: Checking active agent...
AgentOrchestrator: No active agent, routing query...
AgentRouter: Routing query: "What kind of butterfly is this?"
AgentRouter: 'naturalist' confidence: 0.40
AgentRouter: 'archivist' confidence: 0.70
AgentRouter: ✅ Routing decision:
  Selected: archivist
  Confidence: 0.70
  Reasoning: Selected archivist with confidence 0.70. Alternatives considered: naturalist(0.40).
ArchivistAgent: Processing knowledge query: "What kind of butterfly is this?"
ArchivistAgent: Generated knowledge response: "I'd love to help identify it! Did you know..."
AgentOrchestrator: 🎯 Routed to archivist (confidence: 0.70)
AgentOrchestrator: Response from archivist ready
```

**Expected Routing Decision**:
```typescript
{
  selectedAgent: "archivist",
  confidence: 0.70,
  reasoning: "Selected archivist with confidence 0.70. Alternatives considered: naturalist(0.40).",
  alternativeAgents: [
    {name: "naturalist", confidence: 0.40}
  ]
}
```

---

### Test 6: Curiosity About Butterfly Life

**Scenario**: User asks about butterfly life cycles

**Voice Command**: "Tell me about their life cycle"

**Expected Tool Calls**:
```typescript
{
  tool: "general_conversation",
  parameters: {
    query: "Tell me about their life cycle",
    maxLength: 250
  }
}
```

**Expected Debug Logs**:
```
AgentOrchestrator: Processing voice input: "Tell me about their life cycle"
AgentOrchestrator: Checking active agent...
AgentOrchestrator: No active agent, routing query...
AgentRouter: Routing query: "Tell me about their life cycle"
AgentRouter: 'naturalist' confidence: 0.30
AgentRouter: 'archivist' confidence: 0.60
AgentRouter: ✅ Routing decision:
  Selected: archivist
  Confidence: 0.60
  Reasoning: Selected archivist with confidence 0.60. Alternatives considered: naturalist(0.30).
ArchivistAgent: Processing knowledge query: "Tell me about their life cycle"
ArchivistAgent: Updated story state: topicsExplored=["life cycle"]
ArchivistAgent: Generated knowledge response: "Did you know butterflies undergo complete metamorphosis?..."
```

**Expected Story State**:
```typescript
{
  lastSpeciesMentioned: null,
  topicsExplored: ["life cycle"],
  storiesShared: 0,
  curiosityPiqued: true
}
```

---

### Test 7: Migration Question

**Scenario**: User asks about butterfly migration

**Voice Command**: "How do they migrate?"

**Expected Tool Calls**:
```typescript
{
  tool: "general_conversation",
  parameters: {
    query: "How do they migrate?",
    maxLength: 250
  }
}
```

**Expected Debug Logs**:
```
AgentOrchestrator: Processing voice input: "How do they migrate?"
AgentOrchestrator: Active agent: archivist
AgentOrchestrator: Continuing with archivist
ArchivistAgent: Processing knowledge query: "How do they migrate?"
ArchivistAgent: Updated story state: topicsExplored=["life cycle", "migration"]
ArchivistAgent: Generated knowledge response: "What's fascinating about migration is..."
```

---

### Test 8: Specific Species Inquiry

**Scenario**: User asks about Monarch butterflies

**Voice Command**: "Tell me about Monarch butterflies"

**Expected Tool Calls**:
```typescript
{
  tool: "general_conversation",
  parameters: {
    query: "Tell me about Monarch butterflies\n\n[KNOWLEDGE CONTEXT: About Monarch: Iconic orange and black butterfly known for epic migrations. Key facts: Can travel up to 3,000 miles; Migrate to Mexico and California; Only butterfly to make two-way migration like birds]",
    maxLength: 250
  }
}
```

**Expected Debug Logs**:
```
AgentOrchestrator: Processing voice input: "Tell me about Monarch butterflies"
AgentOrchestrator: No active agent, routing query...
AgentRouter: Routing query: "Tell me about Monarch butterflies"
AgentRouter: 'naturalist' confidence: 0.30
AgentRouter: 'archivist' confidence: 0.90
AgentRouter: ✅ Routing decision:
  Selected: archivist
  Confidence: 0.90
  Reasoning: Selected archivist with confidence 0.90. Alternatives considered: naturalist(0.30).
ArchivistAgent: Processing knowledge query: "Tell me about Monarch butterflies"
ArchivistAgent: Identified species: Monarch
ArchivistAgent: Enhanced query with knowledge context
ArchivistAgent: Generated knowledge response: "Did you know Monarchs migrate thousands of miles..."
```

---

## Agent Router Tests

### Test 9: Clear Routing to Naturalist

**Scenario**: Query clearly suited for Naturalist

**Voice Command**: "What should I observe?"

**Expected Router Logs**:
```
AgentRouter: Routing query: "What should I observe?"
AgentRouter: 'naturalist' confidence: 0.70
AgentRouter: 'archivist' confidence: 0.30
AgentRouter: ✅ Routing decision:
  Selected: naturalist
  Confidence: 0.70
  Reasoning: Selected naturalist with confidence 0.70. Alternatives considered: archivist(0.30).
```

**Expected Statistics**:
```typescript
{
  totalRoutes: [{agent: "naturalist", count: 1}],
  averageConfidence: [{agent: "naturalist", confidence: 0.70}]
}
```

---

### Test 10: Clear Routing to Archivist with Camera Input

**Scenario**: Query clearly suited for Archivist - requires identification with visual analysis

**Voice Command**: "Identify this butterfly for me"

**Expected Router Logs**:
```
AgentRouter: Routing query: "Identify this butterfly for me"
AgentRouter: 'naturalist' confidence: 0.40
AgentRouter: 'archivist' confidence: 0.70
AgentRouter: ✅ Routing decision:
  Selected: archivist
  Confidence: 0.70
  Reasoning: Selected archivist with confidence 0.70. Alternatives considered: naturalist(0.40).
```

**Expected Tool Calls**:
```typescript
{
  tool: "spatial_tool",
  parameters: {
    query: "Identify this butterfly for me",
    enableImageInput: true,  // Archivist can use camera for identification
    butterflyHabitatFocus: false
  }
}
```

**Expected Debug Logs**:
```
AgentOrchestrator: 🎯 Routed to archivist (confidence: 0.70)
ArchivistAgent: Processing identification query: "Identify this butterfly for me"
ArchivistAgent: Activating spatial_tool with camera input for identification
SpatialTool: Capturing actual camera frame for visual analysis
SpatialTool: Successfully captured camera frame for visual analysis
ArchivistAgent: Visual analysis complete, responding with identification guidance
```

**Note**: The Archivist agent can use camera/spatial tools when needed for identification tasks, while the Naturalist agent is voice-only.

---

### Test 11: Ambiguous Query - Fallback

**Scenario**: Query that doesn't clearly match either agent

**Voice Command**: "Hello, how are you?"

**Expected Router Logs**:
```
AgentRouter: Routing query: "Hello, how are you?"
AgentRouter: 'naturalist' confidence: 0.40
AgentRouter: 'archivist' confidence: 0.40
AgentRouter: No agent met threshold (0.60), using fallback
AgentRouter: ✅ Routing decision:
  Selected: naturalist
  Confidence: 0.00
  Reasoning: No agent met confidence threshold of 0.60. Using fallback agent.
```

---

### Test 12: Router Statistics After Multiple Queries

**Scenario**: After several queries, check router statistics

**Expected Statistics**:
```typescript
{
  totalRoutes: [
    {agent: "naturalist", count: 5},
    {agent: "archivist", count: 3}
  ],
  averageConfidence: [
    {agent: "naturalist", confidence: 0.65},
    {agent: "archivist", confidence: 0.73}
  ]
}
```

---

## Agent Coordinator Tests

### Test 13: Basic Coordination Request

**Scenario**: Naturalist requests Archivist coordination for identification

**Voice Command**: "What kind is this?" (after butterfly sighting)

**Expected Coordination Queue**:
```typescript
[
  {
    fromAgent: "naturalist",
    toAgent: "archivist",
    context: "User has sighted a butterfly and is asking for identification. Query: \"What kind is this?\"",
    priority: 8,
    timestamp: <timestamp>
  }
]
```

**Expected Coordinator Logs**:
```
AgentCoordinator: 🤝 Collaborative dialogue manager initialized
NaturalistAgent: Requesting coordination with archivist
AgentCoordinator: Queued coordination: naturalist → archivist (priority: 8, queue size: 1)
AgentCoordinator: Processing coordination: naturalist → archivist
AgentCoordinator: 🔄 Speaker change: naturalist → archivist (coordination request)
AgentCoordinator: archivist coordination response: "Did you know..."
AgentCoordinator: ✅ Coordination completed: naturalist → archivist (success)
```

---

### Test 14: Priority-Based Coordination

**Scenario**: Multiple coordination requests queued by priority

**Expected Queue Processing Order**:
1. Priority 8 (species identification)
2. Priority 7 (discovery guidance)
3. Priority 6 (behavior context)
4. Priority 5 (general enhancement)

**Expected Logs**:
```
AgentCoordinator: Queued coordination: naturalist → archivist (priority: 5, queue size: 1)
AgentCoordinator: Queued coordination: naturalist → archivist (priority: 7, queue size: 2)
AgentCoordinator: Queued coordination: naturalist → archivist (priority: 8, queue size: 3)
AgentCoordinator: Processing coordination: naturalist → archivist (priority: 8)
AgentCoordinator: Processing coordination: naturalist → archivist (priority: 7)
AgentCoordinator: Processing coordination: naturalist → archivist (priority: 5)
```

---

### Test 15: Coordination Depth Limit

**Scenario**: Prevent infinite coordination loops

**Expected Logs**:
```
AgentCoordinator: Coordination depth limit reached (3)
AgentCoordinator: Skipping low-priority coordination (3 < 4)
```

**Expected Dialogue State**:
```typescript
{
  currentSpeaker: "naturalist",
  lastSpoken: "archivist",
  coordinationCount: 3,
  lastCoordinationTopic: "butterfly identification",
  dialogueDepth: 3
}
```

---

### Test 16: Coordination Statistics

**Scenario**: Get coordinator statistics after several coordinations

**Expected Statistics**:
```typescript
{
  queueLength: 0,
  totalCoordinations: 5,
  activeAgent: "naturalist",
  averageDepth: 1.8
}
```

---

## Agent Orchestrator Tests

### Test 17: Initial Voice Input Routing

**Scenario**: First voice input triggers routing

**Voice Command**: "What should I look for?"

**Expected Orchestrator Logs**:
```
AgentOrchestrator: Processing voice input: "What should I look for?"
AgentOrchestrator: Checking active agent...
AgentOrchestrator: No active agent, routing query...
AgentOrchestrator: 🎯 Routed to naturalist (confidence: 0.70)
AgentOrchestrator: Active agent set to naturalist
AgentOrchestrator: Response from naturalist ready
```

---

### Test 18: Continued Session with Active Agent

**Scenario**: Subsequent inputs use active agent

**Voice Command**: "I see some flowers"

**Expected Orchestrator Logs**:
```
AgentOrchestrator: Processing voice input: "I see some flowers"
AgentOrch:estrator: Active agent: naturalist
AgentOrchestrator: Continuing with naturalist
AgentOrchestrator: Response from naturalist ready
```

---

### Test 19: Context Switch via Low Confidence

**Scenario**: Query that doesn't match current agent triggers re-routing

**Active Agent**: naturalist

**Voice Command**: "Identify this butterfly"

**Expected Orchestrator Logs**:
```
AgentOrchestrator: Processing voice input: "Identify this butterfly"
AgentOrchestrator: Active agent: naturalist
AgentOrchestrator: Checking if archivist would be better...
AgentRouter: 'naturalist' confidence: 0.40
AgentRouter: 'archivist' confidence: 0.70
AgentOrchestrator: Re-routing to archivist (confidence: 0.70 > 0.40)
AgentOrchestrator: 🔄 Switched to archivist
AgentOrchestrator: Response from archivist ready
```

---

### Test 20: Session Reset

**Scenario**: Reset orchestrator state

**Expected Logs**:
```
AgentOrchestrator: 🔄 Session reset - clearing active agent and state
AgentOrchestrator: Active agent cleared
```

---

## Cross-Agent Coordination Tests

### Test 21: Naturalist to Archivist Coordination Flow

**Scenario**: Complete coordination flow from observation to identification

**Step 1 - Voice Command**: "I see a butterfly"

**Expected Logs**:
```
AgentOrchestrator: Processing voice input: "I see a butterfly"
AgentRouter: 'naturalist' confidence: 0.85
NaturalistAgent: Processing discovery query: "I see a butterfly"
NaturalistAgent: Voice-only mode - responding to verbal observation
NaturalistAgent: Updated discovery state: butterflySighted=true
NaturalistAgent: Generated discovery response: "That's wonderful! What colors do you see on its wings?"
AgentOrchestrator: Response from naturalist ready
```

**Step 2 - Voice Command**: "What kind is it?"

**Expected Logs**:
```
AgentOrchestrator: Processing voice input: "What kind is it?"
NaturalistAgent: Processing discovery query: "What kind is it?"
NaturalistAgent: Voice-only mode - cannot identify visually
NaturalistAgent: Requesting coordination: naturalist → archivist for identification
AgentCoordinator: Queued coordination: naturalist → archivist (priority: 8)
AgentCoordinator: Processing coordination: naturalist → archivist
AgentCoordinator: 🔄 Speaker change: naturalist → archivist (coordination request)
ArchivistAgent: Processing identification request from naturalist
ArchivistAgent: Activating spatial_tool with camera input for identification
SpatialTool: Capturing actual camera frame for visual analysis
SpatialTool: Successfully captured camera frame
ArchivistAgent: Generated identification response: "Based on what I can see, this appears to be..."
AgentCoordinator: ✅ Coordination completed: naturalist → archivist (success)
```

**Expected Response**:
- Naturalist acknowledges the coordination request
- Archivist provides species identification knowledge
- Both perspectives are combined in final response

---

### Test 22: Archivist to Naturalist Coordination Flow

**Scenario**: Knowledge sharing prompts observation guidance

**Voice Command**: "Tell me about Monarch migration"

**Expected Logs**:
```
ArchivistAgent: Processing knowledge query: "Tell me about Monarch migration"
ArchivistAgent: Updated story state: topicsExplored=["migration"]
ArchivistAgent: Requesting coordination with naturalist
AgentCoordinator: Queued coordination: archivist → naturalist (priority: 6)
AgentCoordinator: Processing coordination: archivist → naturalist
AgentCoordinator: 🔄 Speaker change: archivist → naturalist (coordination request)
NaturalistAgent: Generated discovery response: "Have you noticed any butterflies migrating..."
AgentCoordinator: ✅ Coordination completed: archivist → naturalist (success)
```

---

### Test 23: Multi-Agent Dialogue

**Scenario**: Complex topic requiring multiple agent perspectives

**Voice Command**: "Tell me what you know about butterfly behavior"

**Expected Sequence**:
1. Archivist provides knowledge about behavior
2. Archivist requests Naturalist coordination
3. Naturalist provides observation guidance
4. Naturalist requests Archivist coordination (if needed)
5. Final response combines both perspectives

**Expected Logs**:
```
ArchivistAgent: Processing knowledge query
ArchivistAgent: Generated knowledge response
ArchivistAgent: Requesting coordination with naturalist (priority: 7)
AgentCoordinator: 🔄 Speaker change: archivist → naturalist
NaturalistAgent: Generated discovery response
AgentOrchestrator: 🎭 Combining responses from archivist and naturalist
```

---

## Edge Cases and Error Handling

### Test 24: Empty Voice Input

**Voice Command**: (silence or very short input)

**Expected Logs**:
```
AgentOrchestrator: Processing voice input: ""
AgentOrchestrator: Empty input detected
AgentOrchestrator: Ignoring empty input
```

---

### Test 25: Very Long Voice Input

**Voice Command**: (Long description of observations)

**Expected Behavior**:
- Input is truncated to reasonable length
- Processing continues normally
- Router still functions correctly

**Expected Logs**:
```
AgentOrchestrator: Processing voice input: "I saw a butterfly that was orange and black..."
AgentOrchestrator: Input length: 200 characters (truncated if necessary)
```

---

### Test 26: Failed LLM Response

**Scenario**: LLM API fails

**Expected Logs**:
```
NaturalistAgent: ERROR - Discovery guidance failed: API error
NaturalistAgent: Generated error response: "I'm having trouble with that question..."
```

**Expected Fallback Response**:
- Error message is friendly and helpful
- Suggests rephrasing or trying again
- Maintains agent personality in error handling

---

### Test 27: Tool Execution Failure

**Scenario**: Registered tool fails to execute

**Expected Logs**:
```
OutdoorAgent (naturalist): Tool execution failed: Tool 'general_conversation' returned error
NaturalistAgent: ERROR - Discovery guidance failed
```

---

## Performance Tests

### Test 28: Response Time Under Threshold

**Expected Behavior**:
- Voice input to response time < 2 seconds
- Agent routing time < 100ms
- LLM response generation < 1.5 seconds

**Expected Logs**:
```
AgentOrchestrator: Processing voice input
AgentOrchestrator: Voice input processed in 15ms
AgentRouter: Routing query
AgentRouter: Routing completed in 45ms
NaturalistAgent: Processing query
NaturalistAgent: Response generated in 1,200ms
AgentOrchestrator: Total response time: 1,260ms
```

---

### Test 29: Concurrent Coordination Handling

**Scenario**: Multiple coordination requests in quick succession

**Expected Behavior**:
- Queue handles concurrent requests gracefully
- Requests are processed in priority order
- No race conditions or lost requests

**Expected Logs**:
```
AgentCoordinator: Queued coordination: naturalist → archivist (priority: 8, queue size: 1)
AgentCoordinator: Queued coordination: archivist → naturalist (priority: 6, queue size: 2)
AgentCoordinator: Processing coordination queue
AgentCoordinator: Processing coordination: naturalist → archivist (priority: 8)
AgentCoordinator: Processing coordination: archivist → naturalist (priority: 6)
AgentCoordinator: Coordination queue processing completed
```

---

## Integration Test Scenarios

### Test 30: Complete User Journey

**Scenario**: User starts session, makes observations, learns, and identifies

**Step-by-Step Sequence**:

1. **Start**: "What should I look for?"
   - Router → Naturalist
   - Naturalist guides environmental awareness

2. **Observe**: "I see purple flowers"
   - Naturalist continues
   - Updates discovery state

3. **Spot**: "There's a butterfly"
   - Naturalist continues
   - Updates discovery state

4. **Describe**: "It has orange wings"
   - Naturalist continues
   - Adds behavior observation

5. **Identify**: "What kind is it?"
   - Naturalist routes to Archivist
   - Coordination triggers
   - Archivist provides species knowledge

6. **Learn**: "Tell me about its life"
   - Archivist continues
   - Shares fascinating facts

**Expected Overall Flow**:
```
Session Start → Naturalist Discovery → Observation →
Butterfly Sighting → Behavior Notes → Coordination Request →
Archivist Knowledge → Species Identification → Life Cycle Information
```

---

## Knowledge Source Tests

### Test 31: Knowledge Source Retrieval for Species Information

**Scenario**: Agent retrieves knowledge about specific butterfly species

**Voice Command**: "Tell me about Monarch butterflies"

**Expected Knowledge Source Call**:
```typescript
{
  source: "butterfly_knowledge_base",
  query: {
    species: "monarch",
    topic: "general_info"
  }
}
```

**Expected Debug Logs**:
```
ArchivistAgent: Processing knowledge query: "Tell me about Monarch butterflies"
ArchivistAgent: Checking knowledge sources...
KnowledgeSourceSystem: Querying butterfly_knowledge_base for species: "monarch"
KnowledgeSourceSystem: Found knowledge entry for Monarch
KnowledgeSourceSystem: Retrieved: "Iconic orange and black butterfly known for epic migrations. Key facts: Can travel up to 3,000 miles; Migrate to Mexico and California; Only butterfly to make two-way migration like birds"
ArchivistAgent: Enhancing response with retrieved knowledge
ArchivistAgent: Knowledge retrieved successfully
```

**Expected Enhanced Query**:
```typescript
{
  originalQuery: "Tell me about Monarch butterflies",
  knowledgeContext: "Iconic orange and black butterfly known for epic migrations. Key facts: Can travel up to 3,000 miles; Migrate to Mexico and California; Only butterfly to make two-way migration like birds",
  source: "butterfly_knowledge_base",
  confidence: 0.95
}
```

---

### Test 32: Multiple Knowledge Sources Consultation

**Scenario**: Agent checks multiple knowledge sources for comprehensive answer

**Voice Command**: "What's the best habitat for butterfly observation?"

**Expected Knowledge Source Calls**:
```typescript
[
  {
    source: "butterfly_knowledge_base",
    query: {topic: "habitat", query: "best habitat for observation"}
  },
  {
    source: "environmental_guidance",
    query: {topic: "observation_conditions"}
  },
  {
    source: "species_occurrence_database",
    query: {topic: "habitat_correlation"}
  }
]
```

**Expected Debug Logs**:
```
ArchivistAgent: Querying multiple knowledge sources...
KnowledgeSourceSystem: Querying butterfly_knowledge_base (priority: 1)
KnowledgeSourceSystem: Querying environmental_guidance (priority: 2)
KnowledgeSourceSystem: Querying species_occurrence_database (priority: 3)
KnowledgeSourceSystem: Results received from 2/3 sources
KnowledgeSourceSystem: Merging knowledge from multiple sources
KnowledgeSourceSystem: Knowledge synthesis complete
```

---

### Test 33: Knowledge Source Cache Hit

**Scenario**: Agent retrieves cached knowledge to avoid redundant calls

**Voice Command**: "What did you say about Monarchs?" (after previous query)

**Expected Debug Logs**:
```
ArchivistAgent: Processing knowledge query: "What did you say about Monarchs?"
ArchivistAgent: Checking knowledge cache...
KnowledgeSourceSystem: Cache hit for species: "monarch"
KnowledgeSourceSystem: Retrieved cached knowledge: "Iconic orange and black butterfly..."
ArchivistAgent: Using cached knowledge (saves API call)
KnowledgeSourceSystem: Cache hit - saved 1,200ms latency
```

**Expected Cache Statistics**:
```typescript
{
  cacheHits: 1,
  cacheMisses: 0,
  hitRate: 1.0,
  savedApiCalls: 1,
  averageLatencySaved: 1200
}
```

---

### Test 34: Knowledge Source Fallback

**Scenario**: Primary knowledge source fails, agent uses fallback

**Expected Debug Logs**:
```
ArchivistAgent: Querying knowledge sources...
KnowledgeSourceSystem: Querying primary source...
KnowledgeSourceSystem: ERROR - Primary source unavailable: Connection timeout
KnowledgeSourceSystem: Attempting fallback source...
KnowledgeSourceSystem: Fallback source response: Partial knowledge available
ArchivistAgent: Using fallback knowledge with degraded confidence
ArchivistAgent: Response generated with lower confidence (0.65 vs 0.95)
```

---

## Tool Use Tests

### Test 35: Weather Tool Activation

**Scenario**: User asks about current weather conditions for butterfly activity

**Voice Command**: "Is the weather good for butterflies right now?"

**Expected Tool Call**:
```typescript
{
  tool: "weather_tool",
  parameters: {
    useCelsius: true
  }
}
```

**Expected Debug Logs**:
```
AgentOrchestrator: Processing voice input: "Is the weather good for butterflies right now?"
AgentOrchestrator: Checking active agent...
AgentRouter: 'naturalist' confidence: 0.80
AgentOrchestrator: Routed to naturalist
NaturalistAgent: Processing query: "Is the weather good for butterflies right now?"
NaturalistAgent: Detected weather-related query
NaturalistAgent: Activating weather_tool...
WeatherTool: Executing weather query...
WeatherTool: Requesting temperature and weather condition data
WeatherTool: Retrieved weather - 24.5°C, Sunny
WeatherTool: Butterfly activity: high (optimal conditions)
NaturalistAgent: Weather tool result integrated into response
```

**Expected Tool Response**:
```typescript
{
  success: true,
  result: {
    temperature: 24.5,
    condition: 7, // WeatherCondition.Sunny
    conditionString: "Sunny",
    isButterflyWeather: true,
    butterflyActivityLevel: "high",
    timestamp: 1717942800000
  }
}
```

**Expected Agent Response Elements**:
- Mentions current temperature (24.5°C)
- Describes weather condition (Sunny)
- References butterfly activity level (high)
- Provides weather-based guidance

---

### Test 36: Location Tool Activation

**Scenario**: User asks about location-specific butterfly species

**Voice Command**: "What butterflies can I find here?"

**Expected Tool Call**:
```typescript
{
  tool: "location_tool",
  parameters: {}
}
```

**Expected Debug Logs**:
```
AgentOrchestrator: Processing voice input: "What butterflies can I find here?"
AgentRouter: 'naturalist' confidence: 0.75
NaturalistAgent: Processing query: "What butterflies can I find here?"
NaturalistAgent: Detected location-based query
NaturalistAgent: Activating location_tool...
LocationTool: Executing location query...
LocationTool: Fetching GPS coordinates...
LocationTool: Successfully retrieved location - Lat: 37.7749, Lon: -122.4194
LocationTool: Location cached (30s TTL)
NaturalistAgent: Location tool result: San Francisco, CA area
NaturalistAgent: Enhancing response with regional species knowledge
```

**Expected Tool Response**:
```typescript
{
  success: true,
  result: {
    latitude: 37.7749,
    longitude: -122.4194,
    altitude: null,
    accuracy: 15.5,
    timestamp: 1717942800000
  }
}
```

**Expected Agent Response Elements**:
- Mentions geographic context
- Provides region-specific butterfly species
- References local habitat conditions

---

### Test 37: Spatial Tool Activation with Butterfly Habitat Focus

**Scenario**: User asks to analyze current environment for butterfly habitat

**Voice Command**: "Is this a good spot for butterflies?"

**Expected Tool Call**:
```typescript
{
  tool: "spatial_tool",
  parameters: {
    query: "Is this a good spot for butterflies?",
    enableImageInput: true,
    butterflyHabitatFocus: true,
    environmentalConditions: {
      sunlight: "direct",
      temperature: 24.5,
      windLevel: "calm"
    }
  }
}
```

**Expected Debug Logs**:
```
AgentOrchestrator: Processing voice input: "Is this a good spot for butterflies?"
AgentRouter: 'naturalist' confidence: 0.85
NaturalistAgent: Processing query: "Is this a good spot for butterflies?"
NaturalistAgent: Activating spatial_tool with butterfly habitat focus...
SpatialTool: Processing spatial query: "Is this a good spot for butterflies?"
SpatialTool: Butterfly habitat analysis mode enabled
SpatialTool: Capturing actual camera frame for visual analysis
SpatialTool: Started camera recording for frame capture
SpatialTool: Successfully captured camera frame for visual analysis
SpatialTool: Analyzing butterfly habitat...
SpatialTool: Habitat analysis complete - Quality: 75/100
SpatialTool: Factors: ["Sunny location supports butterfly activity", "Diverse flowering plants present"]
SpatialTool: Suggested species: ["Monarch", "Eastern Tiger Swallowtail"]
```

**Expected Tool Response**:
```typescript
{
  success: true,
  result: {
    message: "This is a promising habitat for butterflies! I can see several favorable conditions...",
    relatedTopics: ["spatial awareness", "butterfly habitat", "plant identification"],
    toolUsed: "spatial_tool",
    spatiallyAware: true,
    usedCamera: true,
    habitatAnalysis: {
      habitatQuality: 75,
      factors: ["Sunny location supports butterfly activity", "Diverse flowering plants present"],
      suggestedSpecies: ["Monarch", "Eastern Tiger Swallowtail"],
      plantInventory: {
        hostPlants: ["Milkweed (detected)", "Thistles (detected)"],
        nectarPlants: ["Purple flowers (detected)", "Yellow flowers (detected)"]
      }
    }
  }
}
```

---

### Test 38: Multiple Tools in Single Query

**Scenario**: User asks question requiring weather, location, and spatial context

**Voice Command**: "What butterflies should I expect to see here right now?"

**Expected Tool Calls Sequence**:
```typescript
[
  {
    tool: "location_tool",
    parameters: {}
  },
  {
    tool: "weather_tool",
    parameters: {useCelsius: true}
  },
  {
    tool: "spatial_tool",
    parameters: {
      query: "What butterflies should I expect to see here right now?",
      enableImageInput: true,
      environmentalConditions: {
        sunlight: "direct",
        temperature: 24.5,
        windLevel: "calm"
      }
    }
  }
]
```

**Expected Debug Logs**:
```
NaturalistAgent: Processing multi-context query...
NaturalistAgent: Detected need for location + weather + spatial analysis
NaturalistAgent: Activating location_tool (step 1/3)...
LocationTool: Successfully retrieved location - Lat: 37.7749, Lon: -122.4194
NaturalistAgent: Location result received
NaturalistAgent: Activating weather_tool (step 2/3)...
WeatherTool: Retrieved weather - 24.5°C, Sunny
NaturalistAgent: Weather result received
NaturalistAgent: Activating spatial_tool (step 3/3)...
SpatialTool: Habitat analysis complete - Quality: 80/100
NaturalistAgent: All tool results received
NaturalistAgent: Synthesizing response from multiple tool outputs
```

---

### Test 39: Tool Parameter Validation

**Scenario**: Testing invalid parameters to weather tool

**Tool Call**:
```typescript
{
  tool: "weather_tool",
  parameters: {
    useCelsius: "invalid", // Should be boolean
    invalidParam: "test"  // Unknown parameter
  }
}
```

**Expected Debug Logs**:
```
WeatherTool: ERROR - Invalid parameter type for useCelsius: expected boolean, got string
WeatherTool: Using default value: true
WeatherTool: Warning - Unknown parameter ignored: invalidParam
WeatherTool: Proceeding with valid parameters
WeatherTool: Retrieved weather - 24.5°C, Sunny
```

---

### Test 40: Tool Error Handling and Fallback

**Scenario**: Tool fails to execute, agent handles gracefully

**Expected Debug Logs**:
```
NaturalistAgent: Activating weather_tool...
WeatherTool: ERROR - Weather fetch failed: Permission denied
WeatherTool: Unable to retrieve weather data. Weather services may be unavailable.
NaturalistAgent: Tool execution failed: weather_tool returned error
NaturalistAgent: Fallback: Proceeding without weather data
NaturalistAgent: Generating response with degraded information
NaturalistAgent: Response generated without weather context (user will be informed)
```

**Expected Agent Response**:
- Acknowledges limited information availability
- Provides general guidance instead of specific weather-based advice
- Suggests enabling weather services if applicable

---

### Test 41: Tool Response Caching

**Scenario**: Tool response cached for subsequent queries

**First Query**: "What's the temperature?"
**Second Query**: "Is it still warm?"

**Expected Debug Logs**:
```
// First query
NaturalistAgent: Activating weather_tool...
WeatherTool: Executing weather query...
WeatherTool: Retrieved weather - 24.5°C, Sunny
WeatherTool: Data cached for 60 seconds

// Second query (within 60 seconds)
NaturalistAgent: Activating weather_tool...
WeatherTool: Executing weather query...
WeatherTool: Using cached data (age: 5 seconds, within TTL)
WeatherTool: Returned cached: 24.5°C, Sunny
WeatherTool: Cache hit - saved tool execution time
```

---

### Test 42: Tool Integration with Knowledge Sources

**Scenario**: Tool results enhance knowledge source queries

**Voice Command**: "What local butterflies are active in this weather?"

**Expected Flow**:
```typescript
// Step 1: Get location
location_tool → {latitude: 37.7749, longitude: -122.4194}

// Step 2: Get weather
weather_tool → {temperature: 24.5°C, condition: Sunny, butterflyActivityLevel: "high"}

// Step 3: Query knowledge with context
KnowledgeSourceSystem: Querying species_occurrence_database with context:
  - Location: San Francisco, CA
  - Temperature: 24.5°C
  - Weather: Sunny
  - Butterfly Activity: High
```

**Expected Debug Logs**:
```
NaturalistAgent: Multi-step analysis initiated
NaturalistAgent: Tool results integrated into knowledge query
KnowledgeSourceSystem: Enhanced query with environmental context
KnowledgeSourceSystem: Results: ["Monarch", "Western Tiger Swallowtail", "Red Admiral"]
KnowledgeSourceSystem: Filtered by current conditions (temperature, weather)
NaturalistAgent: Final response includes location, weather, and species data
```

---

### Test 43: Tool Permission and Availability Checks

**Scenario**: Testing tool availability before execution

**Expected Debug Logs**:
```
NaturalistAgent: Checking tool availability...
ToolRegistry: Checking weather_tool availability
ToolRegistry: weather_tool: AVAILABLE
ToolRegistry: Checking location_tool availability
ToolRegistry: location_tool: AVAILABLE (requires GPS permission)
ToolRegistry: Checking spatial_tool availability
ToolRegistry: spatial_tool: AVAILABLE (requires camera permission)
NaturalistAgent: All required tools available
NaturalistAgent: Proceeding with tool execution
```

**If Tool Unavailable**:
```
NaturalistAgent: Checking tool availability...
ToolRegistry: Checking weather_tool availability
ToolRegistry: weather_tool: UNAVAILABLE - Permission denied
NaturalistAgent: weather_tool unavailable - adapting response strategy
NaturalistAgent: Proceeding with degraded functionality
```

---

### Test 44: Nearby Sightings Tool — Basic Query

**Scenario**: User asks what butterflies have been spotted near them

**Voice Command**: "What butterflies have been spotted near me?"

**Expected Tool Call**:
```typescript
{
  tool: "nearby_sightings",
  parameters: {
    radius: 5,
    limit: 10,
    unit: "miles"
  }
}
```

**Expected Debug Logs**:
```
AgentOrchestrator: Processing voice input: "What butterflies have been spotted near me?"
AgentRouter: 'naturalist' confidence: 0.75
AgentOrchestrator: Routed to naturalist
NaturalistAgent: Processing query: "What butterflies have been spotted near me?"
NaturalistAgent: Activating nearby_sightings...
NearbySightingsTool: Executing — radius: 5 miles, limit: 10
NearbySightingsTool: Found 3 sightings within 5 miles
NaturalistAgent: Nearby sightings tool result integrated into response
```

**Expected Tool Response**:
```typescript
{
  success: true,
  result: {
    userLocation: { latitude: 37.7749, longitude: -122.4194 },
    sightings: [
      {
        id: "abc-123",
        speciesScientificName: "Danaus plexippus",
        speciesCommonNames: ["Monarch butterfly"],
        speciesProbability: 0.95,
        distanceKm: 0.05,
        identifiedAt: "2026-06-14T10:00:00Z"
      }
    ],
    count: 3,
    radius: 5,
    unit: "miles"
  },
  executionTime: 1234
}
```

**Expected Agent Response Elements**:
- Mentions the count of nearby sightings
- Names species using common names when available
- Naturalist tone: questions to encourage exploration
- Archivist tone: enthusiastic facts about the species found

---

### Test 45: Nearby Sightings with Custom Radius

**Scenario**: User asks for butterflies within a specific distance

**Voice Command**: "Are there any butterflies within 10 kilometers?"

**Expected Tool Call**:
```typescript
{
  tool: "nearby_sightings",
  parameters: {
    radius: 10,
    limit: 10,
    unit: "km"
  }
}
```

**Expected Debug Logs**:
```
AgentOrchestrator: Processing voice input: "Are there any butterflies within 10 kilometers?"
AgentRouter: 'naturalist' confidence: 0.80
NaturalistAgent: Activating nearby_sightings...
NearbySightingsTool: Executing — radius: 10 km, limit: 10
NearbySightingsTool: Found 7 sightings within 10 km
```

---

### Test 46: Archivist Agent Using Nearby Sightings

**Scenario**: User asks Archivist for species information about local butterflies

**Voice Command**: "What species live around here?"

**Expected Routing Decision**:
```typescript
{
  selectedAgent: "archivist",
  confidence: 0.70,
  reasoning: "Selected archivist with confidence 0.70. Alternatives considered: naturalist(0.40)."
}
```

**Expected Debug Logs**:
```
AgentOrchestrator: Processing voice input: "What species live around here?"
AgentRouter: 'archivist' confidence: 0.70
ArchivistAgent: Processing knowledge query: "What species live around here?"
ArchivistAgent: Activating nearby_sightings...
NearbySightingsTool: Found 4 sightings within 5 miles
ArchivistAgent: Enhancing response with nearby species data
ArchivistAgent: Generated knowledge response: "Did you know we have Monarchs nearby?..."
```

**Expected Response Characteristics**:
- Archivist enthusiasm woven into educational narrative
- Shares facts about species found locally
- May offer to tell stories about specific species

---

### Test 47: Naturalist Using Nearby Sightings for Discovery Guidance

**Scenario**: Naturalist uses nearby data to guide exploration

**Voice Command**: "Where should I go to find butterflies?"

**Expected Debug Logs**:
```
AgentOrchestrator: Processing voice input: "Where should I go to find butterflies?"
AgentRouter: 'naturalist' confidence: 0.85
NaturalistAgent: Activating nearby_sightings...
NearbySightingsTool: Found 5 sightings within 5 miles
NaturalistAgent: Using sighting locations for discovery guidance
NaturalistAgent: Generated discovery response: "Butterfly enthusiasts have spotted a few species not far from here. What direction do you feel drawn to explore first?"
```

**Expected Response Characteristics**:
- Socratic framing — guides rather than lists locations
- References sightings as "other explorers have found"
- Follows up with observation questions

---

### Test 48: No Nearby Sightings Found

**Scenario**: No sightings within the search radius

**Voice Command**: "What's been seen around here lately?"

**Expected Tool Response**:
```typescript
{
  success: true,
  result: {
    userLocation: { latitude: 37.7749, longitude: -122.4194 },
    sightings: [],
    count: 0,
    radius: 5,
    unit: "miles"
  },
  executionTime: 890
}
```

**Expected Agent Response**:
- Naturalist: "No one has reported sightings nearby — that means you could be the first! What plants do you notice?"
- Archivist: "This area hasn't had any reported sightings yet. Shall I tell you what butterflies to look for based on the habitat?"

---

### Test 49: Nearby Sightings Tool Cache Behavior

**Scenario**: Follow-up question within 30 seconds uses cached data

**First Query**: "What butterflies are nearby?"
**Second Query (15s later)**: "Tell me more about the first one"

**Expected Debug Logs**:
```
// First query
NearbySightingsTool: Found 3 sightings within 5 miles

// Second query — cache hit
NearbySightingsTool: Returning cached sightings
```

**Expected Cache Statistics**:
```typescript
{
  cacheTTL: 30000,     // 30 seconds
  cacheHits: 1,
  savedRoundTrips: 1
}
```

---

### Test 50: Nearby Sightings GPS Unavailable

**Scenario**: GPS permission denied or unavailable

**Voice Command**: "What butterflies are near me?"

**Expected Tool Response**:
```typescript
{
  success: false,
  error: "Unable to retrieve nearby sightings. Please check location permissions and try again.",
  executionTime: 150
}
```

**Expected Agent Fallback**:
- Naturalist: "I'd love to tell you about nearby butterflies, but I need location access. What do you notice around you right now?"
- Archivist: "I can't check local sightings without location access, but I can tell you about butterflies common in this region."

---

## Testing Instructions

### How to Run These Tests with Microphone

1. **Start the application** in Unity with agent system enabled
2. **Open console/debug window** to see expected logs
3. **Speak the voice commands** listed for each test case
4. **Verify the following**:
   - Console logs match expected debug logs
   - Tool calls match expected parameters
   - Routing decisions show correct agent selection
   - Coordination events fire when expected
   - Response times are acceptable
   - Agent personalities are reflected in responses

### Test Checklist per Case

- [ ] Debug logs: Are logs appearing in console?
- [ ] Agent selection: Is correct agent selected?
- [ ] Tool calls: Are tools called with correct parameters?
- [ ] Routing: Are routing confidence scores reasonable?
- [ ] Coordination: Do coordination events fire (if applicable)?
- [ ] Performance: Is response time acceptable?
- [ ] Personality: Is agent personality reflected?
- [ ] Errors: Are there no errors or unexpected behaviors?

#### Knowledge Source Testing Checklist

- [ ] Knowledge retrieval: Is knowledge source queried?
- [ ] Cache behavior: Do cache hits work on repeated queries?
- [ ] Fallback: Does fallback work if primary source fails?
- [ ] Multi-source: Are multiple sources consulted when needed?
- [ ] Knowledge context: Is retrieved knowledge included in responses?
- [ ] Confidence scores: Are knowledge confidence scores appropriate?

#### Tool Use Testing Checklist

- [ ] Tool activation: Does tool activate for relevant queries?
- [ ] Parameters: Are tool parameters correctly validated?
- [ ] Responses: Are tool responses properly integrated?
- [ ] Caching: Do tool responses cache appropriately?
- [ ] Error handling: Do tools fail gracefully when unavailable?
- [ ] Permissions: Are tool permissions checked before execution?
- [ ] Multi-tool: Do multiple tools coordinate in single queries?
- [ ] Tool-knowledge integration: Do tool results enhance knowledge queries?

### Common Issues to Watch For

1. **Voice Input Not Recognized**
   - Check microphone permissions
   - Verify voice input system is active
   - Ensure audio levels are adequate

2. **Routing Not Working**
   - Check agent registration
   - Verify confidence thresholds
   - Review agent canHandleQuery implementations

3. **Coordination Not Triggering**
   - Check coordination enable flag
   - Verify priority thresholds
   - Review agent coordination request logic

4. **LLM Failures**
   - Check API configuration
   - Verify model availability
   - Review error handling in agents

---

## Summary

This test suite covers:
- **50 test cases** across all agent components
- **Voice input testing** with natural language commands
- **Tool call verification** with expected parameters
- **Debug log validation** for transparency
- **Routing decision testing** for agent selection
- **Coordination flow testing** for agent collaboration
- **Edge cases** and error handling
- **Performance testing** for response times
- **Integration scenarios** for complete user journeys
- **Knowledge source testing** with cache, fallback, and multi-source scenarios
- **Tool use testing** with weather, location, spatial, and nearby_sightings tools and tool integration

### Critical Architecture Distinctions

**Naturalist Agent (Voice-Only)**:
- ❌ Does NOT use camera or image input
- ✅ Responds to verbal observations with follow-up questions
- ✅ Guides users through Socratic dialogue based on what they say
- ✅ Can route to Archivist for visual identification tasks

**Archivist Agent (Can Use Vision)**:
- ✅ Can use knowledge sources for factual information
- ✅ May invoke camera-based tools (spatial_tool) for identification
- ✅ Provides knowledge, facts, and educational content

**Spatial Tool**:
- ✅ Uses camera input for visual analysis
- ✅ Used by Archivist agent when visual analysis is requested
- ❌ NOT used by Naturalist agent (which is voice-only)

Each test case provides clear expectations for voice commands, tool calls, logs, and system behavior, making the agent system easy to validate with microphone input.

### How to Test Knowledge Sources and Tools

#### Testing Knowledge Sources
1. Speak queries that require species knowledge ("Tell me about Monarchs")
2. Watch console for `KnowledgeSourceSystem:` logs
3. Verify cache hits on repeated queries
4. Check fallback behavior if primary source fails
5. Confirm knowledge context is included in responses

#### Testing Tools
1. Weather Tool: Ask about weather conditions ("Is it good for butterflies?")
2. Location Tool: Ask local species questions ("What butterflies are here?")
3. Spatial Tool: Ask habitat analysis ("Is this a good spot?")
4. Nearby Sightings Tool: Ask about local sightings ("What butterflies have been spotted near me?")
5. Watch for tool activation logs and parameter validation
6. Verify tool responses enhance agent responses
7. Test error handling when tools are unavailable

#### Testing Tool Integration
1. Ask questions requiring multiple contexts ("What should I expect here now?")
2. Verify sequential tool calls (location → weather → spatial)
3. Check that tool results are combined in final response
4. Confirm tool caching reduces redundant calls
5. Test tool permission checks and graceful degradation
