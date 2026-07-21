export interface ObservedAreaRecognition {
  readonly evidencePath: string;
  readonly label: string;
  readonly summary: string;
}

const conventionalAreaLabels: ReadonlyMap<string, string> = new Map([
  ["addon", "Add-ons"],
  ["addons", "Add-ons"],
  ["api", "API"],
  ["apis", "APIs"],
  ["app", "Application modules"],
  ["apps", "Applications"],
  ["application", "Application modules"],
  ["applications", "Applications"],
  ["asset", "Assets"],
  ["assets", "Assets"],
  ["bin", "Executables"],
  ["client", "Client modules"],
  ["cmd", "Executables"],
  ["common", "Common modules"],
  ["config", "Configuration"],
  ["configuration", "Configuration"],
  ["doc", "Documentation"],
  ["docs", "Documentation"],
  ["documentation", "Documentation"],
  ["example", "Examples"],
  ["examples", "Examples"],
  ["extension", "Extensions"],
  ["extensions", "Extensions"],
  ["infra", "Infrastructure"],
  ["infrastructure", "Infrastructure"],
  ["internal", "Internal modules"],
  ["lib", "Libraries"],
  ["libs", "Libraries"],
  ["libraries", "Libraries"],
  ["library", "Libraries"],
  ["module", "Modules"],
  ["modules", "Modules"],
  ["package", "Packages"],
  ["packages", "Packages"],
  ["pkg", "Packages"],
  ["pkgs", "Packages"],
  ["plugin", "Plugins"],
  ["plugins", "Plugins"],
  ["public", "Public assets"],
  ["sample", "Examples"],
  ["samples", "Examples"],
  ["script", "Scripts"],
  ["scripts", "Scripts"],
  ["server", "Server modules"],
  ["shared", "Shared modules"],
  ["source", "Source modules"],
  ["sources", "Source modules"],
  ["spec", "Tests"],
  ["specs", "Tests"],
  ["src", "Source modules"],
  ["static", "Static assets"],
  ["test", "Tests"],
  ["tests", "Tests"],
  ["tool", "Tools"],
  ["tools", "Tools"],
  ["ui", "User interface"],
  ["web", "Web modules"],
]);

const recognizedWords: ReadonlyMap<string, string> = new Map([
  ["api", "API"],
  ["cli", "CLI"],
  ["db", "DB"],
  ["devops", "DevOps"],
  ["github", "GitHub"],
  ["graphql", "GraphQL"],
  ["grpc", "gRPC"],
  ["http", "HTTP"],
  ["https", "HTTPS"],
  ["sdk", "SDK"],
  ["ui", "UI"],
]);

const recognizableAreaNouns: ReadonlySet<string> = new Set([
  "api",
  "apis",
  "application",
  "applications",
  "assets",
  "clients",
  "commands",
  "configuration",
  "documentation",
  "executables",
  "extensions",
  "features",
  "infrastructure",
  "interface",
  "interfaces",
  "libraries",
  "modules",
  "packages",
  "plugins",
  "routes",
  "scripts",
  "servers",
  "services",
  "tests",
  "tools",
]);

function humanizeSegment(segment: string): string {
  const words = segment
    .replaceAll(/([a-z\d])([A-Z])/g, "$1 $2")
    .replaceAll(/[._-]+/g, " ")
    .trim()
    .split(/\s+/u)
    .filter((word) => word.length > 0);
  if (words.length === 0) return "Observed area";
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      const recognized = recognizedWords.get(lower);
      if (recognized !== undefined) return recognized;
      return index === 0 ? `${lower[0]!.toUpperCase()}${lower.slice(1)}` : lower;
    })
    .join(" ");
}

function evidencePath(prefix: readonly string[]): string {
  return prefix.length === 0 ? "./" : `${prefix.join("/")}/`;
}

export function recognizeObservedArea(
  prefix: readonly string[],
  memberCount: number,
): ObservedAreaRecognition {
  const segment = prefix.at(-1);
  const path = evidencePath(prefix);
  const conventional =
    segment === undefined ? undefined : conventionalAreaLabels.get(segment.toLowerCase());
  const humanized = segment === undefined ? "Observed area" : humanizeSegment(segment);
  const namesArea = /\bareas?$/iu.test(humanized);
  const finalWord = humanized.split(" ").at(-1)?.toLowerCase();
  const namesRecognizableRole = finalWord !== undefined && recognizableAreaNouns.has(finalWord);
  const label =
    conventional ??
    (humanized === "Observed area" || namesArea || namesRecognizableRole
      ? humanized
      : `${humanized} area`);
  return Object.freeze({
    evidencePath: path,
    label,
    summary: `${memberCount} observed component${memberCount === 1 ? " shares" : "s share"} ${path}.`,
  });
}
