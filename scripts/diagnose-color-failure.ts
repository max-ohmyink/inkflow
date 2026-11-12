import fs from "node:fs/promises";
import { generateImage } from "../server/stencils/platform";
import {
  getValidatedCatalogRecord,
  readCatalogOriginalPng,
} from "../server/stencils/catalogOutput";
import {
  createColorVersion,
  colorVersionEditPrompt,
  findEnclosedWhiteRegions,
} from "../server/stencils/colorVersion";
import sharp from "sharp";
// Explicit one-off debugging only. Never retries or prints credentials/provider bodies.
async function main() {
  const id = process.argv[2] || "dragon-v-1";
  const record = getValidatedCatalogRecord(id);
  if (!record) throw new Error("invalid_catalog_id");
  const original = await readCatalogOriginalPng(record);
  await fs.mkdir(".cache", { recursive: true });
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const response = await nativeFetch(input, init);
    if (String(input).includes("ImageService/GenerateImage")) {
      console.log("ImageService HTTP", response.status);
      if (!response.ok) {
        const data = await response
          .clone()
          .json()
          .catch(() => ({}));
        const code = data?.code ?? data?.error?.code;
        console.log(
          "ImageService error code",
          typeof code === "string" && /^[a-zA-Z_0-9-]{1,60}$/.test(code)
            ? code
            : "unclassified",
        );
      }
    }
    return response;
  };
  const raw = await sharp(original)
    .flatten({ background: "#fff" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const regions = findEnclosedWhiteRegions(
    raw.data,
    raw.info.width,
    raw.info.height,
  );
  console.log(
    "Source",
    id,
    "dimensions",
    raw.info.width,
    raw.info.height,
    "enclosed white regions",
    regions.count,
  );
  try {
    const proposed = await generateImage(
      colorVersionEditPrompt("mixed_color"),
      [{ b64Json: original.toString("base64"), mimeType: "image/png" }],
    );
    await fs.writeFile(`.cache/diagnostic-${id}-proposal.png`, proposed.bytes);
    console.log("ImageService produced proposal bytes", proposed.bytes.length);
    try {
      const result = await createColorVersion(original, "mixed_color", {
        generateImage: async () => proposed,
      });
      await fs.writeFile(`.cache/diagnostic-${id}-color.png`, result.png);
      console.log("Compositor succeeded", result.treatment);
    } catch (error) {
      console.log(
        "Compositor rejected proposal",
        error instanceof Error ? error.name : "unknown",
      );
      process.exitCode = 2;
    }
  } catch (error) {
    console.log(
      "Provider step failed",
      error instanceof Error ? error.name : "unknown",
      error instanceof Error && /^[a-z_]+$/.test(error.message)
        ? error.message
        : "sanitized",
    );
    process.exitCode = 3;
  }
}
main().catch(() => {
  console.error("Diagnostic setup failed before color generation.");
  process.exitCode = 1;
});
