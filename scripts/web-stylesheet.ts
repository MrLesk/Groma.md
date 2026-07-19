import path from "node:path";

/**
 * Generate the embedded web stylesheet from the Tailwind source with the pinned
 * toolchain. The output is a gitignored build artifact linked by the web client;
 * every compile path regenerates it so the embedded bundle is never stale.
 */
export async function generateWebStylesheet(projectRoot: string): Promise<number> {
  const source = path.join(projectRoot, "src", "web", "client", "styles.css");
  const output = path.join(projectRoot, "src", "web", "client", "styles.generated.css");
  const build = Bun.spawn({
    cmd: [process.execPath, "x", "tailwindcss", "--input", source, "--output", output, "--minify"],
    cwd: projectRoot,
    stderr: "inherit",
    stdout: "ignore",
  });
  return build.exited;
}
