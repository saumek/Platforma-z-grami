import { describe, expect, it } from "vitest";

import {
  appendStorySegment,
  countStoryWords,
  getLastStoryWords,
  normalizeStoryText,
} from "@/lib/dopowiedzenia";

describe("dopowiedzenia text helpers", () => {
  it("normalizes extra spaces and line breaks before counting words", () => {
    expect(normalizeStoryText("  Ala   ma\n\n kota   i psa  ")).toBe("Ala ma kota i psa");
    expect(countStoryWords("  Ala   ma\n\n kota   i psa  ")).toBe(5);
  });

  it("counts hyphenated and apostrophe words as single words", () => {
    expect(countStoryWords("To był post-rock i someone's plan dzisiaj")).toBe(7);
  });

  it("returns only the last three words of the current story prompt", () => {
    expect(getLastStoryWords("Mały smok zgubił czerwony kapelusz na rynku")).toEqual([
      "czerwony",
      "kapelusz",
      "na",
      "rynku",
    ].slice(-3));
    expect(getLastStoryWords("Krótka historia")).toEqual(["Krótka", "historia"]);
  });

  it("appends the next segment as one clean sentence fragment", () => {
    expect(appendStorySegment("Kot uciekł przez balkon", "  i schował się pod łóżkiem ")).toBe(
      "Kot uciekł przez balkon i schował się pod łóżkiem",
    );
    expect(appendStorySegment("", "  Zaczęło się od jednego telefonu ")).toBe(
      "Zaczęło się od jednego telefonu",
    );
  });
});
