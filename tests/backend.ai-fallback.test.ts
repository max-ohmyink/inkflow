import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRequest: vi.fn(),
  findJob: vi.fn(),
  insert: vi.fn(),
  options: vi.fn(),
  put: vi.fn(),
  save: vi.fn(),
  failed: vi.fn(),
  generate: vi.fn(),
  getUrl: vi.fn(),
  split: vi.fn(),
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
  generateImage: mocks.generate,
  getCachedStencilDownloadUrl: mocks.getUrl,
  isStencilPlatformConfigured: vi.fn(() => true),
  putStencilObject: mocks.put,
}));
vi.mock("../server/stencils/imageProcessor", () => ({
  createMirroredStencilPng: vi.fn().mockResolvedValue({
    png: Buffer.from("mirrored"),
    width: 64,
    height: 64,
  }),
  splitContactSheet: mocks.split,
  potraceIsAvailable: vi.fn().mockResolvedValue(false),
  stencilProcessingConfig: vi.fn(() => ({
    threshold: 180,
    minimumComponentPixels: 3,
  })),
  traceStencilSvg: vi.fn().mockResolvedValue(undefined),
}));

import {
  createCatalogJobPrompt,
  getValidatedCatalogRecord,
} from "../server/stencils/catalogOutput";
import {
  createAiJobPrompt,
  parseAiJobPrompt,
} from "../server/stencils/jobMetadata";
import { persistActualColorTreatments } from "../server/stencils/colorOutcomes";
import {
  parseStencilInput,
  StencilInputError,
} from "../server/stencils/prompt";
import { registerStencilRoutes } from "../server/stencils/routes";
import {
  createStencilJob,
  hashCapabilityToken,
  runStencilJob,
} from "../server/stencils/service";

const token = "a".repeat(64);
const id = "11111111-1111-4111-8111-111111111111";
const baseInput = {
  concept: "fine line flower",
  style: "fine_line" as const,
  medium: "blackwork" as const,
  clientId: "fallback-test-client",
  capabilityToken: token,
};

function aiPrompt(
  colorMode: "any" | "monochrome" | "red_accent" = "any",
): string {
  return createAiJobPrompt({
    version: 1,
    mode: "ai",
    concept: "nebula",
    style: "fine_line",
    medium: "blackwork",
    filters: {
      category: "all",
      artStyle: "fine_line",
      colorMix: colorMode,
    },
    colorMode,
    fillEnclosedRegions: true,
  });
}

function legacyAiPrompt(
  colorMode: "any" | "monochrome" | "red_accent" = "any",
): string {
  return createAiJobPrompt({
    version: 1,
    mode: "ai",
    concept: "nebula",
    style: "cyber",
    medium: "blackwork",
    filters: {
      category: "all",
      artStyle: "cyber_ornamental",
      colorMix: colorMode,
    },
    colorMode,
    fillEnclosedRegions: true,
  });
}

function job(prompt: string, status: "queued" | "ready" = "queued") {
  return {
    id,
    tokenHash: hashCapabilityToken(token),
    clientId: baseInput.clientId,
    concept: "nebula",
    style: "fine_line",
    medium: "blackwork",
    prompt,
    status,
    stage: status === "ready" ? "Ready for preview" : "Queued",
    progress: status === "ready" ? 100 : 0,
    error: null,
    createdAt: new Date("2026-10-26T00:00:00.000Z"),
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findRequest.mockResolvedValue(undefined);
  mocks.findJob.mockResolvedValue(undefined);
  mocks.insert.mockResolvedValue(undefined);
  mocks.options.mockResolvedValue([
    {
      id: "option-1",
      optionIndex: 0,
      originalStorageKey: `stencils/${id}/0-original.png`,
      stencilStorageKey: `stencils/${id}/0-stencil.png`,
      svgStorageKey: null,
      width: 64,
      height: 64,
    },
  ]);
  mocks.put.mockResolvedValue(undefined);
  mocks.save.mockResolvedValue(undefined);
  mocks.failed.mockResolvedValue(undefined);
  mocks.getUrl.mockResolvedValue("https://storage.example.test/object");
  mocks.generate.mockResolvedValue({
    bytes: Buffer.from("contact-sheet"),
    mimeType: "image/png",
  });
  mocks.split.mockResolvedValue(
    [0, 1, 2, 3].map((index) => ({
      index,
      bytes: Buffer.from(`original-${index}`),
      width: 32,
      height: 32,
    })),
  );
});

afterEach(async () => {
  // createStencilJob intentionally enqueues asynchronously; let metadata-only tests drain while
  // their findJob mock still resolves undefined so they cannot observe a later test's job fixture.
  await new Promise<void>((resolve) => setImmediate(resolve));
  vi.clearAllMocks();
});

describe("catalog-first source decisions", () => {
  it("returns a catalog hit without calling the AI provider or adding AI padding", async () => {
    await createStencilJob({ ...baseInput, requestId: "catalog-hit" });

    const stored = JSON.parse(mocks.insert.mock.calls[0][0].prompt);
    expect(stored.mode).toBe("catalog");
    expect(stored.catalogIds).toEqual([
      "fine-line-flower",
      "fine-line-tulip",
      "smile-daisy",
      "fine-line-rose-1",
    ]);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("keeps a partial strict catalog hit catalog-only rather than issuing a contact-sheet call", async () => {
    const partial = [getValidatedCatalogRecord("moon-with-leaf")!];

    await createStencilJob({
      ...baseInput,
      concept: "moon with leaf",
      requestId: "partial-catalog-hit",
    });

    const stored = JSON.parse(mocks.insert.mock.calls[0][0].prompt);
    expect(stored).toMatchObject({
      mode: "catalog",
      catalogIds: partial.map((record) => record.id),
    });
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("uses palette as output intent, not retrieval, and rejects an invalid exact ID without fallback", async () => {
    await createStencilJob({
      ...baseInput,
      requestId: "palette-not-retrieval",
      catalogId: "fine-line-tulip",
      filters: {
        category: "all",
        artStyle: "any",
        colorMix: "red_accent",
      },
    });
    expect(JSON.parse(mocks.insert.mock.calls[0][0].prompt)).toMatchObject({
      mode: "catalog",
      catalogIds: ["fine-line-tulip"],
      colorMode: "red_accent",
    });

    vi.clearAllMocks();
    mocks.findRequest.mockResolvedValue(undefined);
    await expect(
      createStencilJob({
        ...baseInput,
        requestId: "invalid-exact",
        catalogId: "missing-catalog-id",
      }),
    ).rejects.toEqual(new StencilInputError("catalog_no_match"));
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("keeps frontend Surprise me catalog-first and blocks blank/mandala input before provider work", async () => {
    expect(
      parseStencilInput({ ...baseInput, concept: "Surprise me" }).concept,
    ).toBe("Surprise me");
    expect(() => parseStencilInput({ ...baseInput, concept: "" })).toThrow(
      "invalid_request",
    );
    expect(() =>
      parseStencilInput({ ...baseInput, concept: "small mandala flower" }),
    ).toThrow("instant_draw_only");
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});

describe("persisted AI fallback", () => {
  it("persists stable AI source metadata before queueing a zero-match free-text request", async () => {
    await createStencilJob({
      ...baseInput,
      concept: "nebula",
      requestId: "zero-match-fallback",
      filters: {
        category: "all",
        artStyle: "fine_line",
        colorMix: "any",
      },
    });

    const stored = parseAiJobPrompt(mocks.insert.mock.calls[0][0].prompt);
    expect(stored).toEqual({
      version: 1,
      mode: "ai",
      concept: "nebula",
      style: "fine_line",
      medium: "blackwork",
      filters: {
        category: "all",
        artStyle: "fine_line",
        colorMix: "any",
      },
      colorMode: "any",
      fillEnclosedRegions: true,
    });
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("generates one 2x2 contact sheet, stores four separate originals, and prepares four AI options", async () => {
    mocks.findJob.mockResolvedValue(job(aiPrompt()));

    await runStencilJob(id);

    expect(mocks.generate).toHaveBeenCalledOnce();
    expect(mocks.generate.mock.calls[0][0]).toContain(
      "Create 4 distinct instant-draw outline variations of nebula.",
    );
    expect(mocks.generate.mock.calls[0][0]).toContain(
      "simple monoline outline",
    );
    expect(mocks.generate.mock.calls[0][0]).toContain("--no mandalas");
    expect(mocks.split).toHaveBeenCalledWith(Buffer.from("contact-sheet"));
    expect(mocks.failed).not.toHaveBeenCalled();
    expect(
      mocks.put.mock.calls.filter(([key]) =>
        String(key).endsWith("-original.png"),
      ),
    ).toHaveLength(4);
    expect(mocks.save).toHaveBeenCalledWith(
      id,
      expect.arrayContaining([
        expect.objectContaining({ optionIndex: 0 }),
        expect.objectContaining({ optionIndex: 1 }),
        expect.objectContaining({ optionIndex: 2 }),
        expect.objectContaining({ optionIndex: 3 }),
      ]),
    );
    expect(mocks.failed).not.toHaveBeenCalled();
  });

  it("reuses a proved idempotency credential before source selection or provider work", async () => {
    mocks.findRequest.mockResolvedValue({
      id: "existing-ai-job",
      tokenHash: hashCapabilityToken(token),
    });

    await expect(
      createStencilJob({
        ...baseInput,
        concept: "nebula",
        requestId: "same-ai-request",
      }),
    ).resolves.toEqual({ id: "existing-ai-job", token, reused: false });
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("fails malformed versioned source metadata without catalog or provider fallthrough", async () => {
    mocks.findJob.mockResolvedValue(
      job(JSON.stringify({ version: 999, mode: "ai", concept: "nebula" })),
    );

    await runStencilJob(id);

    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.failed).toHaveBeenCalledOnce();
  });
});

describe("public source and color compatibility", () => {
  it("exposes AI source and a neutral concept-based title without fake catalog provenance", async () => {
    mocks.findJob.mockResolvedValue(
      job(
        persistActualColorTreatments(legacyAiPrompt("red_accent"), [
          "filled",
          "filled",
          "filled",
          "filled",
        ]),
        "ready",
      ),
    );

    await withServer(async (origin) => {
      const response = await fetch(
        `${origin}/api/stencils/${id}?token=${token}`,
      );
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload).toMatchObject({ source: "ai" });
      expect(payload.options[0]).toMatchObject({
        source: "ai",
        title: "AI-created nebula — variation 1",
        colorMode: "red_accent",
        colorTreatment: "filled",
      });
      expect(payload.options[0]).not.toHaveProperty("catalogId");
      expect(payload.options[0]).not.toHaveProperty("collection");
      expect(payload.options[0]).not.toHaveProperty("page");
    });
  });

  it("keeps V1 without color access and labels ready V2 color as ink_only behind capability auth", async () => {
    const v1Prompt = JSON.stringify({
      version: 1,
      mode: "catalog",
      catalogIds: ["fine-line-tulip"],
      filters: { category: "all", artStyle: "any", colorMix: "red_accent" },
    });
    const v2Prompt = JSON.stringify({
      version: 2,
      mode: "catalog",
      catalogIds: ["fine-line-tulip"],
      filters: { category: "all", artStyle: "any", colorMix: "red_accent" },
      colorMode: "red_accent",
    });
    const v2Id = "22222222-2222-4222-8222-222222222222";
    mocks.findJob.mockImplementation(async (requestedId: string) => {
      if (requestedId === id) return job(v1Prompt, "ready");
      if (requestedId === v2Id) return { ...job(v2Prompt, "ready"), id: v2Id };
      return undefined;
    });

    await withServer(async (origin) => {
      const v1 = await fetch(`${origin}/api/stencils/${id}?token=${token}`);
      expect(v1.status).toBe(200);
      expect((await v1.json()).options[0]).not.toHaveProperty("colorUrl");

      const v2 = await fetch(`${origin}/api/stencils/${v2Id}?token=${token}`);
      const v2Payload = await v2.json();
      expect(v2Payload.options[0]).toMatchObject({
        source: "catalog",
        colorTreatment: "ink_only",
      });
      const forbidden = await fetch(
        `${origin}/api/stencils/${v2Id}/options/0-color.png?token=${"b".repeat(64)}`,
        { redirect: "manual" },
      );
      expect(forbidden.status).toBe(401);
    });
  });

  it("marks new V3 catalog colors as filled only when the color asset is ready", async () => {
    const prompt = createCatalogJobPrompt(
      [getValidatedCatalogRecord("fine-line-tulip")!],
      {
        category: "all",
        artStyle: "any",
        colorMix: "red_accent",
      },
    );
    mocks.findJob.mockResolvedValue(
      job(persistActualColorTreatments(prompt, ["filled"]), "ready"),
    );

    await withServer(async (origin) => {
      const response = await fetch(
        `${origin}/api/stencils/${id}?token=${token}`,
      );
      const payload = await response.json();
      expect(payload.options[0]).toMatchObject({
        source: "catalog",
        colorTreatment: "filled",
      });
    });
  });
  it("persists and serves actual mixed open-line and enclosed AI color outcomes rather than inferring filled from intent", async () => {
    const makeSource = async (closed: boolean) => {
      const pixels = Buffer.alloc(12 * 12 * 3, 255);
      for (let y = 2; y <= 9; y++)
        for (let x = 2; x <= 9; x++) {
          if (x === 2 || y === 2 || y === 9 || (closed && x === 9))
            pixels.fill(0, (y * 12 + x) * 3, (y * 12 + x) * 3 + 3);
        }
      return sharp(pixels, { raw: { width: 12, height: 12, channels: 3 } })
        .png()
        .toBuffer();
    };
    const open = await makeSource(false),
      closed = await makeSource(true);
    const proposal = await sharp({
      create: {
        width: 12,
        height: 12,
        channels: 3,
        background: { r: 220, g: 40, b: 50 },
      },
    })
      .png()
      .toBuffer();
    mocks.generate.mockResolvedValue({
      bytes: proposal,
      mimeType: "image/png",
    });
    mocks.split.mockResolvedValue(
      [open, closed, open, closed].map((bytes, index) => ({
        index,
        bytes,
        width: 12,
        height: 12,
      })),
    );
    mocks.findJob.mockResolvedValue(job(aiPrompt("red_accent")));
    await runStencilJob(id);
    expect(mocks.failed).not.toHaveBeenCalled();
    expect(mocks.generate).toHaveBeenCalledTimes(5);
    const [readyJobId, options, actualPrompt] = mocks.save.mock.calls[0];
    expect(readyJobId).toBe(id);
    expect(JSON.parse(actualPrompt).optionColorTreatments).toEqual([
      "ink_only",
      "filled",
      "ink_only",
      "filled",
    ]);
    mocks.options.mockResolvedValue(options);
    mocks.findJob.mockResolvedValue(job(actualPrompt, "ready"));
    await withServer(async (origin) => {
      const response = await fetch(
        `${origin}/api/stencils/${id}?token=${token}`,
      );
      const payload = await response.json();
      expect(
        payload.options.map(
          (option: { colorTreatment: string }) => option.colorTreatment,
        ),
      ).toEqual(["ink_only", "filled", "ink_only", "filled"]);
      expect(
        payload.options.every(
          (option: { source: string }) => option.source === "ai",
        ),
      ).toBe(true);
    });
  });
  it("does not guess a filled label for an older ready V3 color asset without actual outcome metadata", async () => {
    mocks.findJob.mockResolvedValue(
      job(
        createCatalogJobPrompt(
          [getValidatedCatalogRecord("fine-line-tulip")!],
          { category: "all", artStyle: "any", colorMix: "red_accent" },
        ),
        "ready",
      ),
    );
    await withServer(async (origin) => {
      const response = await fetch(
        `${origin}/api/stencils/${id}?token=${token}`,
      );
      const payload = await response.json();
      expect(payload.options[0]).toHaveProperty("colorUrl");
      expect(payload.options[0]).not.toHaveProperty("colorTreatment");
    });
  });
});
