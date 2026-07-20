import { mkdtemp, mkdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

interface VerificationOptions {
  readonly executable: string;
  readonly skipRun: boolean;
}

function parseOptions(args: readonly string[]): VerificationOptions {
  let executable: string | undefined;
  let skipRun = false;
  for (const argument of args) {
    if (argument === "--skip-run") skipRun = true;
    else if (argument.startsWith("--executable=")) executable = argument.slice(13);
    else throw new Error("Usage: verify-binary [--executable=<path>] [--skip-run]");
  }
  return {
    executable: path.resolve(
      projectRoot,
      executable ?? path.join("dist", process.platform === "win32" ? "groma.exe" : "groma"),
    ),
    skipRun,
  };
}

async function run(executable: string, args: readonly string[], cwd = projectRoot): Promise<void> {
  const child = Bun.spawn({
    cmd: [executable, ...args],
    cwd,
    stderr: "inherit",
    stdout: "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) throw new Error(`${path.basename(executable)} ${args.join(" ")} failed`);
}

async function runJson(
  executable: string,
  args: readonly string[],
  cwd: string,
): Promise<Record<string, unknown>> {
  const child = Bun.spawn({
    cmd: [executable, "--format=json", ...args],
    cwd,
    stderr: "inherit",
    stdout: "pipe",
  });
  const output = await new Response(child.stdout).text();
  const exitCode = await child.exited;
  if (exitCode !== 0) throw new Error(`${path.basename(executable)} ${args.join(" ")} failed`);
  const parsed = JSON.parse(output);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${path.basename(executable)} ${args.join(" ")} returned invalid JSON`);
  }
  return parsed as Record<string, unknown>;
}

async function runInteractiveJson(
  executable: string,
  cwd: string,
): Promise<Record<string, unknown>> {
  const chunks: Uint8Array[] = [];
  const terminal = new Bun.Terminal({
    cols: 4_096,
    data: (_terminal, data) => chunks.push(data.slice()),
    rows: 40,
  });
  try {
    const child = Bun.spawn({
      cmd: [executable, "--format=json"],
      cwd,
      terminal,
    });
    const timeout = setTimeout(() => child.kill(), 15_000);
    try {
      const exitCode = await child.exited;
      if (exitCode !== 0) throw new Error(`${path.basename(executable)} overview failed`);
    } finally {
      clearTimeout(timeout);
    }
  } finally {
    terminal.close();
  }
  const output = stripVTControlCharacters(new TextDecoder().decode(Buffer.concat(chunks)))
    .replaceAll("\r", "")
    .trim();
  const parsed = JSON.parse(output);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${path.basename(executable)} overview returned invalid JSON`);
  }
  return parsed as Record<string, unknown>;
}

async function verifyWebServer(executable: string, cwd: string): Promise<void> {
  const child = Bun.spawn({
    cmd: [executable, "web", "--port", "0"],
    cwd,
    stderr: "inherit",
    stdout: "pipe",
  });
  const reader = child.stdout.getReader();
  const decoder = new TextDecoder();
  const deadline = setTimeout(() => child.kill(), 15_000);
  try {
    let buffered = "";
    while (!buffered.includes("Serving the current blueprint at ")) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error("Compiled web server did not announce its URL");
      buffered += decoder.decode(chunk.value, { stream: true });
    }
    const url = /http:\/\/127\.0\.0\.1:\d+\//.exec(buffered)?.[0];
    if (url === undefined) throw new Error("Compiled web server URL was not loopback");
    const document = await fetch(url);
    const documentText = await document.text();
    if (!document.ok || !documentText.includes('<div id="root">')) {
      throw new Error("Compiled web server did not serve the embedded shell");
    }
    const scriptPath = /<script[^>]+src="([^"]+)"/.exec(documentText)?.[1];
    const stylesheetPath = /<link[^>]+href="([^"]+\.css)"/.exec(documentText)?.[1];
    if (scriptPath === undefined || stylesheetPath === undefined) {
      throw new Error("Compiled web shell did not reference its bundled client assets");
    }
    const [script, stylesheet] = await Promise.all([
      fetch(new URL(scriptPath, url)),
      fetch(new URL(stylesheetPath, url)),
    ]);
    const [scriptText, stylesheetText] = await Promise.all([script.text(), stylesheet.text()]);
    if (
      !script.ok ||
      !scriptText.includes("react-flow-dagre") ||
      !scriptText.includes("Component scale notation")
    ) {
      throw new Error("Compiled web client did not contain the React Flow blueprint renderer");
    }
    if (
      !stylesheet.ok ||
      !stylesheetText.includes("groma-node--system") ||
      !stylesheetText.includes("groma-title-block")
    ) {
      throw new Error("Compiled web client did not contain scale notation styles");
    }
    const roots = await fetch(`${url}api/roots?limit=5`);
    const rootsBody = (await roots.json()) as { readonly ok?: unknown };
    if (!roots.ok || rootsBody.ok !== true) {
      throw new Error("Compiled web server did not answer a bounded read");
    }
    child.kill("SIGINT");
    const exitCode = await child.exited;
    // Windows signal emulation terminates without the graceful shutdown path.
    if (process.platform !== "win32" && exitCode !== 0) {
      throw new Error("Compiled web server did not stop cleanly");
    }
  } finally {
    clearTimeout(deadline);
    reader.releaseLock();
  }
}

const options = parseOptions(Bun.argv.slice(2));
const artifact = await stat(options.executable);
if (!artifact.isFile() || artifact.size === 0) throw new Error("Executable artifact is empty");

if (!options.skipRun) {
  await run(options.executable, ["--version"]);
  await run(options.executable, ["--help"]);
  const root = await mkdtemp(path.join(tmpdir(), "groma-smoke-"));
  {
    const child = Bun.spawn({
      cmd: [options.executable, "instructions", "overview"],
      cwd: root,
      stderr: "inherit",
      stdout: "pipe",
    });
    const text = await new Response(child.stdout).text();
    if ((await child.exited) !== 0 || !text.includes("Intent")) {
      throw new Error("Compiled instructions guide was not served from the binary");
    }
  }
  const workspace = path.join(root, "workspace");
  await mkdir(path.join(workspace, "src"), { recursive: true });
  await writeFile(path.join(workspace, "package.json"), JSON.stringify({ name: "groma-smoke" }));
  await writeFile(
    path.join(workspace, "src", "index.ts"),
    "export function inspectArchitecture() { return 'ready'; }\n",
  );
  await runJson(options.executable, ["init"], workspace);
  const scan = await runJson(options.executable, ["scan"], workspace);
  const scanResult = scan.result as Record<string, unknown> | undefined;
  if (scan.ok !== true || scanResult?.status !== "completed") {
    throw new Error("Compiled scan workflow did not complete");
  }
  const components = await runJson(
    options.executable,
    ["component", "list", "--limit", "10"],
    workspace,
  );
  const componentResult = components.result as
    { readonly ok?: unknown; readonly value?: { readonly items?: unknown[] } } | undefined;
  if (
    components.ok !== true ||
    componentResult?.ok !== true ||
    !Array.isArray(componentResult.value?.items) ||
    componentResult.value.items.length === 0
  ) {
    throw new Error("Compiled scan workflow did not produce a blueprint component");
  }
  const overview = await runInteractiveJson(options.executable, workspace);
  const overviewResult = overview.result as
    | { readonly kind?: unknown; readonly nodes?: readonly { readonly displayText?: unknown }[] }
    | undefined;
  if (
    overview.ok !== true ||
    overviewResult?.kind !== "hierarchy" ||
    !Array.isArray(overviewResult.nodes) ||
    overviewResult.nodes.length === 0 ||
    overviewResult.nodes.length > 256 ||
    !overviewResult.nodes.some((node) => node.displayText === "groma-smoke")
  ) {
    throw new Error("Compiled visual overview was not bounded or evidence-grounded");
  }
  await verifyWebServer(options.executable, workspace);
}
