import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import sharp from "sharp";

const root = new URL("../web-build/", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
assert.match(
  html,
  /<title[^>]*>Oh My Ink - Live AI Tattoo Experience<\/title>/,
);
assert.match(html, /href=["']\/manifest\.webmanifest["']/);
assert.match(html, /apple-touch-icon/);
const manifest = JSON.parse(
  await readFile(new URL("manifest.webmanifest", root), "utf8"),
);
assert.equal(manifest.name, "Oh My Ink - Live AI Tattoo Experience");
assert.equal(manifest.display, "standalone");
assert.equal(manifest.start_url, "/");
for (const icon of manifest.icons) {
  const file = new URL(icon.src.slice(1), root);
  const metadata = await sharp(await readFile(file)).metadata();
  assert.equal(`${metadata.width}x${metadata.height}`, icon.sizes);
}
assert.ok(
  (await stat(new URL("web-icons/apple-touch-icon.png", root))).size > 0,
);
const routes = JSON.parse(
  await readFile(new URL("manus-routes.json", root), "utf8"),
);
assert.deepEqual(
  routes.routes.map((route) => route.path),
  ["/", "/?view=designs", "/?view=settings", "/oauth/callback"],
);
console.log(
  "Verified browser title, owned manifest, standalone display, installation icons and all declared browser routes.",
);
