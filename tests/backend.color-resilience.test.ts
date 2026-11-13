import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class MockColorVersionError extends Error {
    constructor() {
      super(
        "The requested color version could not be prepared. Please create a new request to retry.",
      );
      this.name = "ColorVersionError";
    }
  }
  class MockPlatformServiceError extends Error {
    constructor(message = "platform_service_unavailable") {
      super(message);
      this.name = "PlatformServiceError";
    }
  }
  return {
    ColorVersionError: MockColorVersionError,
    PlatformServiceError: MockPlatformServiceError,
    color: vi.fn(),
    failed: vi.fn(),
    findJob: vi.fn(),
    findRequest: vi.fn(),
    generate: vi.fn(),
    getUrl: vi.fn(),
    insert: vi.fn(),
    options: vi.fn(),
    put: vi.fn(),
    save: vi.fn(),
    split: vi.fn(),
  };
});

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
  PlatformServiceError: mocks.PlatformServiceError,
  generateImage: mocks.generate,
  getCachedStencilDownloadUrl: mocks.getUrl,
  isStencilPlatformConfigured: vi.fn(() => true),
  putStencilObject: mocks.put,
}));
vi.mock("../server/stencils/colorVersion", () => ({
  ColorVersionError: mocks.ColorVersionError,
  createColorVersion: mocks.color,
  isColorVersionMode: (value: unknown) =>
    value === "monochrome" ||
    value === "red_accent" ||
    value === "blue_accent" ||
    value === "mixed_color",
  safeColorFailureDetails: () => ({
    reason: "image_service",
    httpStatus: 400,
    providerCode: "failed_precondition",
  }),
}));
vi.mock("../server/stencils/imageProcessor", () => ({
  createMirroredStencilPng: vi.fn().mockResolvedValue({
    png: Buffer.from("mirrored-from-original"),
    width: 64,
    height: 64,
  }),
  potraceIsAvailable: vi.fn().mockResolvedValue(false),
  splitContactSheet: mocks.split,
  stencilProcessingConfig: vi.fn(() => ({
    threshold: 180,
    minimumComponentPixels: 3,
  })),
  traceStencilSvg: vi.fn().mockResolvedValue(undefined),
}));

import {
  parseActualColorTreatments,
  persistActualColorTreatments,
} from "../server/stencils/colorOutcomes";
import { createAiJobPrompt } from "../server/stencils/jobMetadata";
import { registerStencilRoutes } from "../server/stencils/routes";
import { hashCapabilityToken, runStencilJob } from "../server/stencils/service";

const token = "a".repeat(64);
const id = "11111111-1111-4111-8111-111111111111";

function colorAiPrompt(
  colorMode: "red_accent" | "mixed_color" = "mixed_color",
): string {
  return createAiJobPrompt({
    version: 1,
    mode: "ai",
    concept: "rose",
    style: "fine_line",
    medium: "blackwork",
    filters: { category: "all", artStyle: "any", colorMix: colorMode },
    colorMode,
    fillEnclosedRegions: true,
  });
}

function queuedJob(prompt: string) {
  return {
    id,
    tokenHash: hashCapabilityToken(token),
    clientId: "resilience-test-client",
    concept: "rose",
    style: "fine_line",
    medium: "blackwork",
    prompt,
    status: "queued",
    stage: "Queued",
    progress: 0,
    error: null,
    createdAt: new Date("2026-10-26T00:00:00.000Z"),
  };
}

function readyJob(prompt: string) {
  return {
    ...queuedJob(prompt),
    status: "ready",
    stage: "Ready for preview",
    progress: 100,
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
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  mocks.color.mockResolvedValue({
    png: Buffer.from("colored"),
    treatment: "filled",
    width: 64,
    height: 64,
  });
  mocks.failed.mockResolvedValue(undefined);
  mocks.findJob.mockResolvedValue(undefined);
  mocks.findRequest.mockResolvedValue(undefined);
  mocks.generate.mockResolvedValue({
    bytes: Buffer.from("source-contact-sheet"),
    mimeType: "image/png",
  });
  mocks.getUrl.mockResolvedValue("https://storage.example.test/object");
  mocks.options.mockResolvedValue([]);
  mocks.put.mockResolvedValue(undefined);
  mocks.save.mockResolvedValue(undefined);
  mocks.split.mockResolvedValue(
    [0, 1, 2, 3].map((index) => ({
      index,
      bytes: Buffer.from(`original-${index}`),
      width: 32,
      height: 32,
    })),
  );
});

describe("optional filled color resilience", () => {
  it("records one unavailable AI option, continues once per remaining option, and keeps original-derived assets ready", async () => {
    const prompt = colorAiPrompt();
    mocks.findJob.mockResolvedValue(queuedJob(prompt));
    mocks.color.mockRejectedValueOnce(new mocks.ColorVersionError());

    await runStencilJob(id);

    expect(mocks.color).toHaveBeenCalledTimes(4);
    expect(mocks.failed).not.toHaveBeenCalled();
    expect(mocks.save).toHaveBeenCalledOnce();
    const [savedId, savedOptions, readyPrompt] = mocks.save.mock.calls[0];
    expect(savedId).toBe(id);
    expect(savedOptions).toHaveLength(4);
    expect(JSON.parse(readyPrompt).optionColorTreatments).toEqual([
      "unavailable",
      "filled",
      "filled",
      "filled",
    ]);
    expect(
      mocks.put.mock.calls.filter(([key]) =>
        String(key).endsWith("-original.png"),
      ),
    ).toHaveLength(4);
    expect(
      mocks.put.mock.calls.filter(([key]) =>
        String(key).endsWith("-stencil.png"),
      ),
    ).toHaveLength(4);
    expect(
      mocks.put.mock.calls
        .filter(([key]) => String(key).endsWith("-color.png"))
        .map(([key]) => key)
        .sort(),
    ).toEqual([
      `stencils/${id}/1-color.png`,
      `stencils/${id}/2-color.png`,
      `stencils/${id}/3-color.png`,
    ]);
    expect(console.warn).toHaveBeenCalledWith("[color-version-unavailable]", {
      jobId: id,
      index: 0,
      reason: "image_service",
      httpStatus: 400,
      providerCode: "failed_precondition",
    });

    mocks.options.mockResolvedValue(savedOptions);
    mocks.findJob.mockResolvedValue(readyJob(readyPrompt));
    await withServer(async (origin) => {
      const response = await fetch(
        `${origin}/api/stencils/${id}?token=${token}`,
      );
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload).toMatchObject({ source: "ai", status: "ready" });
      expect(payload.options[0]).toMatchObject({
        originalUrl: `/api/stencils/${id}/options/0-original.png?token=${token}`,
        colorStatus: "failed",
        colorWarning:
          "Your design is ready, but its color version could not be completed this time.",
      });
      expect(payload.options[0]).not.toHaveProperty("colorUrl");
      expect(payload.options[0]).not.toHaveProperty("colorTreatment");
      expect(payload.options[1]).toMatchObject({
        originalUrl: `/api/stencils/${id}/options/1-original.png?token=${token}`,
        colorStatus: "ready",
        colorTreatment: "filled",
        colorUrl: `/api/stencils/${id}/options/1-color.png?token=${token}`,
      });

      const unavailable = await fetch(
        `${origin}/api/stencils/${id}/options/0-color.png?token=${token}`,
        { redirect: "manual" },
      );
      expect(unavailable.status).toBe(409);
      await expect(unavailable.json()).resolves.toEqual({
        error: "color_version_unavailable",
      });
      expect(mocks.getUrl).not.toHaveBeenCalled();

      const invalidToken = await fetch(
        `${origin}/api/stencils/${id}/options/0-color.png?token=${"b".repeat(64)}`,
        { redirect: "manual" },
      );
      expect(invalidToken.status).toBe(401);
      expect(mocks.getUrl).not.toHaveBeenCalled();
    });
  });

  it("accepts only a typed storage_upload_failed while uploading an optional filled color", async () => {
    const prompt = colorAiPrompt("red_accent");
    const { PlatformServiceError } = await vi.importActual<
      typeof import("../server/stencils/platform")
    >("../server/stencils/platform");
    const uploadError = new PlatformServiceError("storage_upload_failed");
    mocks.findJob.mockResolvedValue(queuedJob(prompt));
    mocks.put.mockImplementation(async (key: string) => {
      if (key.endsWith("-color.png")) {
        throw uploadError;
      }
    });

    await runStencilJob(id);

    expect(uploadError).toMatchObject({
      name: "PlatformServiceError",
      message: "storage_upload_failed",
    });
    expect(console.warn).toHaveBeenCalledWith("[color-version-unavailable]", {
      jobId: id,
      index: 0,
      reason: "image_service",
      httpStatus: 400,
      providerCode: "failed_precondition",
    });
    expect(mocks.failed).not.toHaveBeenCalled();
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(
      JSON.parse(mocks.save.mock.calls[0][2]).optionColorTreatments,
    ).toEqual(["unavailable", "unavailable", "unavailable", "unavailable"]);
    expect(
      mocks.put.mock.calls.some(([key]) =>
        String(key).endsWith("-original.png"),
      ),
    ).toBe(true);
    expect(
      mocks.put.mock.calls.some(([key]) =>
        String(key).endsWith("-stencil.png"),
      ),
    ).toBe(true);
  });

  it("keeps AI source-generation failure as a real failed job", async () => {
    vi.clearAllMocks();
    mocks.failed.mockResolvedValue(undefined);
    mocks.generate.mockRejectedValue(
      new Error("source generation unavailable"),
    );
    const aiPrompt = createAiJobPrompt({
      version: 1,
      mode: "ai",
      concept: "unmatched constellation",
      style: "fine_line",
      medium: "blackwork",
      filters: { category: "all", artStyle: "any", colorMix: "red_accent" },
      colorMode: "red_accent",
      fillEnclosedRegions: true,
    });
    mocks.findJob.mockResolvedValue(queuedJob(aiPrompt));

    await runStencilJob(id);

    expect(mocks.color).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.failed).toHaveBeenCalledWith(
      id,
      "Your AI tattoo ideas could not be prepared. Please create a new request to retry.",
    );
  });

  it("validates unavailable outcomes at the same AI expected count as other actual outcomes", () => {
    const aiPrompt = createAiJobPrompt({
      version: 1,
      mode: "ai",
      concept: "unmatched constellation",
      style: "fine_line",
      medium: "blackwork",
      filters: { category: "all", artStyle: "any", colorMix: "red_accent" },
      colorMode: "red_accent",
      fillEnclosedRegions: true,
    });
    const ai = persistActualColorTreatments(aiPrompt, [
      "filled",
      "ink_only",
      "unavailable",
      "filled",
    ]);
    expect(parseActualColorTreatments(ai)).toEqual([
      "filled",
      "ink_only",
      "unavailable",
      "filled",
    ]);
    expect(() =>
      persistActualColorTreatments(aiPrompt, ["unavailable"]),
    ).toThrow("color_outcomes_invalid");
  });
});
