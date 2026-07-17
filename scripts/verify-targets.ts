import { open } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const iterationOneAVerification = "tests/iteration-1a/verify.ts";
const foundationVerification = "tests/iteration-1b/verify-foundation.ts";
const selfBlueprintVerification = "tests/iteration-1b/verify-self-blueprint.ts";

interface Target {
  readonly architecture: "arm64" | "x64";
  readonly executable: "dist/groma" | "dist/groma.exe";
  readonly platform: "darwin" | "linux" | "win32";
  readonly target: string;
}

const targets: readonly Target[] = [
  {
    architecture: "arm64",
    executable: "dist/groma",
    platform: "darwin",
    target: "bun-darwin-arm64",
  },
  {
    architecture: "x64",
    executable: "dist/groma",
    platform: "linux",
    target: "bun-linux-x64-baseline",
  },
  {
    architecture: "x64",
    executable: "dist/groma.exe",
    platform: "win32",
    target: "bun-windows-x64-baseline",
  },
  {
    architecture: "arm64",
    executable: "dist/groma.exe",
    platform: "win32",
    target: "bun-windows-arm64",
  },
];

async function run(command: readonly string[]): Promise<void> {
  const child = Bun.spawn({
    cmd: [...command],
    cwd: projectRoot,
    stderr: "inherit",
    stdout: "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    throw new Error(`${command.join(" ")} exited with code ${exitCode}`);
  }
}

function hasPrefix(bytes: Uint8Array, expected: readonly number[]): boolean {
  return expected.every((value, index) => bytes[index] === value);
}

function checkedTableEnd(offset: number, entrySize: number, count: number): number | undefined {
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    !Number.isSafeInteger(entrySize) ||
    entrySize <= 0 ||
    !Number.isSafeInteger(count) ||
    count <= 0
  ) {
    return undefined;
  }
  const length = entrySize * count;
  const end = offset + length;
  return Number.isSafeInteger(length) && Number.isSafeInteger(end) ? end : undefined;
}

function checkedSpanEnd(offset: number, length: number): number | undefined {
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length < 0) {
    return undefined;
  }
  const end = offset + length;
  return Number.isSafeInteger(end) ? end : undefined;
}

function boundedUint64(view: DataView, offset: number): number | undefined {
  const value = view.getBigUint64(offset, true);
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : undefined;
}

function verifyMachOHeader(
  target: Target,
  header: Uint8Array,
  view: DataView,
  fileSize: number,
): void {
  if (
    header.byteLength < 32 ||
    !hasPrefix(header, [0xcf, 0xfa, 0xed, 0xfe]) ||
    view.getUint32(4, true) !== 0x0100000c
  ) {
    throw new Error(`${target.target} is not a Mach-O arm64 image`);
  }
  if (view.getUint32(12, true) !== 0x00000002) {
    throw new Error(`${target.target} is not a Mach-O MH_EXECUTE image`);
  }

  const loadCommandOffset = 32;
  const loadCommandCount = view.getUint32(16, true);
  const loadCommandBytes = view.getUint32(20, true);
  const loadCommandEnd = checkedSpanEnd(loadCommandOffset, loadCommandBytes);
  if (
    loadCommandCount === 0 ||
    loadCommandBytes === 0 ||
    loadCommandCount > Math.floor(loadCommandBytes / 8) ||
    loadCommandEnd === undefined ||
    loadCommandEnd > header.byteLength ||
    loadCommandEnd > fileSize
  ) {
    throw new Error(`${target.target} has an invalid Mach-O load-command table`);
  }

  const executableSegments: {
    readonly fileBytes: number;
    readonly fileOffset: number;
    readonly virtualAddress: number;
    readonly virtualEnd: number;
  }[] = [];
  let entryOffset: number | undefined;
  let offset = loadCommandOffset;
  for (let index = 0; index < loadCommandCount; index += 1) {
    const commandHeaderEnd = checkedSpanEnd(offset, 8);
    if (commandHeaderEnd === undefined || commandHeaderEnd > loadCommandEnd) {
      throw new Error(`${target.target} has a truncated Mach-O load command`);
    }
    const command = view.getUint32(offset, true);
    const commandSize = view.getUint32(offset + 4, true);
    const commandEnd = checkedSpanEnd(offset, commandSize);
    if (
      commandSize < 8 ||
      commandSize % 8 !== 0 ||
      commandEnd === undefined ||
      commandEnd > loadCommandEnd
    ) {
      throw new Error(`${target.target} has an invalid Mach-O load command size`);
    }

    if (command === 0x00000019) {
      if (commandSize < 72) {
        throw new Error(`${target.target} has a truncated Mach-O LC_SEGMENT_64 command`);
      }
      const sectionCount = view.getUint32(offset + 64, true);
      const sectionBytes = sectionCount * 80;
      const sectionEnd = checkedSpanEnd(offset + 72, sectionBytes);
      if (!Number.isSafeInteger(sectionBytes) || sectionEnd !== commandEnd) {
        throw new Error(`${target.target} has an invalid Mach-O LC_SEGMENT_64 section table`);
      }
      const virtualAddress = boundedUint64(view, offset + 24);
      const virtualBytes = boundedUint64(view, offset + 32);
      const fileOffset = boundedUint64(view, offset + 40);
      const fileBytes = boundedUint64(view, offset + 48);
      const virtualEnd =
        virtualAddress === undefined || virtualBytes === undefined
          ? undefined
          : checkedSpanEnd(virtualAddress, virtualBytes);
      const segmentEnd =
        fileOffset === undefined || fileBytes === undefined
          ? undefined
          : checkedSpanEnd(fileOffset, fileBytes);
      if (
        virtualAddress === undefined ||
        virtualBytes === undefined ||
        virtualEnd === undefined ||
        fileOffset === undefined ||
        fileBytes === undefined ||
        fileBytes > virtualBytes ||
        segmentEnd === undefined ||
        segmentEnd > fileSize
      ) {
        throw new Error(`${target.target} has an out-of-bounds Mach-O segment`);
      }

      for (let sectionIndex = 0; sectionIndex < sectionCount; sectionIndex += 1) {
        const sectionOffset = checkedSpanEnd(offset + 72, sectionIndex * 80);
        const sectionRecordEnd =
          sectionOffset === undefined ? undefined : checkedSpanEnd(sectionOffset, 80);
        if (
          sectionOffset === undefined ||
          sectionRecordEnd === undefined ||
          sectionRecordEnd > commandEnd
        ) {
          throw new Error(`${target.target} has a truncated Mach-O section_64 record`);
        }
        const sectionAddress = boundedUint64(view, sectionOffset + 32);
        const sectionSize = boundedUint64(view, sectionOffset + 40);
        const sectionVirtualEnd =
          sectionAddress === undefined || sectionSize === undefined
            ? undefined
            : checkedSpanEnd(sectionAddress, sectionSize);
        if (
          sectionAddress === undefined ||
          sectionSize === undefined ||
          sectionVirtualEnd === undefined ||
          sectionAddress < virtualAddress ||
          sectionVirtualEnd > virtualEnd
        ) {
          throw new Error(`${target.target} has an out-of-bounds Mach-O section VM span`);
        }

        const sectionFileOffset = view.getUint32(sectionOffset + 48, true);
        const sectionFlags = view.getUint32(sectionOffset + 64, true);
        const sectionType = sectionFlags & 0xff;
        const zeroFill = sectionType === 0x01 || sectionType === 0x0c || sectionType === 0x12;
        if (!zeroFill) {
          const sectionFileEnd = checkedSpanEnd(sectionFileOffset, sectionSize);
          if (
            sectionFileEnd === undefined ||
            sectionFileOffset < fileOffset ||
            sectionFileEnd > segmentEnd ||
            sectionFileEnd > fileSize
          ) {
            throw new Error(`${target.target} has an out-of-bounds Mach-O section file span`);
          }
        }
      }

      const maximumProtection = view.getUint32(offset + 56, true);
      const initialProtection = view.getUint32(offset + 60, true);
      if ((initialProtection & 0x4) !== 0) {
        if (
          initialProtection !== 0x5 ||
          (maximumProtection & initialProtection) !== initialProtection ||
          fileBytes === 0
        ) {
          throw new Error(`${target.target} has an invalid executable Mach-O segment`);
        }
        executableSegments.push(
          Object.freeze({ fileBytes, fileOffset, virtualAddress, virtualEnd }),
        );
      }
    }

    if (command === 0x80000028) {
      if (commandSize !== 24 || entryOffset !== undefined) {
        throw new Error(`${target.target} has an invalid Mach-O LC_MAIN command`);
      }
      entryOffset = boundedUint64(view, offset + 8);
      if (entryOffset === undefined || entryOffset === 0 || entryOffset >= fileSize) {
        throw new Error(`${target.target} has an invalid Mach-O LC_MAIN entry offset`);
      }
    }
    offset = commandEnd;
  }

  if (offset !== loadCommandEnd) {
    throw new Error(`${target.target} does not exactly consume its Mach-O load-command table`);
  }
  if (executableSegments.length === 0) {
    throw new Error(`${target.target} has no executable file-backed Mach-O segment`);
  }
  if (
    entryOffset === undefined ||
    !executableSegments.some((segment) => {
      if (entryOffset === undefined || entryOffset < segment.fileOffset) return false;
      const fileDelta = entryOffset - segment.fileOffset;
      if (!Number.isSafeInteger(fileDelta) || fileDelta >= segment.fileBytes) return false;
      const mappedAddress = checkedSpanEnd(segment.virtualAddress, fileDelta);
      return mappedAddress !== undefined && mappedAddress < segment.virtualEnd;
    })
  ) {
    throw new Error(`${target.target} has no LC_MAIN entry inside an executable Mach-O segment`);
  }
}

function verifyElfHeader(
  target: Target,
  header: Uint8Array,
  view: DataView,
  fileSize: number,
): void {
  if (
    header.byteLength < 64 ||
    !hasPrefix(header, [0x7f, 0x45, 0x4c, 0x46]) ||
    header[4] !== 2 ||
    header[5] !== 1 ||
    header[6] !== 1 ||
    view.getUint16(18, true) !== 0x003e ||
    view.getUint32(20, true) !== 1
  ) {
    throw new Error(`${target.target} is not an ELF64 little-endian x86-64 image`);
  }
  const imageType = view.getUint16(16, true);
  if (imageType !== 2 && imageType !== 3) {
    throw new Error(`${target.target} is neither an ELF ET_EXEC nor ET_DYN image`);
  }
  const entry = boundedUint64(view, 24);
  const programOffset = boundedUint64(view, 32);
  const headerSize = view.getUint16(52, true);
  const programEntrySize = view.getUint16(54, true);
  const programCount = view.getUint16(56, true);
  const programEnd =
    programOffset === undefined
      ? undefined
      : checkedTableEnd(programOffset, programEntrySize, programCount);
  if (
    entry === undefined ||
    entry === 0 ||
    headerSize !== 64 ||
    programOffset === undefined ||
    programOffset < headerSize ||
    programEntrySize !== 56 ||
    programEnd === undefined ||
    programEnd > header.byteLength ||
    programEnd > fileSize
  ) {
    throw new Error(`${target.target} has an invalid ELF executable or program-header table`);
  }

  let executableLoad = false;
  let interpreter = false;
  for (let index = 0; index < programCount; index += 1) {
    const offset = programOffset + index * programEntrySize;
    const type = view.getUint32(offset, true);
    const flags = view.getUint32(offset + 4, true);
    const segmentOffset = boundedUint64(view, offset + 8);
    const segmentFileSize = boundedUint64(view, offset + 32);
    const segmentMemorySize = boundedUint64(view, offset + 40);
    if (
      segmentOffset === undefined ||
      segmentFileSize === undefined ||
      segmentMemorySize === undefined ||
      segmentOffset > fileSize - segmentFileSize
    ) {
      throw new Error(`${target.target} has an out-of-bounds ELF program segment`);
    }
    if (type === 1) {
      if (segmentFileSize > segmentMemorySize) {
        throw new Error(`${target.target} has an invalid ELF PT_LOAD size`);
      }
      if ((flags & 0x1) !== 0 && segmentMemorySize > 0) executableLoad = true;
    }
    if (type === 3 && segmentFileSize > 1) interpreter = true;
  }
  if (!executableLoad) {
    throw new Error(`${target.target} has no executable ELF PT_LOAD segment`);
  }
  if (imageType === 3 && !interpreter) {
    throw new Error(`${target.target} is an ELF ET_DYN image without PT_INTERP`);
  }
}

function verifyPeHeader(
  target: Target,
  header: Uint8Array,
  view: DataView,
  fileSize: number,
): void {
  if (header.byteLength < 64 || !hasPrefix(header, [0x4d, 0x5a])) {
    throw new Error(`${target.target} is not a PE image`);
  }
  const peOffset = view.getUint32(0x3c, true);
  const coffEnd = peOffset + 24;
  if (
    peOffset < 64 ||
    !Number.isSafeInteger(coffEnd) ||
    coffEnd > header.byteLength ||
    coffEnd > fileSize ||
    !hasPrefix(header.subarray(peOffset), [0x50, 0x45, 0x00, 0x00])
  ) {
    throw new Error(`${target.target} has a malformed PE/COFF header`);
  }
  const expectedMachine = target.architecture === "arm64" ? 0xaa64 : 0x8664;
  if (view.getUint16(peOffset + 4, true) !== expectedMachine) {
    throw new Error(`${target.target} has the wrong PE machine architecture`);
  }
  const sectionCount = view.getUint16(peOffset + 6, true);
  const optionalSize = view.getUint16(peOffset + 20, true);
  const characteristics = view.getUint16(peOffset + 22, true);
  if ((characteristics & 0x0002) === 0 || (characteristics & 0x2000) !== 0) {
    throw new Error(`${target.target} is not a non-DLL PE executable image`);
  }
  const optionalOffset = peOffset + 24;
  const optionalEnd = optionalOffset + optionalSize;
  const sectionEnd = checkedTableEnd(optionalEnd, 40, sectionCount);
  if (
    sectionCount === 0 ||
    sectionCount > 96 ||
    optionalSize < 112 ||
    !Number.isSafeInteger(optionalEnd) ||
    optionalEnd > header.byteLength ||
    optionalEnd > fileSize ||
    view.getUint16(optionalOffset, true) !== 0x020b ||
    sectionEnd === undefined ||
    sectionEnd > header.byteLength ||
    sectionEnd > fileSize
  ) {
    throw new Error(`${target.target} has invalid PE32+ optional or section headers`);
  }
  const entry = view.getUint32(optionalOffset + 16, true);
  const sectionAlignment = view.getUint32(optionalOffset + 32, true);
  const fileAlignment = view.getUint32(optionalOffset + 36, true);
  const imageSize = view.getUint32(optionalOffset + 56, true);
  const headerSize = view.getUint32(optionalOffset + 60, true);
  if (
    entry === 0 ||
    sectionAlignment === 0 ||
    fileAlignment === 0 ||
    sectionAlignment < fileAlignment ||
    imageSize <= headerSize ||
    entry >= imageSize ||
    headerSize < sectionEnd ||
    headerSize > fileSize
  ) {
    throw new Error(`${target.target} has invalid PE32+ entry, image, or header bounds`);
  }

  let executableSection = false;
  for (let index = 0; index < sectionCount; index += 1) {
    const offset = optionalEnd + index * 40;
    const virtualSize = view.getUint32(offset + 8, true);
    const virtualAddress = view.getUint32(offset + 12, true);
    const rawSize = view.getUint32(offset + 16, true);
    const rawOffset = view.getUint32(offset + 20, true);
    const sectionCharacteristics = view.getUint32(offset + 36, true);
    const virtualSpan = Math.max(virtualSize, rawSize);
    if (
      (rawSize > 0 && (rawOffset < headerSize || rawOffset > fileSize - rawSize)) ||
      virtualAddress > imageSize - virtualSpan
    ) {
      throw new Error(`${target.target} has an out-of-bounds PE section`);
    }
    if ((sectionCharacteristics & 0x20000000) !== 0 && virtualSpan > 0) {
      executableSection = true;
    }
  }
  if (!executableSection) {
    throw new Error(`${target.target} has no executable PE section`);
  }
}

async function verifyExecutableHeader(target: Target): Promise<void> {
  const executable = path.join(projectRoot, target.executable);
  const handle = await open(executable, "r");
  try {
    const stats = await handle.stat();
    if (!Number.isSafeInteger(stats.size) || stats.size <= 0) {
      throw new Error(`${target.target} has an invalid executable size`);
    }
    const bytes = new Uint8Array(65_536);
    const { bytesRead } = await handle.read(bytes, 0, bytes.byteLength, 0);
    const header = bytes.subarray(0, bytesRead);
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    if (target.platform === "darwin") {
      verifyMachOHeader(target, header, view, stats.size);
      return;
    }
    if (target.platform === "linux") {
      verifyElfHeader(target, header, view, stats.size);
      return;
    }
    verifyPeHeader(target, header, view, stats.size);
  } finally {
    await handle.close();
  }
}

let hostWorkflowRan = false;
try {
  for (const target of targets) {
    await run([process.execPath, "run", "scripts/build.ts", `--target=${target.target}`]);
    await verifyExecutableHeader(target);
    const isRunnable = process.platform === target.platform && process.arch === target.architecture;
    await run([
      process.execPath,
      "run",
      "scripts/verify-binary.ts",
      `--executable=${target.executable}`,
      ...(isRunnable ? [] : ["--skip-run"]),
    ]);
    if (isRunnable) {
      await run([
        process.execPath,
        "run",
        iterationOneAVerification,
        `--executable=${target.executable}`,
        "--skip-crash",
      ]);
      await run([
        process.execPath,
        "run",
        foundationVerification,
        `--executable=${target.executable}`,
      ]);
      await run([
        process.execPath,
        "run",
        selfBlueprintVerification,
        `--executable=${target.executable}`,
      ]);
      hostWorkflowRan = true;
    }
  }
} finally {
  await run([process.execPath, "run", "scripts/build.ts"]);
}

console.log(
  hostWorkflowRan
    ? `Verified ${targets.length} standalone executable headers, the complete host-compatible Iteration 1B workflow, and restored the native artifact.`
    : `Verified ${targets.length} standalone executable headers by cross-compilation only; no baseline target matches ${process.platform}-${process.arch}, and the native artifact was restored.`,
);
