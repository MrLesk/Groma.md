import { fileURLToPath } from "node:url";

import { generateWebStylesheet } from "./web-stylesheet.ts";

export interface StandaloneCompileOptions {
  readonly cwd: string;
  readonly entrypoint: string;
  readonly outputFile: string;
  readonly target?: string;
}

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

export async function compileStandalone(options: StandaloneCompileOptions): Promise<number> {
  const stylesheet = await generateWebStylesheet(projectRoot);
  if (stylesheet !== 0) return stylesheet;
  const command = [
    process.execPath,
    "build",
    "--compile",
    "--minify",
    // Keep exactly the audited opaque plugin import unresolved for runtime loading. The empty
    // value is deliberate Bun argv syntax equivalent to --allow-unresolved=; it prevents the
    // following flag from becoming an allowlist value while literal imports remain covered by
    // type-checking and the repository's source-boundary checker.
    "--allow-unresolved",
    "",
    "--no-compile-autoload-dotenv",
    "--no-compile-autoload-bunfig",
    "--no-compile-autoload-tsconfig",
    "--no-compile-autoload-package-json",
    ...(options.target === undefined ? [] : [`--target=${options.target}`]),
    `--outfile=${options.outputFile}`,
    options.entrypoint,
  ];
  const build = Bun.spawn({
    cmd: command,
    cwd: options.cwd,
    stderr: "inherit",
    stdout: "inherit",
  });
  return build.exited;
}
