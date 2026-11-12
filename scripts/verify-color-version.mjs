import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp from "sharp";

// Explicit finite validation only: creates one real referenced color edit.
// Never use this as a recurring health check. Tokens stay in ignored .cache.
const base = process.env.COLOR_CHECK_API_ORIGIN || "http://127.0.0.1:3000";
const records = JSON.parse(
  await fs.readFile("assets/catalog/inspiration/catalog-items.json", "utf8"),
);
const selected = records.find((record) => record.id === "fine-line-tulip");
if (!selected) throw new Error("Selected catalog source is missing");
await fs.mkdir(".cache", { recursive: true });
const cache = ".cache/color-version-check.json";
let input;
try {
  input = JSON.parse(await fs.readFile(cache, "utf8"));
} catch {
  input = {
    concept: selected.title,
    catalogId: selected.id,
    style: "fine_line",
    medium: "blackwork",
    clientId: "color-version-verification",
    requestId: `color-check-${crypto.randomUUID()}`,
    capabilityToken: crypto.randomBytes(32).toString("hex"),
    filters: { category: "all", artStyle: "fine_line", colorMix: "red_accent" },
  };
  await fs.writeFile(cache, JSON.stringify(input));
}
const post = await fetch(`${base}/api/stencils`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(input),
});
if (post.status !== 202)
  throw new Error(`Color request was not accepted (${post.status})`);
const created = await post.json();
let job;
for (let attempt = 0; attempt < 150; attempt++) {
  const response = await fetch(
    `${base}/api/stencils/${created.id}?token=${encodeURIComponent(input.capabilityToken)}`,
  );
  if (!response.ok)
    throw new Error("Could not read the accepted color request");
  job = await response.json();
  if (job.status === "failed")
    throw new Error(`Color version failed: ${job.error}`);
  if (job.status === "ready") break;
  if (attempt % 10 === 0) console.log("Color version in progress:", job.status);
  await new Promise((resolve) => setTimeout(resolve, 3000));
}
if (job?.status !== "ready")
  throw new Error(
    "Color request remains pending; inspect the cached request instead of submitting a new one",
  );
if (
  job.options.length !== 1 ||
  job.options[0].catalogId !== selected.id ||
  !job.options[0].colorUrl ||
  job.options[0].colorMode !== "red_accent"
)
  throw new Error("Ready output lacks the expected original/color identity");
const option = job.options[0];
async function bytes(url) {
  const response = await fetch(new URL(url, base));
  if (!response.ok) throw new Error("Stored artwork could not be downloaded");
  return Buffer.from(await response.arrayBuffer());
}
const source = await fs.readFile(
  `assets/catalog/inspiration/${selected.filename}`,
);
const original = await bytes(option.originalUrl);
const color = await bytes(option.colorUrl);
if (!source.equals(original)) throw new Error("Catalog original bytes changed");
const rawSource = await sharp(source)
  .flatten({ background: "#fff" })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const rawColor = await sharp(color)
  .flatten({ background: "#fff" })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
if (
  rawSource.info.width !== rawColor.info.width ||
  rawSource.info.height !== rawColor.info.height
)
  throw new Error("Native dimensions changed");
let coloredPixels = 0;
let filledPixels = 0;
for (let i = 0; i < rawSource.data.length; i += 3) {
  const src = rawSource.data.subarray(i, i + 3),
    rgb = rawColor.data.subarray(i, i + 3);
  if (
    option.colorTreatment !== "filled" &&
    Math.min(...src) === 255 &&
    Math.min(...rgb) !== 255
  )
    throw new Error("Color escaped original ink coverage");
  if (rgb[0] - rgb[1] > 15 && rgb[0] - rgb[2] > 15) {
    coloredPixels++;
    if (Math.min(...src) >= 250) filledPixels++;
  }
  const pixel = i / 3,
    x = pixel % rawColor.info.width,
    y = Math.floor(pixel / rawColor.info.width);
  if (
    option.colorTreatment === "filled" &&
    (x === 0 ||
      y === 0 ||
      x === rawColor.info.width - 1 ||
      y === rawColor.info.height - 1) &&
    Math.min(...rgb) !== 255
  )
    throw new Error("Exterior image edge was filled");
}
if (!coloredPixels) throw new Error("No genuine red ink was generated");
if (option.colorTreatment === "filled" && !filledPixels)
  throw new Error("No interior fill was generated for the enclosed tulip");
await fs.writeFile(".cache/color-version-red-tulip.png", color);
console.log(
  "Verified live referenced color edit:",
  selected.title,
  rawColor.info.width,
  "×",
  rawColor.info.height,
  "red pixels:",
  coloredPixels,
);
console.log(
  "Catalog original is byte-identical; ready color treatment:",
  option.colorTreatment || "ink_only",
  "; interior red pixels:",
  filledPixels,
);
