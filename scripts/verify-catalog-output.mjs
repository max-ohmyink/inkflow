import fs from "node:fs/promises";
import crypto from "node:crypto";

// Creates one real catalog preparation request, never an image-generation request.
// Keep capability credentials in the ignored cache; do not print or distribute them.
const base = process.env.CATALOG_CHECK_API_ORIGIN || "http://127.0.0.1:3000";
const records = JSON.parse(await fs.readFile("assets/catalog/inspiration/catalog-items.json", "utf8"));
const selected = records.find(record => record.id === "fine-line-tulip");
if (!selected) throw new Error("Expected source catalog record is missing");
const token = crypto.randomBytes(32).toString("hex");
const input = { concept: selected.title, catalogId: selected.id, style: "fine_line", medium: "blackwork", clientId: "catalog-verification", requestId: `catalog-check-${crypto.randomUUID()}`, capabilityToken: token };
const post = await fetch(`${base}/api/stencils`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
if (post.status !== 202) throw new Error(`Catalog check was not accepted (${post.status})`);
const created = await post.json();
await fs.mkdir(".cache", { recursive: true });
await fs.writeFile(".cache/catalog-output-check.json", JSON.stringify({ id: created.id, token, catalogId: selected.id }));
let job;
for (let attempt = 0; attempt < 45; attempt++) {
  const response = await fetch(`${base}/api/stencils/${created.id}?token=${encodeURIComponent(token)}`);
  if (!response.ok) throw new Error("Unable to read accepted catalog request");
  job = await response.json();
  if (job.status === "failed") throw new Error("Catalog preparation failed");
  if (job.status === "ready") break;
  if (attempt % 5 === 0) console.log("Catalog preparation in progress:", job.status);
  await new Promise(resolve => setTimeout(resolve, 2000));
}
if (job?.status !== "ready") throw new Error("Catalog preparation timed out");
if (job.source !== "catalog" || job.options.length !== 1 || job.options[0].catalogId !== selected.id || job.options[0].title !== selected.title || job.options[0].page !== selected.page) throw new Error("Catalog identity/provenance does not match the selected original");
const original = await fetch(new URL(job.options[0].originalUrl, base));
if (!original.ok) throw new Error("Original catalog PNG could not be downloaded");
const output = Buffer.from(await original.arrayBuffer());
const source = await fs.readFile(`assets/catalog/inspiration/${selected.filename}`);
if (!source.equals(output)) throw new Error("Guest original was changed instead of copied byte-for-byte");
console.log("Verified original catalog output:", selected.title, "source page", selected.page, "SHA-256", crypto.createHash("sha256").update(output).digest("hex"));
console.log("Exactly one selected original; unchanged bytes; catalog title/collection/page preserved.");
