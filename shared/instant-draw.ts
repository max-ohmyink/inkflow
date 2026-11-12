export const INSTANT_DRAW_MESSAGE =
  "Let's keep it simple for instant drawing—try a heart, flower, smiley or small symbol.";

const DISALLOWED_INSTANT_DRAW_CONCEPT =
  /\bmandalas?\b|曼陀羅|曼陀罗|曼荼羅|曼荼罗/i;

export function isDisallowedInstantDrawConcept(concept: string): boolean {
  return DISALLOWED_INSTANT_DRAW_CONCEPT.test(concept);
}
