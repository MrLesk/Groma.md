/**
 * Checks actual HTML elements rather than text in inlined scripts. The React bundle
 * may legitimately mention a stylesheet tag in an error message.
 */
export async function hasExternalStaticExportAssets(html: string): Promise<boolean> {
  let hasExternalAssets = false;
  const document = new HTMLRewriter()
    .on("script", {
      element(element) {
        hasExternalAssets ||= element.hasAttribute("src");
      },
    })
    .on("link", {
      element(element) {
        hasExternalAssets ||=
          element
            .getAttribute("rel")
            ?.split(/\s+/)
            .some((value) => value.toLowerCase() === "stylesheet") ?? false;
      },
    })
    .transform(new Response(html));
  await document.text();
  return hasExternalAssets;
}
