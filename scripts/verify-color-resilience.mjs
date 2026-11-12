import fs from "node:fs/promises";
import crypto from "node:crypto";
const base = process.env.COLOR_CHECK_API_ORIGIN || "http://127.0.0.1:3000";
const records = JSON.parse(
  await fs.readFile("assets/catalog/inspiration/catalog-items.json", "utf8"),
);
const record = records.find((x) => x.id === "dragon-v-1");
if (!record) throw new Error("Missing original source");
await fs.mkdir(".cache", { recursive: true });
const cache = ".cache/color-resilience-check.json";
let input;
try {
  input = JSON.parse(await fs.readFile(cache, "utf8"));
} catch {
  input = {
    concept: record.title,
    catalogId: record.id,
    style: "fine_line",
    medium: "blackwork",
    clientId: "color-resilience-verification",
    requestId: `color-resilience-${crypto.randomUUID()}`,
    capabilityToken: crypto.randomBytes(32).toString("hex"),
    filters: { category: "all", artStyle: "any", colorMix: "mixed_color" },
  };
  await fs.writeFile(cache, JSON.stringify(input));
}
const response = await fetch(`${base}/api/stencils`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(input),
});
if (response.status !== 202)
  throw new Error(`Request not accepted: ${response.status}`);
const created = await response.json();
let job;
for (let attempt = 0; attempt < 120; attempt++) {
  const read = await fetch(
    `${base}/api/stencils/${created.id}?token=${encodeURIComponent(input.capabilityToken)}`,
  );
  if (!read.ok) throw new Error("Cannot read accepted request");
  job = await read.json();
  if (job.status === "failed")
    throw new Error(`Original request failed: ${job.error}`);
  if (job.status === "ready") break;
  if (attempt % 15 === 0)
    console.log("Preparing original and optional color:", job.status);
  await new Promise((r) => setTimeout(r, 2000));
}
if (
  job?.status !== "ready" ||
  job.options.length !== 1 ||
  job.source !== "catalog"
)
  throw new Error("Original design did not become ready");
const option = job.options[0];
if (option.catalogId !== record.id)
  throw new Error("Original catalog identity changed");
const original = await fetch(new URL(option.originalUrl, base));
const bytes = Buffer.from(await original.arrayBuffer());
const expected = await fs.readFile(
  `assets/catalog/inspiration/${record.filename}`,
);
if (!original.ok || !bytes.equals(expected))
  throw new Error("Original source bytes changed");
const stencil = await fetch(new URL(option.pngUrl, base));
if (!stencil.ok) throw new Error("Artist preparation unavailable");
if (option.colorStatus === "failed") {
  if (option.colorUrl || option.colorTreatment || !option.colorWarning)
    throw new Error("Unavailable color was mislabeled ready");
  const color = await fetch(
    `${base}/api/stencils/${created.id}/options/0-color.png?token=${encodeURIComponent(input.capabilityToken)}`,
    { redirect: "manual" },
  );
  if (color.status !== 409)
    throw new Error("Unavailable color endpoint exposed");
  console.log(
    "Verified: catalog original and mirrored preparation ready; optional color failed with a visible warning, no fake color URL, and protected endpoint returns 409.",
  );
} else if (option.colorStatus === "ready" && option.colorUrl) {
  console.log(
    "Verified: provider now returned a color version; original bytes and artist preparation remain ready.",
  );
} else throw new Error("Missing explicit color outcome");
