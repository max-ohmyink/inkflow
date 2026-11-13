import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findJob: vi.fn(),
  findRequest: vi.fn(),
  insert: vi.fn(),
  options: vi.fn(),
  put: vi.fn(),
  save: vi.fn(),
  generateImage: vi.fn(),
  getUrl: vi.fn(),
  failed: vi.fn(),
}));

vi.mock("../server/stencils/repository", () => ({
  countClientActiveJobs: vi.fn().mockResolvedValue(0),
  failOrphanedInProcessStencilJobs: vi.fn().mockResolvedValue(0),
  findStencilJob: mocks.findJob,
  findStencilJobByRequest: mocks.findRequest,
  insertStencilJob: mocks.insert,
  listQueuedStencilJobs: vi.fn().mockResolvedValue([]),
  listStencilOptions: mocks.options,
  markJobFailed: mocks.failed,
  markJobGenerating: vi.fn().mockResolvedValue(undefined),
  markJobProcessing: vi.fn().mockResolvedValue(undefined),
  saveReadyStencilOptions: mocks.save,
}));
vi.mock("../server/stencils/platform", () => ({
  generateImage: mocks.generateImage,
  getCachedStencilDownloadUrl: mocks.getUrl,
  isStencilPlatformConfigured: vi.fn(() => true),
  putStencilObject: mocks.put,
}));
vi.mock("../server/stencils/imageProcessor", () => ({
  createMirroredStencilPng: vi.fn().mockResolvedValue({
    png: Buffer.from("mirrored-original-only"),
    width: 12,
    height: 8,
  }),
  potraceIsAvailable: vi.fn().mockResolvedValue(false),
  stencilProcessingConfig: vi.fn(() => ({
    threshold: 180,
    minimumComponentPixels: 3,
  })),
  traceStencilSvg: vi.fn().mockResolvedValue(undefined),
}));

import {
  ColorVersionError,
  createColorVersion,
  type ColorVersionImageService,
} from "../server/stencils/colorVersion";
import { createAiJobPrompt } from "../server/stencils/jobMetadata";
import { registerStencilRoutes } from "../server/stencils/routes";
import { hashCapabilityToken, runStencilJob } from "../server/stencils/service";

const token = "a".repeat(64);
const readyId = "11111111-1111-4111-8111-111111111111";
const legacyId = "22222222-2222-4222-8222-222222222222";
const anyId = "33333333-3333-4333-8333-333333333333";

function setPixel(
  pixels: Buffer,
  width: number,
  x: number,
  y: number,
  rgb: readonly [number, number, number],
): void {
  const offset = (y * width + x) * 3;
  pixels[offset] = rgb[0];
  pixels[offset + 1] = rgb[1];
  pixels[offset + 2] = rgb[2];
}

async function pngFromPixels(
  pixels: Buffer,
  width = 12,
  height = 8,
): Promise<Buffer> {
  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}

async function rawRgb(
  input: Buffer,
): Promise<{ pixels: Buffer; width: number; height: number }> {
  const result = await sharp(input).raw().toBuffer({ resolveWithObject: true });
  return {
    pixels: result.data,
    width: result.info.width,
    height: result.info.height,
  };
}

function pixelAt(
  pixels: Buffer,
  width: number,
  x: number,
  y: number,
): readonly [number, number, number] {
  const offset = (y * width + x) * 3;
  return [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
}

async function artworkAndProposal(): Promise<{
  source: Buffer;
  proposal: Buffer;
}> {
  const sourcePixels = Buffer.alloc(12 * 8 * 3, 255);
  // Three isolated original-ink groups plus one black-only group; no colors may be drawn elsewhere.
  setPixel(sourcePixels, 12, 1, 3, [0, 0, 0]);
  setPixel(sourcePixels, 12, 2, 3, [0, 0, 0]);
  setPixel(sourcePixels, 12, 5, 3, [0, 0, 0]);
  setPixel(sourcePixels, 12, 6, 3, [0, 0, 0]);
  setPixel(sourcePixels, 12, 9, 3, [0, 0, 0]);
  setPixel(sourcePixels, 12, 10, 3, [0, 0, 0]);
  setPixel(sourcePixels, 12, 5, 7, [0, 0, 0]);

  const proposalPixels = Buffer.alloc(12 * 8 * 3, 255);
  setPixel(proposalPixels, 12, 1, 3, [220, 40, 50]);
  setPixel(proposalPixels, 12, 5, 3, [45, 105, 230]);
  setPixel(proposalPixels, 12, 9, 3, [250, 210, 20]);
  return {
    source: await pngFromPixels(sourcePixels),
    proposal: await pngFromPixels(proposalPixels),
  };
}

function imageService(proposal: Buffer): ColorVersionImageService {
  return {
    generateImage: vi
      .fn()
      .mockResolvedValue({ bytes: proposal, mimeType: "image/png" }),
  };
}

async function withServer(
  callback: (origin: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use(express.json());
  registerStencilRoutes(app);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

function v2Prompt(
  colorMix: "any" | "red_accent" | "blue_accent" | "mixed_color" | "monochrome",
): string {
  return createAiJobPrompt({
    version: 1,
    mode: "ai",
    concept: "tulip",
    style: "fine_line",
    medium: "blackwork",
    filters: { category: "all", artStyle: "any", colorMix },
    colorMode: colorMix,
    fillEnclosedRegions: true,
  });
}

function readyJob(id: string, prompt: string) {
  return {
    id,
    tokenHash: hashCapabilityToken(token),
    clientId: "test-client",
    concept: "tulip",
    style: "fine_line",
    medium: "blackwork",
    prompt,
    status: "ready",
    stage: "Ready for preview",
    progress: 100,
    error: null,
    createdAt: new Date("2026-10-23T00:00:00.000Z"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findRequest.mockResolvedValue(undefined);
  mocks.findJob.mockResolvedValue(undefined);
  mocks.options.mockResolvedValue([
    {
      id: "option-1",
      optionIndex: 0,
      originalStorageKey: `stencils/${readyId}/0-original.png`,
      stencilStorageKey: `stencils/${readyId}/0-stencil.png`,
      svgStorageKey: null,
      width: 12,
      height: 8,
    },
  ]);
  mocks.put.mockResolvedValue(undefined);
  mocks.save.mockResolvedValue(undefined);
  mocks.getUrl.mockResolvedValue("https://storage.example.test/object");
  mocks.generateImage.mockRejectedValue(
    new Error("provider must not be called"),
  );
  mocks.failed.mockResolvedValue(undefined);
});

describe("original-constrained color versions", () => {
  it("uses the exact original PNG as the only provider reference, preserves it, and retains native geometry", async () => {
    const { source, proposal } = await artworkAndProposal();
    const immutableOriginal = Buffer.from(source);
    const service = imageService(proposal);

    const result = await createColorVersion(source, "red_accent", service);
    const output = await rawRgb(result.png);
    const generated = service.generateImage as ReturnType<typeof vi.fn>;

    expect(source.equals(immutableOriginal)).toBe(true);
    expect(generated).toHaveBeenCalledOnce();
    const [prompt, references] = generated.mock.calls[0];
    expect(prompt).toContain("Change only the ink color");
    expect(references).toHaveLength(1);
    expect(references[0]).toMatchObject({ mimeType: "image/png" });
    expect(Buffer.from(references[0].b64Json, "base64").equals(source)).toBe(
      true,
    );
    expect(result.width).toBe(12);
    expect(result.height).toBe(8);
    expect(output.width).toBe(12);
    expect(output.height).toBe(8);
    expect(pixelAt(output.pixels, 12, 1, 3)).toEqual([212, 61, 66]);
    // A white original pixel stays white even beside a saturated proposal pixel.
    expect(pixelAt(output.pixels, 12, 1, 2)).toEqual([255, 255, 255]);
    // A remote black-only original stroke stays black when the local proposal has no requested accent.
    expect(pixelAt(output.pixels, 12, 5, 7)).toEqual([0, 0, 0]);
  });

  it("creates requested red, blue, and mixed red/blue/Burmese-yellow pixels only from matching proposal colors", async () => {
    const { source, proposal } = await artworkAndProposal();
    const red = await rawRgb(
      (await createColorVersion(source, "red_accent", imageService(proposal)))
        .png,
    );
    const blue = await rawRgb(
      (await createColorVersion(source, "blue_accent", imageService(proposal)))
        .png,
    );
    const mixed = await rawRgb(
      (await createColorVersion(source, "mixed_color", imageService(proposal)))
        .png,
    );

    expect(pixelAt(red.pixels, 12, 1, 3)).toEqual([212, 61, 66]);
    expect(pixelAt(red.pixels, 12, 5, 3)).toEqual([0, 0, 0]);
    expect(pixelAt(blue.pixels, 12, 5, 3)).toEqual([63, 112, 191]);
    expect(pixelAt(blue.pixels, 12, 1, 3)).toEqual([0, 0, 0]);
    expect(pixelAt(mixed.pixels, 12, 1, 3)).toEqual([212, 61, 66]);
    expect(pixelAt(mixed.pixels, 12, 5, 3)).toEqual([63, 112, 191]);
    expect(pixelAt(mixed.pixels, 12, 9, 3)).toEqual([246, 204, 17]);
    expect(pixelAt(mixed.pixels, 12, 8, 2)).toEqual([255, 255, 255]);
  });

  it("makes monochrome locally with no provider call and fails instead of returning an unchanged non-monochrome fallback", async () => {
    const { source, proposal } = await artworkAndProposal();
    const monochromeService = imageService(proposal);
    const monochrome = await rawRgb(
      (await createColorVersion(source, "monochrome", monochromeService)).png,
    );
    expect(monochromeService.generateImage).not.toHaveBeenCalled();
    expect(monochrome.width).toBe(12);
    expect(monochrome.height).toBe(8);
    for (let offset = 0; offset < monochrome.pixels.length; offset += 3) {
      expect(monochrome.pixels[offset]).toBe(monochrome.pixels[offset + 1]);
      expect(monochrome.pixels[offset + 1]).toBe(monochrome.pixels[offset + 2]);
    }

    const uncoloredProposal = Buffer.alloc(12 * 8 * 3, 255);
    await expect(
      createColorVersion(
        source,
        "red_accent",
        imageService(await pngFromPixels(uncoloredProposal)),
      ),
    ).rejects.toBeInstanceOf(ColorVersionError);
  });

});

describe("versioned color asset access", () => {
  it("publishes protected color URLs, never mislabels original URLs, and keeps old catalog rows and any-color jobs without color endpoints", async () => {
    const redPrompt = v2Prompt("red_accent");
    const anyPrompt = v2Prompt("any");
    const v1Prompt = JSON.stringify({
      version: 1,
      mode: "catalog",
      catalogIds: ["fine-line-tulip"],
      filters: { category: "all", artStyle: "any", colorMix: "red_accent" },
    });

    mocks.findJob.mockImplementation(async (id: string) => {
      if (id === readyId) return readyJob(readyId, redPrompt);
      if (id === legacyId) return readyJob(legacyId, v1Prompt);
      if (id === anyId) return readyJob(anyId, anyPrompt);
      return undefined;
    });
    mocks.options.mockResolvedValue([
      {
        id: "option-1",
        optionIndex: 0,
        originalStorageKey: "stored-original",
        stencilStorageKey: "stored-stencil",
        svgStorageKey: null,
        width: 12,
        height: 8,
      },
    ]);

    await withServer(async (origin) => {
      const redResponse = await fetch(
        `${origin}/api/stencils/${readyId}?token=${token}`,
      );
      expect(redResponse.status).toBe(200);
      const red = await redResponse.json();
      expect(red.options[0]).toMatchObject({
        colorMode: "red_accent",
        originalUrl: `/api/stencils/${readyId}/options/0-original.png?token=${token}`,
        colorUrl: `/api/stencils/${readyId}/options/0-color.png?token=${token}`,
      });
      expect(red.options[0].originalUrl).not.toContain("-color.png");

      const colorAsset = await fetch(`${origin}${red.options[0].colorUrl}`, {
        redirect: "manual",
      });
      expect(colorAsset.status).toBe(307);
      expect(mocks.getUrl).toHaveBeenLastCalledWith(
        `stencils/${readyId}/0-color.png`,
      );
      const forbiddenColor = await fetch(
        `${origin}/api/stencils/${readyId}/options/0-color.png?token=${"b".repeat(64)}`,
        { redirect: "manual" },
      );
      expect(forbiddenColor.status).toBe(401);

      const legacyResponse = await fetch(
        `${origin}/api/stencils/${legacyId}?token=${token}`,
      );
      expect(legacyResponse.status).toBe(200);
      const legacy = await legacyResponse.json();
      expect(legacy.options[0]).not.toHaveProperty("colorMode");
      expect(legacy.options[0]).not.toHaveProperty("colorUrl");
      const legacyColor = await fetch(
        `${origin}/api/stencils/${legacyId}/options/0-color.png?token=${token}`,
        { redirect: "manual" },
      );
      expect(legacyColor.status).toBe(404);

      const anyResponse = await fetch(
        `${origin}/api/stencils/${anyId}?token=${token}`,
      );
      expect(anyResponse.status).toBe(200);
      const any = await anyResponse.json();
      expect(any.options[0]).toMatchObject({ colorMode: "any" });
      expect(any.options[0]).not.toHaveProperty("colorUrl");
      const anyColor = await fetch(
        `${origin}/api/stencils/${anyId}/options/0-color.png?token=${token}`,
        { redirect: "manual" },
      );
      expect(anyColor.status).toBe(404);
    });
  });
});
