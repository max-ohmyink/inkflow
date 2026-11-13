import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findRequest: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("../server/stencils/repository", () => ({
  countClientActiveJobs: mocks.count,
  failOrphanedInProcessStencilJobs: vi.fn(),
  findStencilJob: vi.fn(),
  findStencilJobByRequest: mocks.findRequest,
  insertStencilJob: mocks.insert,
  listQueuedStencilJobs: vi.fn(),
  markJobFailed: vi.fn(),
  markJobGenerating: vi.fn(),
  markJobProcessing: vi.fn(),
  saveReadyStencilOptions: vi.fn(),
}));

vi.mock("../server/stencils/platform", () => ({
  generateImage: vi.fn(),
  putStencilObject: vi.fn(),
}));

vi.mock("../server/stencils/imageProcessor", () => ({
  createMirroredStencilPng: vi.fn(),
  traceStencilSvg: vi.fn(),
}));

import {
  ALLOWED_FAMILY_ART_STYLE_IDS,
  isAllowedFamilyArtStyle,
} from "../shared/family-designs";
import {
  aiFallbackMetadataInput,
  compileAiFallbackGenerationPrompt,
} from "../server/stencils/aiFallback";
import { createStencilJob } from "../server/stencils/service";

const token = "a".repeat(64);
const input = {
  concept: "happy cloud",
  style: "cyber" as const,
  medium: "blackwork" as const,
  clientId: "family-test-client",
  requestId: "family-test-request",
  capabilityToken: token,
};

describe("family design policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findRequest.mockResolvedValue(undefined);
    mocks.count.mockResolvedValue(0);
  });

  it("allows only the family-friendly art styles", () => {
    expect([...ALLOWED_FAMILY_ART_STYLE_IDS].sort()).toEqual(
      [
        "any",
        "fine_line",
        "illustrated",
        "old_school",
        "traditional",
        "watercolor",
      ].sort(),
    );
    expect(isAllowedFamilyArtStyle("old_school")).toBe(true);
    expect(isAllowedFamilyArtStyle("cyber_ornamental")).toBe(false);
  });

  it("creates a canonically simple, friendly fallback brief even from a legacy style", () => {
    const prompt = compileAiFallbackGenerationPrompt({
      concept: "happy cloud",
      style: "cyber",
    });
    const metadata = aiFallbackMetadataInput("happy cloud", "cyber", {
      category: "all",
      artStyle: "any",
      colorMix: "any",
    });

    expect(metadata.style).toBe("fine_line");
    expect(prompt).toContain("one friendly, child-appropriate motif");
    expect(prompt).toContain("6–12 clean strokes");
    expect(prompt).toContain("--no scary masks");
    expect(prompt).toContain("--no gore");
    expect(prompt).toContain("--no weapons");
    expect(prompt).toContain("--no sexual or explicit content");
    expect(prompt).toContain("--no mandalas");
    expect(prompt).not.toContain("simple flowing monoline outline");
  });

  it("recovers an owned duplicate before family checks, then rejects a new unsupported style without new work", async () => {
    mocks.findRequest.mockResolvedValueOnce({
      id: "saved-job",
      tokenHash:
        "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb",
    });

    await expect(
      createStencilJob({
        ...input,
        filters: {
          category: "all",
          artStyle: "cyber_ornamental",
          colorMix: "any",
        },
      }),
    ).resolves.toEqual({ id: "saved-job", token, reused: false });

    mocks.findRequest.mockResolvedValueOnce(undefined);
    await expect(
      createStencilJob({
        ...input,
        requestId: "unsupported-style",
        filters: {
          category: "all",
          artStyle: "cyber_ornamental",
          colorMix: "any",
        },
      }),
    ).rejects.toMatchObject({ message: "family_design_only" });

    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects a new scary or explicit free-text theme before queueing work", async () => {
    await expect(
      createStencilJob({ ...input, concept: "small skull with a sword" }),
    ).rejects.toMatchObject({ message: "family_design_only" });

    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
