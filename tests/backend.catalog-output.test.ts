import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRequest: vi.fn(),
  findJob: vi.fn(),
  insert: vi.fn(),
  put: vi.fn(),
  save: vi.fn(),
  generateImage: vi.fn(() => {
    throw new Error("image generation must not be called");
  }),
}));

vi.mock("../server/stencils/repository", () => ({
  countClientActiveJobs: vi.fn().mockResolvedValue(0),
  failOrphanedInProcessStencilJobs: vi.fn().mockResolvedValue(0),
  findStencilJob: mocks.findJob,
  findStencilJobByRequest: mocks.findRequest,
  insertStencilJob: mocks.insert,
  listQueuedStencilJobs: vi.fn().mockResolvedValue([]),
  markJobFailed: vi.fn(),
  markJobGenerating: vi.fn(),
  markJobProcessing: vi.fn(),
  saveReadyStencilOptions: mocks.save,
}));
vi.mock("../server/stencils/platform", () => ({
  generateImage: mocks.generateImage,
  generateContactSheet: mocks.generateImage,
  putStencilObject: mocks.put,
}));
vi.mock("../server/stencils/imageProcessor", () => ({
  createMirroredStencilPng: vi.fn().mockResolvedValue({
    png: Buffer.from("processed-stencil"),
    width: 160,
    height: 160,
  }),
  traceStencilSvg: vi.fn().mockResolvedValue(null),
}));

import {
  catalogOptionMetadataForPrompt,
  createCatalogJobPrompt,
  getValidatedCatalogRecord,
  eligibleCatalogRecords,
} from "../server/stencils/catalogOutput";
import { parseAiJobPrompt } from "../server/stencils/jobMetadata";
import { StencilInputError } from "../server/stencils/prompt";
import { createStencilJob, runStencilJob } from "../server/stencils/service";
import { findCatalogMatches } from "../shared/catalog-matching";

const token = "a".repeat(64);
const input = {
  concept: "tulip",
  style: "fine_line" as const,
  medium: "blackwork" as const,
  clientId: "ipad",
  requestId: "catalog-request",
  capabilityToken: token,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findRequest.mockResolvedValue(undefined);
  mocks.findJob.mockResolvedValue(undefined);
  mocks.put.mockResolvedValue(undefined);
  mocks.save.mockResolvedValue(undefined);
});

describe("catalog-backed stencil output", () => {
  it("persists only selected catalog source IDs and exposes index-joined provenance", async () => {
    await createStencilJob(input);

    expect(mocks.insert).toHaveBeenCalledOnce();
    const persisted = mocks.insert.mock.calls[0][0];
    const expected = findCatalogMatches(eligibleCatalogRecords, input.concept);
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThanOrEqual(4);
    expect(JSON.parse(persisted.prompt)).toEqual({
      version: 3,
      mode: "catalog",
      catalogIds: expected.map((record) => record.id),
      filters: { category: "all", artStyle: "any", colorMix: "any" },
      colorMode: "any",
      fillEnclosedRegions: true,
    });
    expect(catalogOptionMetadataForPrompt(persisted.prompt, 0)).toMatchObject({
      catalogId: expected[0].id,
      title: expected[0].title,
      collection: expected[0].collection,
      page: expected[0].page,
    });
    expect(mocks.generateImage).not.toHaveBeenCalled();
  });

  it("uses exactly the validated explicit catalogId when supplied", async () => {
    await createStencilJob({
      ...input,
      requestId: "exact-catalog-id",
      catalogId: "fine-line-tulip",
    });

    expect(JSON.parse(mocks.insert.mock.calls[0][0].prompt).catalogIds).toEqual(
      ["fine-line-tulip"],
    );
    expect(mocks.generateImage).not.toHaveBeenCalled();
  });

  it("persists an AI fallback decision for valid free text with zero catalog matches", async () => {
    await createStencilJob({
      ...input,
      requestId: "no-match",
      concept: "nebula",
    });

    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(parseAiJobPrompt(mocks.insert.mock.calls[0][0].prompt)).toEqual({
      version: 1,
      mode: "ai",
      concept: "nebula",
      style: "fine_line",
      medium: "blackwork",
      filters: { category: "all", artStyle: "any", colorMix: "any" },
      colorMode: "any",
      fillEnclosedRegions: true,
    });
    expect(mocks.generateImage).not.toHaveBeenCalled();
  });

  it("rejects a bad explicit catalog ID without persisting an AI replacement", async () => {
    await expect(
      createStencilJob({
        ...input,
        requestId: "bad-exact-id",
        catalogId: "not-a-catalog-record",
      }),
    ).rejects.toEqual(new StencilInputError("catalog_no_match"));

    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.generateImage).not.toHaveBeenCalled();
  });

  it("stores exact local original bytes and produces only the two selected options", async () => {
    const first = getValidatedCatalogRecord("fine-line-rose-1")!;
    const second = getValidatedCatalogRecord("fine-line-rose-2")!;
    const prompt = createCatalogJobPrompt([first, second]);
    mocks.findJob.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      clientId: "ipad",
      status: "queued",
      prompt,
      concept: "rose",
    });

    await runStencilJob("11111111-1111-4111-8111-111111111111");

    const originals = mocks.put.mock.calls.filter(([key]) =>
      String(key).endsWith("-original.png"),
    );
    expect(originals).toHaveLength(2);
    for (const [index, record] of [first, second].entries()) {
      const expected = readFileSync(
        path.join(process.cwd(), "assets/catalog/inspiration", record.filename),
      );
      expect(originals[index][1].equals(expected)).toBe(true);
      expect(originals[index][2]).toBe("image/png");
    }
    expect(mocks.save).toHaveBeenCalledOnce();
    const options = mocks.save.mock.calls[0][1];
    expect(options).toHaveLength(2);
    expect(
      options.map((option: { optionIndex: number }) => option.optionIndex),
    ).toEqual([0, 1]);
    expect(mocks.generateImage).not.toHaveBeenCalled();
  });
});
