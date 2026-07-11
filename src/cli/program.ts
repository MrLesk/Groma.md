export const GROMA_VERSION = "0.0.0";

export const HELP_TEXT = `Groma ${GROMA_VERSION}

Local-first architectural blueprints for humans and AI agents.

Usage:
  groma --help
  groma --version

Iteration 1A semantic commands will be added through shared application operations.
`;

export interface ProgramOutput {
  writeError(message: string): void;
  writeOutput(message: string): void;
}

export function runProgram(args: readonly string[], output: ProgramOutput): number {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    output.writeOutput(HELP_TEXT);
    return 0;
  }

  if (args.length === 1 && (args[0] === "--version" || args[0] === "-V")) {
    output.writeOutput(`${GROMA_VERSION}\n`);
    return 0;
  }

  output.writeError(`Unknown arguments: ${args.join(" ")}\nRun groma --help for usage.\n`);
  return 2;
}
