import { runProgram } from "./program.ts";

const exitCode = runProgram(Bun.argv.slice(2), {
  writeError: (message) => process.stderr.write(message),
  writeOutput: (message) => process.stdout.write(message),
});

process.exitCode = exitCode;
