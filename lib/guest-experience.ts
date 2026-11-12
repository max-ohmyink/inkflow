import { stencilFileName } from "./studio-navigation";
import {
  CATALOG_COLOR_OPTIONS,
  type CatalogColorMix,
} from "../shared/catalog-filters";

type ArtworkSource = "catalog" | "ai" | "legacy";
type ArtworkOption = {
  originalUrl: string;
  pngUrl: string;
  colorUrl?: string;
  colorMode?: CatalogColorMix;
  source?: ArtworkSource;
  colorTreatment?: "filled" | "ink_only" | "monochrome";
  colorStatus?: "ready" | "failed";
  colorWarning?: string;
};

export function originalArtworkLabel(source?: ArtworkSource): string {
  return source === "ai"
    ? "AI original"
    : source === "legacy"
      ? "Saved original"
      : "Catalog original";
}
export function compareOriginalLabel(source?: ArtworkSource): string {
  return source === "ai"
    ? "Compare AI original"
    : `Compare ${originalArtworkLabel(source).toLowerCase()}`;
}
export function sourceArtworkLabel(source?: ArtworkSource): string {
  return source === "ai"
    ? "AI-created design · No suitable catalog match"
    : source === "legacy"
      ? "Legacy saved artwork"
      : "Original artist-designed catalog motif";
}
export function guestArtworkUrl(
  option: ArtworkOption,
  showCatalogOriginal = false,
): string {
  return showCatalogOriginal
    ? option.originalUrl
    : option.colorUrl || option.originalUrl;
}
export function colorAvailabilityWarning(
  option: ArtworkOption,
): string | undefined {
  return option.colorStatus === "failed"
    ? option.colorWarning ||
        "Your design is ready, but its color version could not be completed this time. You can still choose and save the original."
    : undefined;
}
export function missingColorSummary(
  options: readonly ArtworkOption[],
): string | undefined {
  const failed = options.filter(
    (option) => option.colorStatus === "failed",
  ).length;
  if (!failed) return undefined;
  return failed === options.length
    ? "Your selected colors were not generated. The designs below are originals, without the requested color fill. You can still choose and save them."
    : "Some requested color versions could not be generated. Those options show the original design and are clearly marked below; completed color versions remain available.";
}
export function artworkVersionLabel(
  option: ArtworkOption,
  showCatalogOriginal = false,
): string {
  if (showCatalogOriginal || !option.colorUrl)
    return originalArtworkLabel(option.source);
  const label =
    CATALOG_COLOR_OPTIONS.find((x) => x.id === option.colorMode)?.label ||
    "Color";
  return `${label}${option.colorTreatment === "filled" ? " filled" : ""} version`;
}
export function colorTreatmentDescription(option: ArtworkOption): string {
  return option.colorTreatment === "filled"
    ? "Color fills enclosed shapes while the original contours stay clear."
    : option.colorTreatment === "monochrome"
      ? "A separate black-and-grey version of the original design."
      : option.colorTreatment === "ink_only"
        ? "This open-line or saved colorway uses line accents, without filled areas."
        : "A separate color interpretation; the source original stays untouched.";
}
export function tattooPreviewUrl(
  option: ArtworkOption,
  artistTools: boolean,
  showOriginal: boolean,
  showCatalogOriginal = false,
): string {
  return artistTools && !showOriginal
    ? option.pngUrl
    : guestArtworkUrl(option, showCatalogOriginal);
}
export function guestArtworkFileName(
  concept: string,
  index: number,
  version?: "color" | "original",
  source?: ArtworkSource,
): string {
  const suffix =
    version === "color"
      ? "-color-version.png"
      : version === "original"
        ? source === "ai"
          ? "-ai-original.png"
          : source === "legacy"
            ? "-saved-original.png"
            : "-catalog-original.png"
        : "-tattoo-artwork.png";
  return stencilFileName(concept, index, "png").replace(
    "-mirrored.png",
    suffix,
  );
}
export function shouldResetGuestJourney(tab: string, screen: string): boolean {
  return tab !== "create" && screen === "experience";
}
