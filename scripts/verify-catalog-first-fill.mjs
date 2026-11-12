import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp from "sharp";

// Finite explicit proof, not a scheduled or recurring monitor.
// One catalog fill edit and one AI outline contact sheet; recovery credentials are ignored.
const base = process.env.CATALOG_FIRST_CHECK_ORIGIN || "http://127.0.0.1:3000";
const records = JSON.parse(
  await fs.readFile("assets/catalog/inspiration/catalog-items.json", "utf8"),
);
const selected = records.find((record) => record.id === "fine-line-tulip");
if (!selected) throw new Error("Tulip source record is missing");
await fs.mkdir(".cache", { recursive: true });
const filename = ".cache/catalog-first-fill-proof.json";
let inputs;
try {
  inputs = JSON.parse(await fs.readFile(filename, "utf8"));
} catch {
  const make = (concept, colorMix, prefix) => ({
    concept,
    style: "fine_line",
    medium: "blackwork",
    clientId: "catalog-first-fill-verification",
    requestId: `${prefix}-${crypto.randomUUID()}`,
    capabilityToken: crypto.randomBytes(32).toString("hex"),
    filters: { category: "all", artStyle: "fine_line", colorMix },
  });
  inputs = {
    catalog: make(selected.title, "red_accent", "catalog-fill"),
    ai: make("A simple avocado spaceship", "any", "ai-fallback"),
  };
  await fs.writeFile(filename, JSON.stringify(inputs));
}
async function ready(input) {
  const response = await fetch(`${base}/api/stencils`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (response.status !== 202)
    throw new Error(
      `Request not accepted (${response.status}); do not submit a replacement while state is uncertain`,
    );
  const created = await response.json();
  for (let attempt = 0; attempt < 180; attempt++) {
    const res = await fetch(
      `${base}/api/stencils/${created.id}?token=${encodeURIComponent(input.capabilityToken)}`,
    );
    if (!res.ok)
      throw new Error(
        "Accepted job could not be read; keep the cached credential",
      );
    const job = await res.json();
    if (job.status === "failed")
      throw new Error(`Accepted job failed: ${job.error}`);
    if (job.status === "ready") return job;
    if (attempt % 10 === 0) console.log("Preparing", job.source, job.status);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(
    "Job remains pending; inspect its cached request instead of resubmitting new work",
  );
}
async function bytes(path) {
  const r = await fetch(new URL(path, base));
  if (!r.ok) throw new Error("Asset download failed");
  return Buffer.from(await r.arrayBuffer());
}
const catalog = await ready(inputs.catalog);
if (
  catalog.source !== "catalog" ||
  !catalog.options.length ||
  catalog.options.some((x) => x.source !== "catalog" || !x.catalogId)
)
  throw new Error("Catalog priority or true source metadata failed");
const option = catalog.options.find((x) => x.catalogId === selected.id);
if (
  !option?.colorUrl ||
  (option.colorTreatment && option.colorTreatment !== "filled")
)
  throw new Error("Tulip is not an available filled-color output");
const original = await bytes(option.originalUrl);
const source = await fs.readFile(
  `assets/catalog/inspiration/${selected.filename}`,
);
if (!source.equals(original)) throw new Error("Catalog original was altered");
const color = await bytes(option.colorUrl);
const rawSource = await sharp(source)
  .flatten({ background: "#fff" })
  .removeAlpha()
  .toColourspace("srgb")
  .raw()
  .toBuffer({ resolveWithObject: true });
const rawColor = await sharp(color)
  .flatten({ background: "#fff" })
  .removeAlpha()
  .toColourspace("srgb")
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, height } = rawSource.info;
if (
  width !== rawColor.info.width ||
  height !== rawColor.info.height ||
  rawSource.info.channels !== 3 ||
  rawColor.info.channels !== 3
)
  throw new Error("Source-native color dimensions changed");
let filledPixels = 0;
for (let p = 0; p < width * height; p++) {
  const i = p * 3,
    r = rawColor.data[i],
    g = rawColor.data[i + 1],
    b = rawColor.data[i + 2];
  if (
    rawSource.data[i] >= 250 &&
    rawSource.data[i + 1] >= 250 &&
    rawSource.data[i + 2] >= 250 &&
    r - g > 25 &&
    r - b > 25
  )
    filledPixels++;
  const x = p % width,
    y = Math.floor(p / width);
  if (
    (x === 0 || y === 0 || x === width - 1 || y === height - 1) &&
    Math.min(r, g, b) !== 255
  )
    throw new Error("Exterior canvas edge was painted");
}
if (filledPixels < 20)
  throw new Error(
    "Only line colors changed; no meaningful interior fill was found",
  );
await fs.writeFile(".cache/runtime-filled-tulip.png", color);
console.log(
  "Catalog first verified:",
  selected.title,
  "native pixels",
  width,
  "×",
  height,
  "new interior red pixels:",
  filledPixels,
  "unchanged source bytes.",
);
const ai = await ready(inputs.ai);
if (
  ai.source !== "ai" ||
  ai.options.length !== 4 ||
  ai.options.some(
    (x) =>
      x.source !== "ai" || x.catalogId || x.collection || x.page || x.colorUrl,
  )
)
  throw new Error("No-match AI fallback provenance/output is incorrect");
const generated = await bytes(ai.options[0].originalUrl);
await sharp(generated).metadata();
await fs.writeFile(".cache/runtime-ai-original.png", generated);
const unsafe = await fetch(
  new URL(ai.options[0].originalUrl.split("?")[0], base),
  { redirect: "manual" },
);
if (unsafe.status !== 401)
  throw new Error("Generated original lacks capability protection");
console.log(
  "No catalog match -> four actual AI-created outline options; no invented catalog provenance; protected original downloadable.",
);
