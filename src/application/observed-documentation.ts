/**
 * Derives a component's one-line description from documentation that already
 * exists in the observed source.
 *
 * Nothing here is written, summarized, or paraphrased: the result is always a
 * verbatim span of text a scanner found in the code, or nothing at all. That is
 * the whole point — a blueprint may repeat what a repository says about itself,
 * but it may never speak for it. Where a project documents nothing, the surface
 * stays silent rather than guessing.
 *
 * The rule is deliberately technology-neutral. Every ecosystem has a convention
 * for "prose attached to a unit of code" — a directory README, a package doc
 * comment, a module docstring — and a scanner maps its own convention onto the
 * documentation observation. This derivation only sees the resulting text.
 */

export const OBSERVED_DOCUMENTATION_DERIVATION_V1 = "groma/observed-documentation/v1" as const;

/** Longest description the sheet will carry before it stops being a glance. */
export const OBSERVED_SUMMARY_MAX_CHARACTERS = 200;

/**
 * Shortest run of prose worth repeating. Below this a "description" is almost
 * always a title, a badge, or a fragment, and printing it would fill the space
 * reserved for meaning with noise.
 */
export const OBSERVED_SUMMARY_MIN_CHARACTERS = 24;

/** Strips the comment syntax a scanner may hand over with a doc block. */
function withoutCommentSyntax(value: string): string {
  return value
    .replace(/^\s*\/\*\*?/, "")
    .replace(/\*\/\s*$/, "")
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s*\*\s?/, "")
        .replace(/^\s*\/\/\/?\s?/, "")
        .replace(/^\s*#\s?(?=\s*\w)/, ""),
    )
    .join("\n");
}

/**
 * Program text, in any of the languages a scanner might hand over. Scanners are
 * third-party and a description slot is a place a reader trusts, so code is
 * refused here as well as at the scanner that should not have sent it: showing
 * a reader an import statement where a purpose belongs is worse than silence.
 */
function isCode(block: string): boolean {
  const trimmed = block.trim();
  if (
    /^(?:import|export|package|using|#include|from|const|let|var|func|def|class|fn|pub|module|require|public|private|protected|internal|static|type|interface|struct|impl|trait|namespace)\b/.test(
      trimmed,
    )
  ) {
    return true;
  }
  if (/^[@#]\w+[({]/.test(trimmed)) return true;
  // Prose does not end in a brace or a statement terminator.
  if (/[{};]$/.test(trimmed)) return true;
  // Indented blocks are code by markdown's own rule.
  if (/^ {4}|^\t/.test(block)) return true;
  const codePunctuation = (trimmed.match(/[;{}()=<>[\]]/g) ?? []).length;
  return codePunctuation > 0 && codePunctuation / trimmed.length > 0.06;
}

/**
 * A block that names, decorates, or lists rather than describes. Headings
 * restate the component's own name, markup and badges carry no prose, and a
 * list item is a detail rather than the thing a reader needs first.
 */
function isProse(block: string): boolean {
  const trimmed = block.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.startsWith("<")) return false;
  if (trimmed.startsWith("#")) return false;
  if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) return false;
  if (trimmed.startsWith(">")) return false;
  if (trimmed.startsWith("|")) return false;
  if (/^[-*+]\s/.test(trimmed)) return false;
  if (/^\d+[.)]\s/.test(trimmed)) return false;
  if (/^!?\[[^\]]*\]\([^)]*\)\s*$/.test(trimmed)) return false;
  if (/^_[^_]*_$/.test(trimmed)) return false;
  if (isCode(block)) return false;
  return true;
}

/** Reduces inline markdown to the words it decorates. */
function withoutInlineMarkup(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/(^|\s)_([^_]+)_(?=\s|$)/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The first sentence, when the block has one. A block that never terminates a
 * sentence — a clause introducing a list, say — is kept whole, because cutting
 * it at an arbitrary point would misquote the source.
 */
function firstSentence(value: string): string {
  const match = /^(.+?[.!?])(?:\s|$)/.exec(value);
  const sentence = match?.[1] ?? value;
  return sentence.replace(/:$/, "").trim();
}

/** Truncates on a word boundary, marking that the source said more. */
function bounded(value: string): string {
  if (value.length <= OBSERVED_SUMMARY_MAX_CHARACTERS) return value;
  const cut = value.slice(0, OBSERVED_SUMMARY_MAX_CHARACTERS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.]$/, "")}…`;
}

/** Compares loosely enough to catch a "description" that only repeats the name. */
function comparable(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Reads one description out of observed documentation, or reports that the
 * source does not describe this component.
 *
 * `name` is used only to reject a restatement of the component's own name; it
 * never contributes words to the result.
 */
export function observedSummaryFromDocumentation(
  content: string,
  format: "markdown" | "text",
  name?: string,
): string | undefined {
  if (typeof content !== "string" || content.length === 0) return undefined;
  const normalized = (format === "text" ? withoutCommentSyntax(content) : content).replace(
    /\r\n?/g,
    "\n",
  );
  for (const block of normalized.split(/\n\s*\n/)) {
    if (!isProse(block)) continue;
    const sentence = bounded(firstSentence(withoutInlineMarkup(block)));
    if (sentence.length < OBSERVED_SUMMARY_MIN_CHARACTERS) continue;
    if (name !== undefined && comparable(sentence) === comparable(name)) continue;
    return sentence;
  }
  return undefined;
}
