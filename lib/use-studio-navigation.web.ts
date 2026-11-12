import { useEffect, useState } from "react";
import {
  studioUrlForTab,
  viewToTab,
  type BrowserStudioTab,
} from "./studio-navigation";

export function useStudioNavigation(): [
  BrowserStudioTab,
  (next: BrowserStudioTab) => void,
] {
  const [tab, setTab] = useState<BrowserStudioTab>("create");
  useEffect(() => {
    const sync = () =>
      setTab(viewToTab(new URL(window.location.href).searchParams.get("view")));
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const navigate = (next: BrowserStudioTab) => {
    const url = studioUrlForTab(new URL(window.location.href), next);
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (current !== url) {
      // Keep the studio controller and Expo's existing history state; only the browser view changes.
      window.history.pushState(window.history.state, "", url);
    }
    setTab(next);
  };
  return [tab, navigate];
}
