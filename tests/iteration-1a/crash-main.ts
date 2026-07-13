import { createDefaultBootstrapRegistry, type HostSurface } from "../../src/host/index.ts";
import type { LocalResourceFaultPhase } from "../../src/persistence/index.ts";
import { runProgram } from "../../src/cli/program.ts";

const phases = new Set<LocalResourceFaultPhase>([
  "after-rename",
  "removal-after-unlink",
  "removal-parent-directory-sync",
  "replacement-after-rename-before-mode",
  "replacement-parent-directory-sync",
  "replacement-target-file-sync",
]);

const phaseInput = process.env.GROMA_VERIFY_FAULT_PHASE;
const locator = process.env.GROMA_VERIFY_FAULT_LOCATOR;
const occurrence = Number(process.env.GROMA_VERIFY_FAULT_OCCURRENCE);
if (
  phaseInput === undefined ||
  !phases.has(phaseInput as LocalResourceFaultPhase) ||
  locator === undefined ||
  !Number.isSafeInteger(occurrence) ||
  occurrence <= 0
) {
  throw new Error("invalid Iteration 1A crash-verification configuration");
}
const phase = phaseInput as LocalResourceFaultPhase;
let matches = 0;

function createRegistry(surface: HostSurface) {
  return createDefaultBootstrapRegistry({
    resourceFaultInjector(currentPhase, context) {
      if (currentPhase !== phase || String(context?.locator) !== locator) return;
      matches += 1;
      if (matches === occurrence) process.exit(86);
    },
    surface,
  });
}

const exitCode = await runProgram(
  Bun.argv.slice(2),
  {
    writeError: (message) => process.stderr.write(message),
    writeOutput: (message) => process.stdout.write(message),
  },
  { createRegistry },
);

process.exitCode = exitCode;
