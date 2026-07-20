import frontend from "./client/index.html";

/**
 * The embedded web application shell. The HTML bundle and every asset it references are
 * bundled into the compiled executable at build time; serving them never reads source
 * files from disk. Load this module only when the web command actually runs.
 */
export const webFrontend = frontend;
