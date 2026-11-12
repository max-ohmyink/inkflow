export type ActualColorTreatment =
  | "filled"
  | "ink_only"
  | "monochrome"
  | "unavailable";
const treatments = new Set(["filled", "ink_only", "monochrome", "unavailable"]);
function readMetadata(prompt: string): Record<string, unknown> | undefined {
  try {
    const raw = JSON.parse(prompt);
    return raw && typeof raw === "object" && !Array.isArray(raw)
      ? raw
      : undefined;
  } catch {
    return undefined;
  }
}
function expectedCount(raw: Record<string, unknown>): number | undefined {
  if (raw.mode === "ai" && raw.version === 1) return 4;
  if (
    raw.mode === "catalog" &&
    raw.version === 3 &&
    Array.isArray(raw.catalogIds) &&
    raw.catalogIds.length >= 1 &&
    raw.catalogIds.length <= 4
  )
    return raw.catalogIds.length;
  return undefined;
}
export function parseActualColorTreatments(
  prompt: string,
): ActualColorTreatment[] | undefined {
  const raw = readMetadata(prompt);
  if (!raw) return undefined;
  const count = expectedCount(raw),
    values = raw.optionColorTreatments;
  if (
    !count ||
    !Array.isArray(values) ||
    values.length !== count ||
    values.some((value) => typeof value !== "string" || !treatments.has(value))
  )
    return undefined;
  return values as ActualColorTreatment[];
}
export function persistActualColorTreatments(
  prompt: string,
  values: readonly ActualColorTreatment[],
): string {
  const raw = readMetadata(prompt);
  if (
    !raw ||
    expectedCount(raw) !== values.length ||
    values.some((value) => !treatments.has(value))
  )
    throw new Error("color_outcomes_invalid");
  return JSON.stringify({ ...raw, optionColorTreatments: values });
}
