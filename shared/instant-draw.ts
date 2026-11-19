import { EXPLICIT_THEME } from "./family-designs";

export const INSTANT_DRAW_MESSAGE = "Please try a different idea.";

/** Only sexual or explicit themes are refused; every classic tattoo subject is allowed. */
export function isDisallowedInstantDrawConcept(concept: string): boolean {
  return EXPLICIT_THEME.test(concept);
}
