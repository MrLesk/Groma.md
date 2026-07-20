import { GROMA_VERSION } from "./help.ts";
import { INSTRUCTION_GUIDES } from "./instructions/index.ts";

/**
 * The plain-text entry splash for bare `groma` when it cannot open the visual
 * blueprint: no workspace yet, or a non-interactive terminal. Color is applied only
 * when explicitly requested; the uncolored output is byte-deterministic. The
 * wordmark stays lowercase `groma.md`; green is reserved for the surveyed point and
 * the `.md` suffix, matching the canonical lockup's accent exception.
 */

const ANSI = Object.freeze({
  accent: "\u001B[38;2;29;158;117m",
  bold: "\u001B[1m",
  reset: "\u001B[0m",
});

export interface SplashOptions {
  readonly color: boolean;
  readonly workspace: "missing" | "ready";
}

function commandLine(command: string, description: string): string {
  return `  ${command.padEnd(38)} ${description}`;
}

export function formatSplash({ color, workspace }: SplashOptions): string {
  const paint = (value: string, code: string) => (color ? `${code}${value}${ANSI.reset}` : value);
  const section = (value: string) => paint(value, ANSI.bold);
  const wordmark = `${paint("◉", ANSI.accent)} ${paint("groma", ANSI.bold)}${paint(".md", ANSI.accent)} v${GROMA_VERSION}`;
  const lines: string[] = [
    wordmark,
    "Groma keeps a living map of your system's architecture inside your repo.",
    "",
  ];
  if (workspace === "missing") {
    lines.push("No groma workspace exists in this directory yet.", "");
    lines.push(section("Get started:"));
    lines.push(commandLine("groma init", "Create the groma/ workspace in this repo"));
    lines.push(commandLine("groma scan", "Look at the code and record what is really there"));
    lines.push(commandLine("groma", "Open the visual blueprint (interactive terminal)"));
    lines.push(commandLine("groma web", "Serve the interactive blueprint on 127.0.0.1"));
    lines.push(
      commandLine("groma blueprint export --limit 20", "Read the map as bounded JSON pages"),
    );
  } else {
    lines.push(
      "Run bare groma in an interactive terminal to open the bounded local visual blueprint.",
      "",
    );
    lines.push(section("Common commands:"));
    lines.push(commandLine("groma scan", "Refresh the evidence from the code"));
    lines.push(commandLine("groma web", "Serve the interactive blueprint on 127.0.0.1"));
    lines.push(
      commandLine("groma blueprint export --limit 20", "Read the map as bounded JSON pages"),
    );
    lines.push(commandLine("groma --format json", "Read the same bounded hierarchy as data"));
  }
  lines.push("");
  lines.push(section("Instructions:"));
  lines.push(commandLine("groma instructions", "List the built-in guides"));
  for (const guide of INSTRUCTION_GUIDES) {
    lines.push(commandLine(`groma instructions ${guide.key}`, guide.description));
  }
  lines.push("");
  lines.push(section("Command help:"));
  lines.push(commandLine("groma --help", "Every command, option, and bound"));
  lines.push("");
  return `${lines.join("\n")}\n`;
}
