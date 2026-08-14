import { describe, expect, it } from "vitest";
import { getNewsDisplayName } from "./newsDisplayName";

describe("getNewsDisplayName", () => {
  it("keeps full given names and suffixes instead of abbreviating them", () => {
    expect(getNewsDisplayName("  Kenneth Walker III  ")).toBe("Kenneth Walker III");
    expect(getNewsDisplayName("Javonte Williams")).toBe("Javonte Williams");
  });
});
