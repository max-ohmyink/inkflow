import { describe, expect, it } from "vitest";
import {
  tattooPreviewUrl,
  guestArtworkFileName,
  shouldResetGuestJourney,
  guestArtworkUrl,
  artworkVersionLabel,
  originalArtworkLabel,
  compareOriginalLabel,
  sourceArtworkLabel,
  colorTreatmentDescription,
  colorAvailabilityWarning,
  missingColorSummary,
} from "../lib/guest-experience";

const option = {
  originalUrl: "/original-color.png",
  pngUrl: "/mirrored-preparation.png",
};
describe("guest-first tattoo experience", () => {
  it("always shows normal-orientation original artwork in guest mode", () => {
    expect(tattooPreviewUrl(option, false, false)).toBe(option.originalUrl);
    expect(tattooPreviewUrl(option, false, true)).toBe(option.originalUrl);
  });
  it("shows mirrored preparation only when an artist explicitly opens that view", () => {
    expect(tattooPreviewUrl(option, true, false)).toBe(option.pngUrl);
    expect(tattooPreviewUrl(option, true, true)).toBe(option.originalUrl);
  });
  it("defaults a color version to the guest view while keeping original comparison separate", () => {
    const colored = {
      ...option,
      colorUrl: "/red-version.png",
      colorMode: "red_accent" as const,
    };
    expect(guestArtworkUrl(colored)).toBe(colored.colorUrl);
    expect(guestArtworkUrl(colored, true)).toBe(option.originalUrl);
    expect(tattooPreviewUrl(colored, false, false)).toBe(colored.colorUrl);
    expect(tattooPreviewUrl(colored, true, false)).toBe(option.pngUrl);
    expect(tattooPreviewUrl(colored, true, true)).toBe(colored.colorUrl);
    expect(tattooPreviewUrl(colored, false, true, true)).toBe(
      option.originalUrl,
    );
    expect(artworkVersionLabel(colored)).toBe("Black + red version");
    expect(artworkVersionLabel(colored, true)).toBe("Catalog original");
    expect(guestArtworkFileName("Tulip", 0, "color")).toBe(
      "Tulip-variation-1-color-version.png",
    );
    expect(guestArtworkFileName("Tulip", 0, "original")).toBe(
      "Tulip-variation-1-catalog-original.png",
    );
  });
  it("keeps AI fallback and legacy originals distinct from catalog provenance", () => {
    const ai = {
      ...option,
      source: "ai" as const,
      colorUrl: "/filled.png",
      colorMode: "red_accent" as const,
      colorTreatment: "filled" as const,
    };
    expect(originalArtworkLabel("ai")).toBe("AI original");
    expect(compareOriginalLabel("ai")).toBe("Compare AI original");
    expect(sourceArtworkLabel("ai")).toContain("No suitable catalog match");
    expect(artworkVersionLabel(ai, true)).toBe("AI original");
    expect(artworkVersionLabel(ai)).toBe("Black + red filled version");
    expect(guestArtworkFileName("Avocado", 0, "original", "ai")).toBe(
      "Avocado-variation-1-ai-original.png",
    );
    expect(guestArtworkUrl(ai)).toBe(ai.colorUrl);
    expect(tattooPreviewUrl(ai, true, false)).toBe(option.pngUrl);
    expect(artworkVersionLabel({ ...option, source: "legacy" })).toBe(
      "Saved original",
    );
    expect(colorTreatmentDescription(ai)).toContain("fills enclosed shapes");
    expect(
      colorTreatmentDescription({ ...ai, colorTreatment: "ink_only" }),
    ).toContain("line accents");
  });
  it("names guest saves as artwork, not a mirrored preparation file", () => {
    expect(guestArtworkFileName("Lotus / flower", 0)).toBe(
      "Lotus-flower-variation-1-tattoo-artwork.png",
    );
    expect(guestArtworkFileName("龍", 3)).toBe(
      "tattoo-variation-4-tattoo-artwork.png",
    );
  });
  it("keeps a ready original usable and honestly labeled when its optional color failed", () => {
    const unavailable = {
      ...option,
      source: "catalog" as const,
      colorMode: "mixed_color" as const,
      colorStatus: "failed" as const,
      colorWarning:
        "Your design is ready, but its color version could not be completed this time.",
    };
    expect(guestArtworkUrl(unavailable)).toBe(option.originalUrl);
    expect(artworkVersionLabel(unavailable)).toBe("Catalog original");
    expect(tattooPreviewUrl(unavailable, true, false)).toBe(option.pngUrl);
    expect(colorAvailabilityWarning(unavailable)).toBe(
      unavailable.colorWarning,
    );
    expect(colorAvailabilityWarning(option)).toBeUndefined();
    expect(
      colorAvailabilityWarning({ ...unavailable, colorStatus: "ready" }),
    ).toBeUndefined();
  });
  it("makes original-only and partially colored results explicit", () => {
    const failed = { ...option, colorStatus: "failed" as const };
    const colored = {
      ...option,
      colorStatus: "ready" as const,
      colorUrl: "/color.png",
    };
    expect(missingColorSummary([failed, failed])).toContain(
      "designs below are originals",
    );
    expect(missingColorSummary([failed, colored])).toContain(
      "completed color versions remain available",
    );
    expect(missingColorSummary([colored])).toBeUndefined();
    expect(missingColorSummary([])).toBeUndefined();
  });
  it("resets only completed guest handoffs when leaving Create, not in-flight jobs or options", () => {
    expect(shouldResetGuestJourney("library", "experience")).toBe(true);
    expect(shouldResetGuestJourney("settings", "experience")).toBe(true);
    expect(shouldResetGuestJourney("create", "experience")).toBe(false);
    expect(shouldResetGuestJourney("library", "progress")).toBe(false);
    expect(shouldResetGuestJourney("settings", "results")).toBe(false);
  });
});
