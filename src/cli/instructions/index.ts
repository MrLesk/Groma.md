import curation from "./curation.md" with { type: "text" };
import overview from "./overview.md" with { type: "text" };
import reading from "./reading.md" with { type: "text" };
import scanning from "./scanning.md" with { type: "text" };

export interface InstructionGuide {
  readonly description: string;
  readonly key: string;
  readonly markdown: string;
  readonly title: string;
}

/** Embedded self-describing guides; static content, available before any workspace. */
export const INSTRUCTION_GUIDES: readonly InstructionGuide[] = Object.freeze([
  Object.freeze({
    description: "What Groma is: intent, evidence, and the working loop",
    key: "overview",
    markdown: overview.trim(),
    title: "Groma Overview",
  }),
  Object.freeze({
    description: "Projects, scanners, and rescans that never erase intent",
    key: "scanning",
    markdown: scanning.trim(),
    title: "Scanning",
  }),
  Object.freeze({
    description: "Creating and changing components, containment, and merges safely",
    key: "curation",
    markdown: curation.trim(),
    title: "Curation",
  }),
  Object.freeze({
    description: "Bounded reads: search, detail, export, traverse, and the web view",
    key: "reading",
    markdown: reading.trim(),
    title: "Reading the Map",
  }),
]);

export const INSTRUCTION_GUIDE_KEYS: readonly string[] = Object.freeze(
  INSTRUCTION_GUIDES.map((guide) => guide.key),
);

export function instructionGuide(key: string): InstructionGuide | undefined {
  return INSTRUCTION_GUIDES.find((guide) => guide.key === key);
}

export function instructionIndexText(): string {
  const lines = [
    "Groma instructions",
    "",
    "Start here:",
    "  groma instructions overview      Required first read: intent, evidence, and the loop",
    "  groma <command> --help           Options, fields, and bounds for one command",
    "",
    "Guides:",
  ];
  for (const guide of INSTRUCTION_GUIDES) {
    lines.push(`  groma instructions ${guide.key.padEnd(12)} ${guide.description}`);
  }
  lines.push("");
  return lines.join("\n");
}
