import { readFile } from "node:fs/promises";
import path from "node:path";
import type { StencilStyle } from "./prompt";
import { getCachedStencilDownloadUrl } from "./platform";

export type StyleReference = { url: string; mimeType: "image/png" };
type StyleReferenceKeys = Partial<Record<StencilStyle, string>>;

/**
 * Parent-owned catalog-references.json is deliberately data-only. Read it lazily so deployments
 * without the optional catalog keep the normal generation path rather than failing guest jobs.
 */
async function loadStyleReferenceKeys(): Promise<StyleReferenceKeys> {
  try {
    const value = JSON.parse(
      await readFile(
        path.join(process.cwd(), "server/stencils/catalog-references.json"),
        "utf8",
      ),
    ) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const mapped: StyleReferenceKeys = {};
    for (const style of [
      "fine_line",
      "traditional",
      "geometric",
      "cyber",
    ] as const) {
      const key = (value as Record<string, unknown>)[style];
      if (
        typeof key === "string" &&
        /^[\x20-\x7E]+$/.test(key) &&
        !/mandala/i.test(key) &&
        !key.startsWith("/") &&
        !key.includes("..")
      ) {
        mapped[style] = key;
      }
    }
    return mapped;
  } catch {
    // Optional bindings are read fresh so edits never keep a retired reference active.
    return {};
  }
}

/** Returns a short-lived signed URL only for the selected, server-owned catalog asset. */
export async function selectedStyleReference(
  style: StencilStyle,
): Promise<StyleReference | undefined> {
  try {
    const keys = await loadStyleReferenceKeys();
    const key = keys[style];
    if (!key) return undefined;
    return {
      url: await getCachedStencilDownloadUrl(key),
      mimeType: "image/png",
    };
  } catch {
    // Visual references enhance style only and must never block a safe standard generation request.
    return undefined;
  }
}
