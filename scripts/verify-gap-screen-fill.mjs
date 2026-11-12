import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp from "sharp";
const base = "http://127.0.0.1:3000";
const records = JSON.parse(
  await fs.readFile("assets/catalog/inspiration/catalog-items.json", "utf8"),
);
const record = records.find((x) => x.id === "fine-line-rose-1");
await fs.mkdir(".cache", { recursive: true });
const cache = ".cache/gap-screen-fill-proof.json";
let input;
try {
  input = JSON.parse(await fs.readFile(cache, "utf8"));
} catch {
  input = {
    concept: record.title,
    catalogId: record.id,
    style: "fine_line",
    medium: "blackwork",
    clientId: "gap-screen-fill-verification",
    requestId: `gap-screen-${crypto.randomUUID()}`,
    capabilityToken: crypto.randomBytes(32).toString("hex"),
    filters: {
      category: "all",
      artStyle: "any",
      colorMix: "custom",
      inkColors: ["lake_blue", "cherry_red", "lemon_yellow"],
    },
  };
  await fs.writeFile(cache, JSON.stringify(input));
}
const response = await fetch(`${base}/api/stencils`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(input),
});
if (response.status !== 202)
  throw new Error(`Request rejected: ${response.status}`);
const created = await response.json();
let job;
for (let attempt = 0; attempt < 60; attempt++) {
  const read = await fetch(
    `${base}/api/stencils/${created.id}?token=${encodeURIComponent(input.capabilityToken)}`,
  );
  if (!read.ok) throw new Error(`Read failed: ${read.status}`);
  job = await read.json();
  if (job.status === "failed") throw new Error(`Request failed: ${job.error}`);
  if (job.status === "ready") break;
  if (attempt % 10 === 0)
    console.log("Preparing selected-ink catalog output:", job.status);
  await new Promise((r) => setTimeout(r, 1000));
}
if (
  job?.status !== "ready" ||
  job.source !== "catalog" ||
  job.options.length !== 1
)
  throw new Error("Catalog output not ready");
const option = job.options[0];
if (
  !option.colorUrl ||
  option.colorStatus !== "ready" ||
  option.colorTreatment !== "filled"
)
  throw new Error("Requested ink fill not ready");
if (job.filters?.inkColors?.join(",") !== "lake_blue,cherry_red,lemon_yellow")
  throw new Error("Requested palette lost");
const originalResponse = await fetch(new URL(option.originalUrl, base));
const original = Buffer.from(await originalResponse.arrayBuffer());
if (
  !original.equals(
    await fs.readFile(`assets/catalog/inspiration/${record.filename}`),
  )
)
  throw new Error("Original bytes altered");
const colorResponse = await fetch(new URL(option.colorUrl, base));
if (!colorResponse.ok) throw new Error("Color URL unavailable");
const color = Buffer.from(await colorResponse.arrayBuffer());
const { data, info } = await sharp(color)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const sourceInfo = await sharp(original).metadata();
if (info.width !== sourceInfo.width || info.height !== sourceInfo.height)
  throw new Error("Native size changed");
const expectedRgb = new Set(
  ["#28BFE1", "#EC3063", "#FFE44D"].map((hex) =>
    [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(","),
  ),
);
const usedRgb = new Set();
let colored = 0;
for (let pixel = 0; pixel < data.length; pixel += info.channels)
  if (
    Math.max(data[pixel], data[pixel + 1], data[pixel + 2]) -
      Math.min(data[pixel], data[pixel + 1], data[pixel + 2]) >
    20
  ) {
    const key = [data[pixel], data[pixel + 1], data[pixel + 2]].join(",");
    if (!expectedRgb.has(key))
      throw new Error("Unexpected display palette RGB");
    usedRgb.add(key);
    colored++;
  }
if (colored < 20) throw new Error("Output still uncolored");
if (usedRgb.size !== 3) throw new Error("Selected display colors missing");
const stencil = await fetch(new URL(option.pngUrl, base));
if (!stencil.ok) throw new Error("Artist source unavailable");
await fs.writeFile(".cache/gap-screen-rose.png", color);
console.log(
  JSON.stringify({
    status: "ready",
    source: "catalog",
    selectedInks: job.filters.inkColors,
    colorTreatment: option.colorTreatment,
    coloredPixels: colored,
    brightScreenColors: [...usedRgb],
    width: info.width,
    height: info.height,
    originalBytesUnchanged: true,
    artistFileAvailable: true,
  }),
);
