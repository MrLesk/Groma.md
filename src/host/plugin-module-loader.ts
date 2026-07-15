/** Imports one immutable in-memory module URL built exclusively from verified, trusted entry bytes. */
export function importLocalPluginModule(url: string): Promise<unknown> {
  return import(url) as Promise<unknown>;
}
