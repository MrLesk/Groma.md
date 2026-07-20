"use strict";

/**
 * Resolve the platform-specific groma binary installed through the groma.md
 * package's optionalDependencies. Mirrors the backlog.md distribution shape.
 */

const SUPPORTED_TARGETS = ["darwin-arm64", "linux-x64", "windows-arm64", "windows-x64"];

function mapPlatform(platform = process.platform) {
  return platform === "win32" ? "windows" : platform;
}

function mapArch(arch = process.arch) {
  return arch;
}

function getPackageName(platform = process.platform, arch = process.arch) {
  return `groma.md-${mapPlatform(platform)}-${mapArch(arch)}`;
}

function getBinaryFileName(platform = process.platform) {
  return platform === "win32" ? "groma.exe" : "groma";
}

function resolveBinaryPath(platform = process.platform, arch = process.arch) {
  return require.resolve(`${getPackageName(platform, arch)}/${getBinaryFileName(platform)}`);
}

module.exports = { SUPPORTED_TARGETS, getBinaryFileName, getPackageName, resolveBinaryPath };
