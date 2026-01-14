import { describe, expect, test } from "vitest";
import {
  buildPlacePayload,
  detectTierFromRecord,
  shouldDisplayTier,
  type PlaceCreateInput,
} from "./places";

const createBaseInput = (): PlaceCreateInput => ({
  title: "Base Spot",
  category: "autre",
  lat: 45,
  lng: -73,
  isPublic: true,
});

describe("places.logic", () => {
  test("detectTierFromRecord falls back to STANDARD when metadata is missing", () => {
    expect(detectTierFromRecord({})).toBe("STANDARD");
  });

  test("shouldDisplayTier honors EPIC and GHOST combinations", () => {
    expect(shouldDisplayTier("STANDARD", false, false)).toBe(true);
    expect(shouldDisplayTier("STANDARD", true, false)).toBe(false);
    expect(shouldDisplayTier("EPIC", true, false)).toBe(true);
    expect(shouldDisplayTier("GHOST", true, false)).toBe(false);
    expect(shouldDisplayTier("GHOST", false, true)).toBe(true);
    expect(shouldDisplayTier("EPIC", true, true)).toBe(true);
    expect(shouldDisplayTier("STANDARD", true, true)).toBe(false);
  });

  test("buildPlacePayload preserves PRO-only collections and fields", () => {
    const payload = buildPlacePayload(
      {
        ...createBaseInput(),
        proOnly: true,
        isProOnly: true,
        blurRadius: 42,
        accessNotes: "Secret approach",
        storySteps: ["Step 1"],
        lootTags: ["Tag"],
        photos: ["photo.jpg"],
        historyImages: ["history.png"],
        tier: "EPIC",
      },
      { createdAt: 1, updatedAt: 2 }
    );

    expect(payload.blurRadius).toBe(42);
    expect(payload.accessNotes).toBe("Secret approach");
    expect(payload.storySteps).toEqual(["Step 1"]);
    expect(payload.lootTags).toEqual(["Tag"]);
    expect(payload.photos).toEqual(["photo.jpg"]);
    expect(payload.proOnly).toBe(true);
    expect(payload.isProOnly).toBe(true);
    expect(payload.createdAt).toBe(1);
    expect(payload.updatedAt).toBe(2);
  });

  test("buildPlacePayload defaults collections and notes for free spots", () => {
    const payload = buildPlacePayload(createBaseInput(), { createdAt: 5, updatedAt: 5 });
    expect(payload.blurRadius).toBeNull();
    expect(payload.accessNotes).toBeNull();
    expect(payload.storySteps).toEqual([]);
    expect(payload.lootTags).toEqual([]);
    expect(payload.photos).toEqual([]);
    expect(payload.createdAt).toBe(5);
  });

  test("validation rejects missing title, category, or coordinates", () => {
    expect(() =>
      buildPlacePayload({
        ...createBaseInput(),
        title: "",
      })
    ).toThrow(/title/i);

    expect(() =>
      buildPlacePayload({
        ...createBaseInput(),
        category: undefined,
      })
    ).toThrow(/category/i);

    expect(() =>
      buildPlacePayload({
        ...createBaseInput(),
        lat: undefined as unknown as number,
      })
    ).toThrow(/coordinates/i);
  });
});
