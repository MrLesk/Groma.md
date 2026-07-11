import { fileURLToPath } from "node:url";
import path from "node:path";

import { checkArchitectureBoundaries } from "./architecture-boundaries.ts";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const sourceRoot = path.join(projectRoot, "src");
const violations = await checkArchitectureBoundaries(sourceRoot);

if (violations.length === 0) {
  console.log("Architecture boundaries are valid.");
} else {
  for (const violation of violations) {
    const specifier = violation.specifier === undefined ? "" : ` (${violation.specifier})`;
    console.error(`${violation.file}: ${violation.reason}${specifier}`);
  }
  process.exitCode = 1;
}
