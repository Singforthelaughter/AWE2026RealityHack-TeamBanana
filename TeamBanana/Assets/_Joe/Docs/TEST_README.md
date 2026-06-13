# Agent System Test Suite - Guide

## Overview

The test suite validates the butterfly outdoor education system with comprehensive coverage of:

- ✅ Mock Butterfly Knowledge Base
- ✅ Agent Router (intelligent routing)
- ✅ Naturalist Agent (Socratic discovery guide)
- ✅ Archivist Agent (Enthusiastic storyteller)
- ✅ Agent Coordinator (collaborative dialogue)
- ✅ End-to-End Integration

## Test File

**Location**: [`Assets/AgenticPlayground/Scripts/Tests/AgentSystemTests.ts`](Assets/AgenticPlayground/Scripts/Tests/AgentSystemTests.ts)

## Running Tests

### Method 1: Using Spectacles Test Framework
If the project has a test runner, execute:
```bash
# In your project's test framework
test AgentSystemTests
```

### Method 2: Direct Execution
```bash
# Navigate to test directory
cd "Assets/AgenticPlayground/Scripts/Tests/"

# Run tests (if spectacles has node execution)
node AgentSystemTests.js
```

### Method 3: In-Game Testing
Add a test trigger in your scene or component:

```typescript
// In your main component or script
import {AgentSystemTests} from "./Tests/AgentSystemTests"

// Add to onAwake or initialization
onAwake() {
  print("Running Agent System Tests...")
  AgentSystemTests.runAllTests().then(() => {
    print("Tests completed!")
  })
}
```

## Test Coverage

### 1. Mock Butterfly Knowledge Base (9 tests)
Tests the mock butterfly database functionality:
- ✅ Get species information (Monarch, Painted Lady, etc.)
- ✅ Handle non-existent species queries
- ✅ Retrieve all available species names
- ✅ Search species by description or characteristics
- ✅ Identify species mentioned in user queries
- ✅ Get migratory butterfly species
- ✅ Get species by conservation status
- ✅ Get habitat information
- ✅ Retrieve conservation stories (success and concern)

### 2. Agent Router (7 tests)
Tests intelligent routing between agents:
- ✅ Router initialization with both agents
- ✅ Route discovery queries (high confidence to Naturalist)
- ✅ Route identification queries (high confidence to Archivist)
- ✅ Route knowledge queries (high confidence to Archivist)
- ✅ Low confidence fallback handling
- ✅ Routing statistics and agent selection tracking
- ✅ Agent retrieval by name

### 3. Naturalist Agent (9 tests)
Tests the gentle Socratic discovery guide:
- ✅ Agent initialization (name, type, personality)
- ✅ Handle discovery queries with high confidence
- ✅ Handle observation queries with high confidence
- ✅ Handle behavior queries with high confidence
- ✅ Lower confidence for identification queries (Archivist domain)
- ✅ Execute discovery queries successfully
- ✅ Execute observation queries successfully
- ✅ Generate follow-up questions (Socratic approach)
- ✅ Extract related topics from responses

### 4. Archivist Agent (9 tests)
Tests the enthusiastic storyteller:
- ✅ Agent initialization (name, type, personality)
- ✅ Handle identification queries with high confidence
- ✅ Handle knowledge queries with high confidence
- ✅ Handle butterfly mentions with good confidence
- ✅ Lower confidence for pure discovery (Naturalist domain)
- ✅ Execute identification queries successfully
- ✅ Execute species-specific queries
- ✅ Generate follow-up questions (storytelling approach)
- ✅ Extract related topics with knowledge base

### 5. Agent Coordinator (6 tests)
Tests collaborative dialogue management:
- ✅ Coordinator initialization with router
- ✅ Dialogue state tracking
- ✅ Queue coordination requests
- ✅ Reset dialogue state
- ✅ Clear coordination queue
- ✅ Configuration management

### 6. Integration Tests (5 tests)
Tests end-to-end system functionality:
- ✅ Initialize full system (router, coordinator, agents)
- ✅ Route and execute queries through complete flow
- ✅ Different query types route to appropriate agents
- ✅ Agent personality differences are maintained
- ✅ System components work together correctly

## Expected Test Output

```
🧪 Butterfly Agent System - Test Suite
==================================================

📋 TEST SUITE: Mock Butterfly Knowledge Base
----------------------------------------
  ✅ PASS: Monarch species found
  ✅ PASS: Monarch name matches
  ✅ PASS: Scientific name matches
  ✅ PASS: Monarch has fascinating facts
  ✅ PASS: Monarch is migratory
...
✅ Mock Butterfly Knowledge Base tests completed

🧠 TEST SUITE: Agent Router
----------------------------------------
  ✅ PASS: Two agents registered
  ✅ PASS: Naturalist registered
  ✅ PASS: Archivist registered
...
✅ Agent Router tests completed

🌿 TEST SUITE: Naturalist Agent
----------------------------------------
  ✅ PASS: Agent name is naturalist
  ✅ PASS: Agent type is naturalist
  ✅ PASS: Tone is gentle
  ✅ PASS: Teaching style is Socratic
...
✅ Naturalist Agent tests completed

📚 TEST SUITE: Archivist Agent
----------------------------------------
  ✅ PASS: Agent name is archivist
  ✅ PASS: Agent type is archivist
  ✅ PASS: Tone is enthusiastic
  ✅ PASS: Teaching style is storyteller
...
✅ Archivist Agent tests completed

🤝 TEST SUITE: Agent Coordinator
----------------------------------------
...
✅ Agent Coordinator tests completed

🔗 TEST SUITE: End-to-End Integration
----------------------------------------
...
✅ Integration tests completed

==================================================
Test Summary: 45/45 passed (100%)
==================================================

✅ All test suites completed

🎉 All tests passed!
```

## Test Framework Features

The test suite includes:

### Custom Assertions
- `assertEqual()` - Value equality
- `assertNotEqual()` - Value inequality
- `assertTrue()` - Boolean truth
- `assertFalse()` - Boolean falsity
- `assertContains()` - String contains substring
- `assertGreaterThan()` - Numeric comparison
- `assertGreaterThanOrEqual()` - Numeric >=
- `assertLessThanOrEqual()` - Numeric <=
- `assertNotNull()` - Not null check
- `assertNull()` - Null check

### Mock Language Interface
Simulates LLM responses for testing without actual API calls:
- `setResponse(pattern, response)` - Configure mock responses
- Generates responses based on input patterns
- Simulates voice transcription delays

### Test Utilities
- `createMockMessage()` - Creates standardized message objects
- `sleep(ms)` - Async delay for timing tests
- `delay(ms)` - Async utility for test synchronization

## Understanding Test Results

### Success Indicators
- **✅ PASS**: Test succeeded
- **Test Summary X/Y passed (Z%)**: Overall success rate
- **🎉 All tests passed!**: Perfect test suite

### Failure Indicators
- **❌ FAIL**: Test failed
- **Test Summary X/Y passed**: Some tests failed
- **⚠️ X test(s) failed**: Number of failures

## Troubleshooting

### Common Issues

#### "Module not found" Errors
**Cause**: Import paths incorrect in test environment
**Solution**: Ensure test file is in correct location and imports use correct paths

#### Mock Interface Not Responding
**Cause**: Pattern matching fails in mock interface
**Solution**: Check that mock response patterns match actual query text

#### Timing Issues
**Cause**: Tests run too fast/slow for async operations
**Solution**: Adjust delay values in test utilities

#### Assertion Failures
**Cause**: Expected values don't match actual behavior
**Solution**: Review agent logic and update test expectations

## Next Steps

### 1. Run Initial Tests
Execute the test suite to validate current implementation:
```bash
# Execute tests
node Assets/AgenticPlayground/Scripts/Tests/AgentSystemTests.js
```

### 2. Review Results
- Identify any failing tests
- Review assertion messages for specific issues
- Check if failures are due to implementation or test expectations

### 3. Fix Issues
- Update agent implementations based on test failures
- Adjust mock responses if needed
- Verify routing logic produces expected behavior

### 4. Add Edge Cases
- Test unusual user queries
- Test coordination scenarios
- Test error handling and fallbacks

### 5. Integration Testing
- Test with real AgentLanguageInterface
- Test with actual LLM providers
- Test in-game or actual usage scenarios

## Continuous Testing

### Automated Testing
Set up automated test runs during development:
```typescript
// In your development setup
onAwake() {
  // Run tests in development mode
  if (this.enableDebugMode) {
    AgentSystemTests.runAllTests()
  }
}
```

### Test-Driven Development
- Write tests for new features before implementation
- Run tests frequently during development
- Use test failures to guide implementation

## Test Maintenance

### Keeping Tests Updated
- Update tests when agent behavior changes
- Add tests for new features
- Remove tests for deprecated functionality
- Update mock data to match real knowledge base

### Documentation
- Update this guide when adding new test suites
- Document test purposes and expected outcomes
- Keep test comments clear and helpful

---

**Version**: 1.0
**Last Updated**: 2025-01-15
**Status**: Ready for execution
