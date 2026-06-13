/**
 * Example: How agents can use LocationTool and WeatherTool together
 * to get environmental data for butterfly habitat analysis
 */

import {LocationTool} from "./LocationTool"
import {WeatherTool} from "./WeatherTool"

/**
 * Example: Naturalist Agent fetching environmental context
 */
export async function fetchEnvironmentalContextForButterflies() {
  const locationTool = new LocationTool()
  const weatherTool = new WeatherTool()

  // Get current location
  const locationResult = await locationTool.execute({})
  if (!locationResult.success || !locationResult.result) {
    print("Failed to get location")
    return null
  }

  // Get current weather
  const weatherResult = await weatherTool.execute({useCelsius: true})
  if (!weatherResult.success || !weatherResult.result) {
    print("Failed to get weather")
    return null
  }

  // Build environmental context object
  // This can be passed to SpatialTool with butterflyHabitatFocus enabled
  const environmentalContext = {
    location: locationResult.result,
    weather: weatherResult.result,
    habitatConditions: {
      sunlight: weatherTool.getSunlightLevel(), // "direct" | "filtered" | "shade"
      temperature: weatherResult.result.temperature,
      windLevel: weatherTool.getWindLevel() // "calm" | "moderate" | "windy"
    }
  }

  return environmentalContext
}

/**
 * Example usage in agent:
 *
 * ```typescript
 * // In NaturalistAgent or ArchivistAgent
 * const envContext = await fetchEnvironmentalContextForButterflies()
 *
 * if (envContext?.weather.butterflyActivityLevel === "high") {
 *   // Suggest butterfly observation
 *   return "Weather is perfect for butterfly watching! Let me help you spot some."
 * } else if (envContext?.weather.butterflyActivityLevel === "low") {
 *   // Suggest alternative activities
 *   return "Butterflies might be less active right now due to weather. Want to learn about butterfly habitats instead?"
 * }
 *
 * // Pass to SpatialTool for habitat analysis
 * const spatialResult = await spatialTool.execute({
 *   query: "What butterflies might be here?",
 *   butterflyHabitatFocus: true,
 *   environmentalConditions: envContext.habitatConditions
 * })
 * ```
 */
