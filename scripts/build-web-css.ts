import { fileURLToPath } from "node:url";

import { generateWebStylesheet } from "./web-stylesheet.ts";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const exitCode = await generateWebStylesheet(projectRoot);
if (exitCode !== 0) {
  console.error("Tailwind CSS generation failed");
  process.exit(exitCode);
}
console.log("Generated the embedded web stylesheet");
