import type { PluginRegistrationValidationBounds } from "../core/index.ts";

/** Bounds shared by ordinary Host composition and preflight of local package entries. */
export const defaultHostPluginRegistrationBounds: PluginRegistrationValidationBounds =
  Object.freeze({
    maxCapabilitiesPerPlugin: 16,
    maxTokenCharacters: 128,
  });
