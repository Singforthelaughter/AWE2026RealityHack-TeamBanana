/**
 * Export all available tools for agents to use
 */

import {GeneralConversationTool} from "./GeneralConversationTool"
import {SpatialTool} from "./SpatialTool"
import {LocationTool} from "./LocationTool"
import {WeatherTool} from "./WeatherTool"
import {NearbySightingsTool} from "./NearbySightingsTool"
import {ButterflyIdentificationTool} from "./ButterflyIdentificationTool"
import {ButterflyDetectionTool} from "./ButterflyDetectionTool"
import {ButterflyIdentifier} from "_Aggy/Scripts/ButterflyIdentifier"
import {SupabaseDBManager} from "_Boon/SupabaseInfoStoring&Retrieving/Scripts/SupabaseDBManager"
import {MLSpatializer} from "_Aggy/Scripts/MLSpatializer"


export const AvailableTools = {
  GeneralConversationTool,
  SpatialTool,
  LocationTool,
  WeatherTool,
  NearbySightingsTool,
  ButterflyIdentificationTool,
  ButterflyDetectionTool
}

export type {
  GeneralConversationTool,
  SpatialTool,
  LocationTool,
  WeatherTool,
  NearbySightingsTool,
  ButterflyIdentificationTool,
  ButterflyDetectionTool
}

// Convenience factory for creating tool instances
// dbManager is optional — NearbySightingsTool is only created when it's provided
// butterflyIdentifier is optional — ButterflyIdentificationTool is only created when it's provided
// mlSpatializer is optional — ButterflyDetectionTool is only created when it's provided
export function createTools(
  languageInterface: any,
  dbManager?: SupabaseDBManager,
  butterflyIdentifier?: ButterflyIdentifier,
  mlSpatializer?: MLSpatializer
) {
  return {
    generalConversation: new GeneralConversationTool(languageInterface),
    spatial: new SpatialTool(languageInterface),
    location: new LocationTool(),
    weather: new WeatherTool(),
    nearbySightings: dbManager ? new NearbySightingsTool(dbManager) : null,
    butterflyIdentification: butterflyIdentifier ? new ButterflyIdentificationTool(butterflyIdentifier) : null,
    butterflyDetection: mlSpatializer ? new ButterflyDetectionTool(mlSpatializer) : null
  }
}
