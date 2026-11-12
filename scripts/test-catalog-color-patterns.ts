import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import {
  createColorVersion,
  findEnclosedWhiteRegions,
} from "../server/stencils/colorVersion";
import {
  tattooInkScreenPalette,
  type TattooInkId,
} from "../shared/tattoo-inks";

import { findGapAwareFillRegions } from "../server/stencils/gapAwareRegions";

async function main() {
  const catalog = JSON.parse(
    await fs.readFile("assets/catalog/inspiration/catalog-items.json", "utf8"),
  );
  const outputDir = "/home/ubuntu/output/gap-aware-color-tests";
  await fs.mkdir(outputDir, { recursive: true });
  const cases: { id: string; inks: TattooInkId[]; output: string }[] = [
    {
      id: "tiger",
      inks: ["orange", "lemon_yellow"],
      output: "Tiger-Color-Test.png",
    },
    {
      id: "butterfly-w-heart",
      inks: ["lake_blue", "rose_pink", "lemon_yellow"],
      output: "Butterfly-Color-Test.png",
    },
  ];
  const measurements: Record<string, unknown>[] = [];
  let providerCalls = 0;
  for (const item of cases) {
    const record = catalog.find((x: { id: string }) => x.id === item.id);
    if (!record) throw new Error(`Missing catalog record: ${item.id}`);
    const sourcePath = path.join("assets/catalog/inspiration", record.filename);
    const source = await fs.readFile(sourcePath);
    const hashBefore = crypto.createHash("sha256").update(source).digest("hex");
    const started = performance.now();
    const result = await createColorVersion(
      source,
      "custom",
      {
        generateImage: async () => {
          providerCalls++;
          throw new Error("Test prohibits AI calls");
        },
      },
      { fillEnclosedRegions: true, inkColors: item.inks },
    );
    const elapsedMs = Math.round(performance.now() - started);
    console.log("Render:", item.id, result.treatment);
    const rawSource = await sharp(source)
      .flatten({ background: "#FFFFFF" })
      .toColourspace("srgb")
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const rawOutput = await sharp(result.png)
      .flatten({ background: "#FFFFFF" })
      .toColourspace("srgb")
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (rawSource.info.channels !== 3 || rawOutput.info.channels !== 3)
      throw new Error("Unexpected RGB channel count");
    const width = rawSource.info.width;
    const height = rawSource.info.height;
    if (result.width !== width || result.height !== height)
      throw new Error("Native dimensions changed");
    const strictRegions = findEnclosedWhiteRegions(
      rawSource.data,
      width,
      height,
    );
    const regions = findGapAwareFillRegions(rawSource.data, width, height);
    const palette = tattooInkScreenPalette(item.inks);
    const pixelsByInk = Object.fromEntries(palette.map((p) => [p.id, 0]));
    let coloredPixels = 0;
    let outlinePixels = 0;
    let recoloredOutlinePixels = 0;
    let backgroundLeaks = 0;
    let unselectedColorPixels = 0;
    const filledLabels = new Set<number>();
    for (let pixel = 0; pixel < width * height; pixel++) {
      const offset = pixel * 3;
      const sourceMin = Math.min(
        rawSource.data[offset],
        rawSource.data[offset + 1],
        rawSource.data[offset + 2],
      );
      const rgb = [
        rawOutput.data[offset],
        rawOutput.data[offset + 1],
        rawOutput.data[offset + 2],
      ];
      if (sourceMin <= 230) {
        outlinePixels++;
        if (rgb.some((x) => x !== sourceMin)) recoloredOutlinePixels++;
      }
      if (result.treatment === "filled") {
        if (
          sourceMin > 230 &&
          !regions.labels[pixel] &&
          rgb.some((x) => x !== 255)
        )
          backgroundLeaks++;
      } else if (sourceMin === 255 && rgb.some((x) => x !== 255))
        backgroundLeaks++;
      if (Math.max(...rgb) - Math.min(...rgb) > 20) {
        coloredPixels++;
        if (result.treatment === "filled" && regions.labels[pixel])
          filledLabels.add(regions.labels[pixel]);
        const coverage = (255 - sourceMin) / 255;
        const ink = palette.find((p) =>
          p.rgb.every((v, index) =>
            result.treatment === "filled"
              ? v === rgb[index]
              : Math.round(255 * (1 - coverage) + v * coverage) === rgb[index],
          ),
        );
        if (ink) pixelsByInk[ink.id]++;
        else unselectedColorPixels++;
      }
    }
    const hashAfter = crypto
      .createHash("sha256")
      .update(await fs.readFile(sourcePath))
      .digest("hex");
    const checksPassed =
      hashBefore === hashAfter &&
      backgroundLeaks === 0 &&
      unselectedColorPixels === 0 &&
      providerCalls === 0 &&
      coloredPixels > 0 &&
      (result.treatment !== "filled" || recoloredOutlinePixels === 0);
    await fs.writeFile(path.join(outputDir, item.output), result.png);
    measurements.push({
      id: item.id,
      title: record.title,
      collection: record.collection,
      catalogPage: record.page,
      inks: palette.map((p) => ({ name: p.name, hex: p.hex })),
      width,
      height,
      treatment: result.treatment,
      enclosedRegions: regions.count,
      strictBaselineRegions: strictRegions.count,
      recoveredRegions: regions.count - strictRegions.count,
      meaningfulRegions: Array.from(regions.areas).filter((a) => a >= 4).length,
      filledRegions: filledLabels.size,
      coloredPixels,
      pixelsByInk,
      outlinePixels,
      recoloredOutlinePixels,
      backgroundLeaks,
      unselectedColorPixels,
      sourceUnchanged: hashBefore === hashAfter,
      providerCalls,
      elapsedMs,
      checksPassed,
      outputFile: item.output,
    });
  }
  await fs.writeFile(
    path.join(outputDir, "Test-Measurements.json"),
    JSON.stringify(measurements, null, 2) + "\n",
  );
  console.log(JSON.stringify(measurements, null, 2));
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
