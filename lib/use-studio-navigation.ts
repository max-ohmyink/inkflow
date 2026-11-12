import { useState } from "react";
import type { BrowserStudioTab } from "./studio-navigation";

export function useStudioNavigation(): [
  BrowserStudioTab,
  (next: BrowserStudioTab) => void,
] {
  return useState<BrowserStudioTab>("create");
}
