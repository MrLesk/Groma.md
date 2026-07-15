export interface StandaloneCompileOptions {
  readonly cwd: string;
  readonly entrypoint: string;
  readonly outputFile: string;
  readonly target?: string;
}

export async function compileStandalone(options: StandaloneCompileOptions): Promise<number> {
  const command = [
    process.execPath,
    "build",
    "--compile",
    "--minify",
    // Keep exactly the audited opaque plugin import unresolved for runtime loading. Literal
    // imports remain covered by type-checking and the repository's source-boundary checker.
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
