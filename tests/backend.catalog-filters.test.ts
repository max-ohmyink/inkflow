import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRequest: vi.fn(),
  findJob: vi.fn(),
  insert: vi.fn(),
  options: vi.fn(),
  put: vi.fn(),
  save: vi.fn(),
  generateImage: vi.fn(),
}));

vi.mock("../server/stencils/repository", () => ({
  countClientActiveJobs: vi.fn().mockResolvedValue(0),
  failOrphanedInProcessStencilJobs: vi.fn().mockResolvedValue(0),
  findStencilJob: mocks.findJob,
  findStencilJobByRequest: mocks.findRequest,
  insertStencilJob: mocks.insert,
  listQueuedStencilJobs: vi.fn().mockResolvedValue([]),
  listStencilOptions: mocks.options,
  markJobFailed: vi.fn(),
  markJobGenerating: vi.fn(),
  markJobProcessing: vi.fn(),
  saveReadyStencilOptions: mocks.save,
}));
vi.mock("../server/stencils/platform", () => ({
  generateImage: mocks.generateImage,
  getCachedStencilDownloadUrl: vi.fn(),
  isStencilPlatformConfigured: vi.fn(() => true),
  putStencilObject: mocks.put,
}));
vi.mock("../server/stencils/imageProcessor", () => ({
  createMirroredStencilPng: vi.fn(),
  potraceIsAvailable: vi.fn().mockResolvedValue(false),
  stencilProcessingConfig: vi.fn(() => ({
    threshold: 180,
    minimumComponentPixels: 3,
  })),
  traceStencilSvg: vi.fn(),
}));

import {
  CATALOG_CATEGORY_OPTIONS,
  CATALOG_COLOR_OPTIONS,
  CATALOG_STYLE_OPTIONS,
  DEFAULT_CATALOG_FILTERS,
  catalogTrait,
  matchesCatalogFilters,
  type CatalogFilters,
} from "../shared/catalog-filters";
import {
  createCatalogJobPrompt,
  eligibleCatalogRecords,
  parseCatalogJobPrompt,
} from "../server/stencils/catalogOutput";
import { parseStencilInput } from "../server/stencils/prompt";
import { registerStencilRoutes } from "../server/stencils/routes";
import {
  createStencilJob,
  hashCapabilityToken,
  matchingCatalogRecords,
} from "../server/stencils/service";

const token = "a".repeat(64);
const baseInput = {
  concept: "rose",
  style: "fine_line" as const,
  medium: "blackwork" as const,
  clientId: "filter-test-client",
  capabilityToken: token,
};

function flowerFineLineMonochrome(): {
  record: (typeof eligibleCatalogRecords)[number];
  filters: CatalogFilters;
} {
  for (const record of eligibleCatalogRecords) {
    const trait = catalogTrait(record.id);
    const filters: CatalogFilters = {
      category: record.category,
      artStyle: "fine_line",
      colorMix: "monochrome",
    };
    if (
      /flower/i.test(`${record.collection} ${record.title}`) &&
      trait?.artStyles.includes("fine_line") &&
      trait.colorMix === "monochrome" &&
      matchesCatalogFilters(record, filters)
    ) {
      return { record, filters };
    }
  }
  throw new Error(
    "expected a trait-indexed Flower / Fine Line / Monochrome record",
  );
}

function filtersThatRejectEveryTraitOf(
  record: (typeof eligibleCatalogRecords)[number],
): CatalogFilters {
  const trait = catalogTrait(record.id);
  const category = CATALOG_CATEGORY_OPTIONS.find(
    (option) => option.id !== "all" && option.id !== record.category,
  )?.id;
  const artStyle = CATALOG_STYLE_OPTIONS.find(
    (option) => option.id !== "any" && !trait?.artStyles.includes(option.id),
  )?.id;
  const colorMix = CATALOG_COLOR_OPTIONS.find(
    (option) => option.id !== "any" && option.id !== trait?.colorMix,
  )?.id;
  if (!category || !artStyle || !colorMix) {
    throw new Error("expected alternate validated catalog filters");
  }
  return { category, artStyle, colorMix };
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
  mocks.options.mockResolvedValue([]);
  mocks.put.mockResolvedValue(undefined);
  mocks.save.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("catalog-backed stencil filters", () => {
  it("intersects the real Flower, Fine Line, and Monochrome choices before concept matching", () => {
    const { filters } = flowerFineLineMonochrome();
    const matches = matchingCatalogRecords("rose", filters);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches).toHaveLength(Math.min(4, matches.length));
    expect(
      matches.every((record) => matchesCatalogFilters(record, filters)),
    ).toBe(true);
    expect(
      matches.every((record) => record.category === filters.category),
    ).toBe(true);
  });

  it("rejects a validated exact catalog ID outside the chosen category, art style, and palette before insertion", async () => {
    const { record } = flowerFineLineMonochrome();
    const filters = filtersThatRejectEveryTraitOf(record);

    await expect(
      createStencilJob({
        ...baseInput,
        requestId: "mismatched-exact-id",
        catalogId: record.id,
        filters,
      }),
    ).rejects.toMatchObject({ message: "catalog_no_match" });

    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("ignores only colorMix for new catalog selection but persists it as V3 color intent", async () => {
    const { record } = flowerFineLineMonochrome();
    const trait = catalogTrait(record.id)!;
    const requestedColor = CATALOG_COLOR_OPTIONS.find(
      (option) => option.id !== "any" && option.id !== trait.colorMix,
    )!.id;
    const filters: CatalogFilters = {
      category: record.category,
      artStyle: "any",
      colorMix: requestedColor,
    };
    expect(matchesCatalogFilters(record, filters)).toBe(false);

    await createStencilJob({
      ...baseInput,
      requestId: "color-is-version-intent-not-selection",
      catalogId: record.id,
      filters,
    });

    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(JSON.parse(mocks.insert.mock.calls[0][0].prompt)).toMatchObject({
      version: 3,
      catalogIds: [record.id],
      filters,
      colorMode: requestedColor,
      fillEnclosedRegions: true,
    });
  });

  it("persists normalized defaults and supplied choices in V3 prompt metadata", async () => {
    await createStencilJob({ ...baseInput, requestId: "no-filters" });
    const versionThreeDefaults = JSON.parse(mocks.insert.mock.calls[0][0].prompt);
    expect(versionThreeDefaults).toMatchObject({
      version: 3,
      filters: DEFAULT_CATALOG_FILTERS,
      colorMode: "any",
      fillEnclosedRegions: true,
    });
    expect(
      parseCatalogJobPrompt(mocks.insert.mock.calls[0][0].prompt)?.filters,
    ).toEqual(DEFAULT_CATALOG_FILTERS);

    vi.clearAllMocks();
    mocks.findRequest.mockResolvedValue(undefined);
    mocks.insert.mockResolvedValue(undefined);
    const { filters } = flowerFineLineMonochrome();
    await createStencilJob({
      ...baseInput,
      requestId: "stored-filters",
      concept: "rose",
      filters,
    });
    const storedPrompt = mocks.insert.mock.calls[0][0].prompt;
    expect(JSON.parse(storedPrompt).filters).toEqual(filters);
    expect(JSON.parse(storedPrompt).colorMode).toBe(filters.colorMix);
    expect(parseCatalogJobPrompt(storedPrompt)?.filters).toEqual(filters);
  });

  it("maps an invalid filter enum to an invalid_request HTTP 400 before any job insertion", async () => {
    await withServer(async (origin) => {
      const response = await fetch(`${origin}/api/stencils`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...baseInput,
          filters: {
            category: "all",
            artStyle: "not-a-style",
            colorMix: "any",
          },
        }),
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "invalid_request",
      });
    });
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(() =>
      parseStencilInput({
        ...baseInput,
        filters: { category: "all", artStyle: "not-a-style", colorMix: "any" },
      }),
    ).toThrow("invalid_request");
  });

  it("returns parsed stored filters for catalog jobs and never relabels an omitted-filter catalog prompt as legacy", async () => {
    const { record, filters } = flowerFineLineMonochrome();
    const prompt = createCatalogJobPrompt([record], filters);
    const id = "11111111-1111-4111-8111-111111111111";
    mocks.findJob.mockResolvedValue({
      id,
      tokenHash: hashCapabilityToken(token),
      concept: "rose",
      style: "fine_line",
      medium: "blackwork",
      prompt,
      status: "ready",
      stage: "Ready for preview",
      progress: 100,
      error: null,
      createdAt: new Date("2026-10-23T00:00:00.000Z"),
    });

    await withServer(async (origin) => {
      const response = await fetch(
        `${origin}/api/stencils/${id}?token=${token}`,
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        source: "catalog",
        filters,
      });
    });
  });
});
