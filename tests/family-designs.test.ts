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

  it("allows the restored art styles for new work", () => {
    expect([...ALLOWED_FAMILY_ART_STYLE_IDS].sort()).toEqual(
      [
        "any",
        "blackwork",
        "tribal",
        "fine_line",
        "illustrated",
        "japanese",
        "neo_traditional",
        "old_school",
        "traditional",
        "watercolor",
      ].sort(),
    );
    expect(isAllowedFamilyArtStyle("old_school")).toBe(true);
    expect(isAllowedFamilyArtStyle("lettering")).toBe(false);
    expect(isAllowedFamilyArtStyle("cyber_ornamental")).toBe(false);
  });

  it("creates a refined fine-line brief from a legacy style, with only the explicit-content rule", () => {
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
    expect(prompt).toContain("elegant continuous-line fine-line tattoo");
    expect(prompt).toContain(
      "premium tattoo flash design by a master tattoo artist",
    );
    expect(prompt).not.toContain("6–12 clean strokes");
    expect(prompt).not.toMatch(
      /child|family|--no scary masks|--no weapons|--no mandalas/i,
    );
    expect(prompt).toContain("--no sexual or explicit content");
    expect(prompt).toContain("--no nudity");
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

  it("accepts classic dark tattoo themes but rejects explicit ones before queueing work", async () => {
    await expect(
      createStencilJob({ ...input, concept: "small skull with a sword" }),
    ).resolves.toMatchObject({ token });
    expect(mocks.insert).toHaveBeenCalledOnce();

    vi.clearAllMocks();
    mocks.findRequest.mockResolvedValue(undefined);
    mocks.count.mockResolvedValue(0);
    await expect(
      createStencilJob({
        ...input,
        requestId: "explicit-theme",
        concept: "nude figure",
      }),
    ).rejects.toMatchObject({ message: "family_design_only" });
    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
