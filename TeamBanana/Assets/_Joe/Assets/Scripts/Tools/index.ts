/**
 * Export all available tools for agents to use
 */

import {GeneralConversationTool} from "./GeneralConversationTool"
import {SpatialTool} from "./SpatialTool"
import {LocationTool} from "./LocationTool"
import {WeatherTool} from "./WeatherTool"
import {NearbySightingsTool} from "./NearbySightingsTool"
import {ButterflyIdentificationTool} from "./ButterflyIdentificationTool"
import {ButterflyIdentifier} from "_Aggy/Scripts/ButterflyIdentifier"
import {SupabaseDBManager} from "_Boon/SupabaseInfoStoring&Retrieving/Scripts/SupabaseDBManager"

export const AvailableTools = {
  GeneralConversationTool,
  SpatialTool,
  LocationTool,
  WeatherTool,
  NearbySightingsTool,
  ButterflyIdentificationTool
}

export type {
  GeneralConversationTool,
  SpatialTool,
  LocationTool,
  WeatherTool,
  NearbySightingsTool,
  ButterflyIdentificationTool
}

// Convenience factory for creating tool instances
// dbManager is optional — NearbySightingsTool is only created when it's provided
// butterflyIdentifier is optional — ButterflyIdentificationTool is only created when it's provided
export function createTools(languageInterface: any, dbManager?: SupabaseDBManager, butterflyIdentifier?: ButterflyIdentifier) {
  return {
    generalConversation: new GeneralConversationTool(languageInterface),
    spatial: new SpatialTool(languageInterface),
    location: new LocationTool(),
    weather: new WeatherTool(),
    nearbySightings: dbManager ? new NearbySightingsTool(dbManager) : null,
    butterflyIdentification: butterflyIdentifier ? new ButterflyIdentificationTool(butterflyIdentifier) : null
  }
}
