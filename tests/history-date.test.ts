import { describe, expect, it } from "vitest";
import { formatHistoryDate } from "../lib/guest-experience";

describe("history date", () => {
  it("shows a readable date and time", () => {
    const text = formatHistoryDate("2026-11-19T15:12:00", "en-US");
    expect(text).toBe("Nov 19, 2026 · 3:12 PM");
  });

  it("falls back to the raw value for an invalid date", () => {
    expect(formatHistoryDate("not a date", "en-US")).toBe("not a date");
  });
});
