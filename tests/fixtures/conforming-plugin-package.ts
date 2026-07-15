import {
  definePlugin,
  definePluginPackage,
  pluginPackageManifestApiVersion,
  pluginRuntimeApiVersion,
  pluginSdkApiVersion,
  type PluginCapabilityDeclaration,
  type PluginRegistration,
} from "groma/plugin-sdk";

const greeting: PluginCapabilityDeclaration = Object.freeze({
  cardinality: "single",
  id: "example.greeting/v1",
  version: "1.0.0",
});
const presentation: PluginCapabilityDeclaration = Object.freeze({
  cardinality: "single",
  id: "example.presentation/v1",
  version: "1.0.0",
});

export const packageManifest = definePluginPackage({
  apiVersion: pluginPackageManifestApiVersion,
  name: "@example/groma-greeting",
  plugins: ["./plugins/greeting.js", "./plugins/presentation.js"],
  runtimeApiVersion: pluginRuntimeApiVersion,
  sdkApiVersion: pluginSdkApiVersion,
  version: "1.0.0",
});

export interface GreetingCapability {
  greet(name: string): string;
}

export function createPluginRegistrations(events: string[] = []): readonly PluginRegistration[] {
  const provider = definePlugin({
    manifest: {
      apiVersion: pluginRuntimeApiVersion,
      id: "example.greeting",
      phase: 1,
      provides: [greeting],
      requires: [],
      version: "1.0.0",
    },
    start: () => {
      events.push("greeting:start");
      return {
        capabilities: [
          {
            id: greeting.id,
            value: Object.freeze({ greet: (name: string) => `Hello, ${name}.` }),
            version: greeting.version,
          },
        ],
        stop: () => {
          events.push("greeting:stop");
        },
      };
    },
  });
  const consumer = definePlugin({
    manifest: {
      apiVersion: pluginRuntimeApiVersion,
      id: "example.presentation",
      phase: 1,
      provides: [presentation],
      requires: [greeting],
      version: "1.0.0",
    },
    start: (context) => {
      events.push("presentation:start");
      const value = context.requirements[0]?.providers[0]?.value as GreetingCapability;
      return {
        capabilities: [
          {
            id: presentation.id,
            value: Object.freeze({ preview: () => value.greet("Groma") }),
            version: presentation.version,
          },
        ],
        stop: () => {
          events.push("presentation:stop");
        },
      };
    },
  });
  return Object.freeze([provider, consumer]);
}

export const greetingCapability = greeting;
export const presentationCapability = presentation;
