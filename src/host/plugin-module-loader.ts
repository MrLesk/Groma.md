/** The single audited Host boundary for importing an already verified and trusted entry URL. */
export function importLocalPluginModule(url: string): Promise<unknown> {
  return import(url) as Promise<unknown>;
}
