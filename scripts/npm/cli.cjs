#!/usr/bin/env node
"use strict";

const { spawn } = require("node:child_process");
const { SUPPORTED_TARGETS, getPackageName, resolveBinaryPath } = require("./resolveBinary.cjs");

let binaryPath;
try {
  binaryPath = resolveBinaryPath();
} catch {
  console.error(
    `The ${getPackageName()} binary package is not installed for ${process.platform}-${process.arch}.`,
  );
  console.error(`groma.md ships binaries for: ${SUPPORTED_TARGETS.join(", ")}.`);
  console.error(
    "Reinstall groma.md with your package manager so its optional dependency can be selected.",
  );
  process.exit(1);
}

// Some global shims (for example bun's) prepend the resolved bin path to the arguments.
const cleanedArguments = process.argv.slice(2).filter((argument) => {
  if (argument === binaryPath) return false;
  return !/node_modules[/\\]groma\.md-(darwin|linux|windows)-[^/\\]+[/\\]groma(\.exe)?$/i.test(
    argument,
  );
});

const child = spawn(binaryPath, cleanedArguments, { stdio: "inherit", windowsHide: true });

child.on("exit", (code, signal) => {
  if (signal !== null) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code === null ? 0 : code);
});

child.on("error", (error) => {
  if (error.code === "ENOENT") {
    console.error(`The groma binary is missing at ${binaryPath}.`);
    console.error(`Reinstall groma.md for ${process.platform}-${process.arch}.`);
  } else {
    console.error("groma could not be started:", error);
  }
  process.exit(1);
});
