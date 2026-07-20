import tailwind from "bun-plugin-tailwind";

export interface StandaloneCompileOptions {
  readonly cwd: string;
  readonly entrypoint: string;
  readonly outputFile: string;
  readonly target?: string;
}

/**
 * One Bun.build call bundles the CLI, the embedded web client with its Tailwind
 * source, and compiles the standalone executable. `allowUnresolved: [""]` permits
 * exactly the audited fully opaque plugin import to stay unresolved for runtime
 * loading while every other dynamic specifier must resolve at build time; literal
 * imports remain covered by type-checking and the source-boundary checker. The
 * compiled executable autoloads no .env, bunfig.toml, tsconfig.json, or
 * package.json at runtime.
 */
export async function compileStandalone(options: StandaloneCompileOptions): Promise<number> {
  const previousDirectory = process.cwd();
  process.chdir(options.cwd);
  try {
    const result = await Bun.build({
      allowUnresolved: [""],
      compile: {
        autoloadBunfig: false,
        autoloadDotenv: false,
        autoloadPackageJson: false,
        autoloadTsconfig: false,
        outfile: options.outputFile,
        ...(options.target === undefined
          ? {}
          : { target: options.target as Bun.Build.CompileTarget }),
      },
      entrypoints: [options.entrypoint],
      minify: true,
      plugins: [tailwind],
      throw: false,
    });
    if (!result.success) {
      for (const log of result.logs) {
        console.error(log);
      }
      return 1;
    }
    return 0;
  } finally {
    process.chdir(previousDirectory);
  }
}
