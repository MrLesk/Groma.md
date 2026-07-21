import type { BlueprintModel } from "./model.ts";

/**
 * Opaque scanner ordering can put borrowed roots first. Read a small number of
 * already-paged root results until the sheet has something built here to show.
 */
export const OWNED_ROOT_DISCOVERY_PAGE_LIMIT = 5;

export function shouldContinueOwnedRootDiscovery(
  model: BlueprintModel,
  pagesRead: number,
): boolean {
  return (
    pagesRead < OWNED_ROOT_DISCOVERY_PAGE_LIMIT &&
    model.hasMoreRoots &&
    model.rootsCursor !== undefined &&
    !model.rootIds.some((id) => model.nodes.get(id)?.view.component.type !== "external")
  );
}
