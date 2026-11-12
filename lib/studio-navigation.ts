export type BrowserStudioTab = "create" | "library" | "settings";

export function viewToTab(value: unknown): BrowserStudioTab {
  if (value === "designs") return "library";
  if (value === "settings") return "settings";
  return "create";
}

export function studioUrlForTab(current: URL, tab: BrowserStudioTab): string {
  const url = new URL(current.href);
  if (tab === "create") url.searchParams.delete("view");
  else url.searchParams.set("view", tab === "library" ? "designs" : "settings");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function stencilFileName(
  concept: string,
  index: number,
  kind: "png" | "svg",
): string {
  const slug =
    concept
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "tattoo";
  return `${slug}-variation-${index + 1}-mirrored.${kind}`;
}
