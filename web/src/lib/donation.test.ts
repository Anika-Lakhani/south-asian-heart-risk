import { describe, expect, it } from "vitest";

import { ageBand, donationMode } from "./donation";

describe("donation safety", () => {
  it("is never live during tests, so test runs can't reach the real database", () => {
    expect(donationMode("")).not.toBe("live");
    expect(donationMode("?donate=preview")).toBe("preview");
  });

  it.each([
    [30, "30-34"],
    [34, "30-34"],
    [48, "45-49"],
    [79, "75-79"],
  ])("stores age %i as the band %s", (age, band) => {
    expect(ageBand(age)).toBe(band);
  });
});
