import { writeFile } from "node:fs/promises";
import path from "node:path";

import { runProgram } from "../../src/cli/program.ts";

const artifactArgument = Bun.argv[2];
if (artifactArgument === undefined) throw new Error("Artifact path is required");
const artifact = path.resolve(artifactArgument);
const exitCode = await runProgram(
  [],
  {
    writeError: (message) => process.stderr.write(message),
    writeOutput: (message) => process.stdout.write(message),
  },
  {
    presentBlueprint: async (html) => {
      await writeFile(artifact, html, { encoding: "utf8", mode: 0o600 });
      return artifact;
    },
    terminal: { stdin: true, stdout: true },
    workspaceRoot: process.cwd(),
  },
);
process.exitCode = exitCode;
