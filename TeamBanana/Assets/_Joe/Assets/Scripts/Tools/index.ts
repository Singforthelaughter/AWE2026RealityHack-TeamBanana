/**
 * Export all available tools for agents to use
 */

import {GeneralConversationTool} from "./GeneralConversationTool"
import {SpatialTool} from "./SpatialTool"
import {LocationTool} from "./LocationTool"
import {WeatherTool} from "./WeatherTool"

export const AvailableTools = {
  GeneralConversationTool,
  SpatialTool,
  LocationTool,
  WeatherTool
}

export type {
  GeneralConversationTool,
  SpatialTool,
  LocationTool,
  WeatherTool
}

// Convenience factory for creating tool instances
export function createTools(languageInterface: any) {
  return {
    generalConversation: new GeneralConversationTool(languageInterface),
    spatial: new SpatialTool(languageInterface),
    location: new LocationTool(),
    weather: new WeatherTool()
  }
}
