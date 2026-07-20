import { chmod, copyFile, mkdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

export interface InstallOptions {
  readonly destination?: string;
  readonly skipBuild: boolean;
  /** Overridable for tests; defaults to the built native executable. */
  readonly source?: string;
}

export interface InstallOutcome {
  readonly installedPath: string;
  readonly version: string;
}

function parseOptions(args: readonly string[]): InstallOptions {
  let destination: string | undefined;
  let skipBuild = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--skip-build") skipBuild = true;
    else if (argument === "--dest" && args[index + 1] !== undefined) {
      destination = args[index + 1];
      index += 1;
    } else if (argument?.startsWith("--dest=")) {
      destination = argument.slice("--dest=".length);
    } else {
      throw new Error("Usage: bun run install:local [--dest <directory>] [--skip-build]");
    }
  }
  return { ...(destination === undefined ? {} : { destination }), skipBuild };
}

async function directoryExists(candidate: string): Promise<boolean> {
  try {
    return (await stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}

async function resolveDestination(explicit: string | undefined): Promise<string> {
  if (explicit !== undefined) {
    await mkdir(explicit, { recursive: true });
    return path.resolve(explicit);
  }
  const home = homedir();
  const localBin = path.join(home, ".local", "bin");
  if (await directoryExists(localBin)) return localBin;
  const bunBin = path.join(home, ".bun", "bin");
  if (await directoryExists(bunBin)) return bunBin;
  await mkdir(localBin, { recursive: true });
  return localBin;
}

export async function installGroma(options: InstallOptions): Promise<InstallOutcome> {
  const executableName = process.platform === "win32" ? "groma.exe" : "groma";
  const source = options.source ?? path.join(projectRoot, "dist", executableName);
  if (!options.skipBuild && options.source === undefined) {
    const build = Bun.spawn({
      cmd: [process.execPath, "run", path.join(projectRoot, "scripts", "build.ts")],
      cwd: projectRoot,
      stderr: "inherit",
      stdout: "inherit",
    });
    if ((await build.exited) !== 0) throw new Error("The native build failed; nothing installed");
  }
  try {
    const built = await stat(source);
    if (!built.isFile() || built.size === 0) throw new Error("empty");
  } catch {
    throw new Error(`No executable at ${source}; run bun run build first`);
  }
  const destinationDirectory = await resolveDestination(options.destination);
  const installedPath = path.join(destinationDirectory, executableName);
  await copyFile(source, installedPath);
  await chmod(installedPath, 0o755);
  const probe = Bun.spawn({ cmd: [installedPath, "--version"], stderr: "pipe", stdout: "pipe" });
  const version = (await new Response(probe.stdout).text()).trim();
  if ((await probe.exited) !== 0 || version.length === 0) {
    throw new Error(`The installed executable at ${installedPath} did not answer --version`);
  }
  return { installedPath, version };
}

if (import.meta.main) {
  const hasExplicitDestination = Bun.argv.some(
    (argument) => argument === "--dest" || argument.startsWith("--dest="),
  );
  if (process.platform === "win32" && !hasExplicitDestination) {
    console.error(
      "On Windows, copy dist\\groma.exe into a directory on your PATH, or pass --dest <directory>.",
    );
    process.exit(1);
  }
  const options = parseOptions(Bun.argv.slice(2));
  const outcome = await installGroma(options);
  console.log(`Installed groma ${outcome.version} at ${outcome.installedPath}`);
  const destinationDirectory = path.dirname(outcome.installedPath);
  const onPath = (process.env.PATH ?? "").split(path.delimiter).includes(destinationDirectory);
  if (!onPath) {
    console.log(`That directory is not on your PATH. Add it, for example:`);
    console.log(`  export PATH="${destinationDirectory}:$PATH"`);
  }
  console.log("If your shell cached an old lookup, run: rehash");
}
