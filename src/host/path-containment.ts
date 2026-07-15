import path from "node:path";

export interface PathContainmentImplementation {
  readonly isAbsolute: (value: string) => boolean;
  readonly relative: (from: string, to: string) => string;
  readonly sep: string;
}

/** Returns true only when `child` is the same path as, or a descendant of, `parent`. */
export function isPathWithin(
  parent: string,
  child: string,
  implementation: PathContainmentImplementation = path,
): boolean {
  const relative = implementation.relative(parent, child);
  return (
    relative === "" ||
    (!implementation.isAbsolute(relative) &&
      relative !== ".." &&
      !relative.startsWith(`..${implementation.sep}`))
  );
}
