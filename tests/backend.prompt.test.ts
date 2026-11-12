import { describe, expect, it } from "vitest";
import {
  INSTANT_DRAW_MESSAGE,
  isDisallowedInstantDrawConcept,
} from "../shared/instant-draw";
import {
  CONTACT_SHEET_LAYOUT_INSTRUCTIONS,
  compileGenerationPrompt,
  compileStencilPrompt,
  MEDIUM_OPTIONS,
  parseStencilInput,
  STYLE_OPTIONS,
} from "../server/stencils/prompt";

const styleProfiles = [
  {
    id: "fine_line",
    label: "Fine Line",
    snippet:
      "simple monoline outline, delicate clean contours, minimal hand-drawn flash",
  },
  {
    id: "traditional",
    label: "Bold Outline",
    snippet:
      "simple bold monoline outline, clean contours, minimal hand-drawn flash",
  },
  {
    id: "geometric",
    label: "Simple Shapes",
    snippet:
      "simple monoline outlines with basic shapes, clean contours, minimal hand-drawn flash",
  },
  {
    id: "cyber",
    label: "Flowing Lines",
    snippet:
      "simple flowing monoline outline, clean contours, minimal hand-drawn flash",
  },
] as const;

const mediumProfiles = [
  {
    id: "blackwork",
    label: "Classic Blackwork",
    snippet:
      "simple black outlines on pure white background, 100% monochrome, zero shading, high contrast line art",
  },
  {
    id: "jagua",
    label: "Jagua Stain",
    snippet:
      "deep blue-black simple outlines on pure white background, zero shading, high contrast line art",
  },
  {
    id: "twotone",
    label: "Two-Tone Accent",
    snippet:
      "simple black outlines with selective red ink accent highlights on pure white background, zero shading",
  },
] as const;

const constraints =
  "Constraints: One small recognizable motif; approximately 6–12 clean strokes as guidance, not a guarantee; minimal interior detail; open whitespace; high contrast on #FFFFFF for instant hand drawing; no overlapping, multi-subject, or dense effects.";
const negativeConstraints =
  "Negative Constraints: --no mandalas, radial ornaments, sacred geometry, dotwork, stippling, hatching, shading, solid filled areas, tiny intricate details, complex tribal patterns, 3D photorealism, skin, body parts, realistic shading, grey gradients, complex background clutter, shadows, blur";
const validRequest = {
  style: "traditional",
  medium: "blackwork",
  clientId: "ipad-event-01",
} as const;

describe("INKFLOW approved prompt compiler", () => {
  it("uses the exact instant-draw style and medium mappings", () => {
    expect(STYLE_OPTIONS).toEqual(styleProfiles);
    expect(MEDIUM_OPTIONS).toEqual(mediumProfiles);
  });

  it("keeps every profile simple, outline-only, and free of positive ornate directives", () => {
    for (const profile of STYLE_OPTIONS) {
      expect(profile.snippet).toMatch(/simple/i);
      expect(profile.snippet).toMatch(/monoline.*outline|outline/i);
    }
    for (const profile of [...STYLE_OPTIONS, ...MEDIUM_OPTIONS]) {
      expect(profile.snippet).not.toMatch(
        /heavy|solid|fill|sacred geometry|dotwork|stippling|ornate|cyber|sigil|tribal/i,
      );
    }
    for (const profile of MEDIUM_OPTIONS) {
      expect(profile.snippet).toContain("pure white background");
      expect(profile.snippet).toContain("zero shading");
    }
  });

  it("preserves the exact five-line compiled prompt", () => {
    const prompt = compileStencilPrompt("Dragon", "cyber", "twotone");
    expect(prompt).toBe(
      `Create 4 distinct instant-draw outline variations of Dragon.\nStyle: ${styleProfiles[3].snippet}.\nMedium & Color: ${mediumProfiles[2].snippet}.\n${constraints}\n${negativeConstraints}`,
    );
    expect(prompt.split("\n")).toHaveLength(5);
  });

  it("appends contact-sheet layout only after the auditable compiled prompt", () => {
    const input = {
      concept: "Lotus",
      style: "geometric" as const,
      medium: "jagua" as const,
    };
    expect(compileGenerationPrompt(input)).toBe(
      `${compileStencilPrompt(input.concept, input.style, input.medium)}\n\n${CONTACT_SHEET_LAYOUT_INSTRUCTIONS}`,
    );
  });

  it.each([
    "mandala",
    "MANDALAS",
    "small mandala flower",
    "曼陀羅",
    "曼陀罗",
    "曼荼羅",
    "曼荼罗",
  ])(
    "rejects the instant-draw concept %s in parser and compiler",
    (concept) => {
      expect(isDisallowedInstantDrawConcept(concept)).toBe(true);
      expect(() => parseStencilInput({ ...validRequest, concept })).toThrow(
        "instant_draw_only",
      );
      expect(() =>
        compileStencilPrompt(concept, "fine_line", "blackwork"),
      ).toThrow("instant_draw_only");
    },
  );

  it("allows Mandalay while exposing the shared instant-draw message", () => {
    expect(isDisallowedInstantDrawConcept("Mandalay travel sketch")).toBe(
      false,
    );
    expect(
      parseStencilInput({ ...validRequest, concept: "Mandalay travel sketch" })
        .concept,
    ).toBe("Mandalay travel sketch");
    expect(INSTANT_DRAW_MESSAGE).toBe(
      "Let's keep it simple for instant drawing—try a heart, flower, smiley or small symbol.",
    );
  });

  it("accepts optional requestId but rejects multiline concepts and unknown choices", () => {
    expect(
      parseStencilInput({
        concept: "  Moth  ",
        style: "traditional",
        medium: "blackwork",
        clientId: "ipad-event-01",
        requestId: "tap-123",
      }),
    ).toMatchObject({ concept: "Moth", requestId: "tap-123" });
    expect(() =>
      parseStencilInput({
        concept: "Moth\nignored",
        style: "traditional",
        medium: "blackwork",
        clientId: "x",
      }),
    ).toThrow("invalid_request");
    expect(() =>
      parseStencilInput({
        concept: "Moth",
        style: "unknown",
        medium: "blackwork",
        clientId: "x",
      }),
    ).toThrow("invalid_request");
  });

  it("validates a pre-saved 256-bit client capability without altering the prompt", () => {
    const body = {
      concept: "Lotus",
      style: "fine_line",
      medium: "blackwork",
      clientId: "ipad",
      requestId: "recover",
      capabilityToken: "a".repeat(64),
    };
    expect(parseStencilInput(body).capabilityToken).toBe(body.capabilityToken);
    expect(() =>
      parseStencilInput({ ...body, capabilityToken: "too-short" }),
    ).toThrow("invalid_request");
    expect(() =>
      parseStencilInput({ ...body, capabilityToken: "z".repeat(64) }),
    ).toThrow("invalid_request");
  });
});
