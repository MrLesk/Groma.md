import { createLocalResourceProvider } from "../../local-resource-provider.ts";
import { parseWorkspaceResourceLocator } from "../../contracts.ts";

function send(message: unknown): void {
  if (typeof process.send !== "function") throw new Error("coordination fixture requires Bun IPC");
  process.send(message);
}

const [workspaceRoot, coordinationRoot, locatorInput] = process.argv.slice(2);
if (workspaceRoot === undefined || coordinationRoot === undefined || locatorInput === undefined) {
  throw new Error("coordination fixture requires workspace, coordination, and locator arguments");
}

const locator = parseWorkspaceResourceLocator(locatorInput);
if (!locator.ok) throw new Error("coordination fixture received an invalid locator");

let release!: () => void;
const released = new Promise<void>((resolve) => {
  release = resolve;
});
const onMessage = (message: unknown): void => {
  if (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "release"
  ) {
    release();
  }
};
process.on("message", onMessage);

try {
  const provider = await createLocalResourceProvider({ coordinationRoot, workspaceRoot });
  const result = await provider.withCoordination(
    { context: "local-machine", locator: locator.value },
    async () => {
      send({ type: "ready" });
      await released;
    },
  );
  send({
    ...(result.ok ? {} : { code: result.diagnostics[0]?.code }),
    ok: result.ok,
    type: "done",
  });
  if (!result.ok) process.exitCode = 1;
} catch {
  send({ type: "error" });
  process.exitCode = 1;
} finally {
  process.off("message", onMessage);
  process.disconnect?.();
}
