import { describe, expect, it } from "vitest";
import { isWrcPasskeyHost } from "./wrcPasskey";

describe("WRC passkey host guard", () => {
  it("allows Face ID only on the official WRC domains", () => {
    expect(isWrcPasskeyHost("wrcfantasyfootball.com")).toBe(true);
    expect(isWrcPasskeyHost("www.wrcfantasyfootball.com")).toBe(true);
    expect(isWrcPasskeyHost("3000-demo.manus.computer")).toBe(false);
    expect(isWrcPasskeyHost("wrcfantasyfootball.com.attacker.example")).toBe(false);
  });
});
