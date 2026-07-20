/** Markdown files imported with `with { type: "text" }` resolve to their raw text. */
declare module "*.md" {
  const text: string;
  export default text;
}
