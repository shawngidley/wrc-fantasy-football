import { describe, expect, it } from "vitest";
import {
  PASSKEY_RP_ID,
  createPasskeyAuthenticationOptions,
  createPasskeyRegistrationOptions,
  isWrcPasskeyOrigin,
  normalizePasskeyTransports,
  toWebAuthnCredential,
} from "./passkeyAuth";
import { WRC_TEAM_SESSION_TTL_SECONDS } from "./wrcTeamSession";

describe("WRC owner sessions and passkeys", () => {
  it("sets the owner-session policy to 30 days", () => {
    expect(WRC_TEAM_SESSION_TTL_SECONDS).toBe(60 * 60 * 24 * 30);
  });

  it("uses the public WRC domain and required platform verification for passkey enrollment", async () => {
    const options = await createPasskeyRegistrationOptions({
      teamId: "team-shawn",
      teamName: "Vipers",
      ownerName: "Shawn",
      existingCredentials: [{ credentialId: "existing-passkey", transports: ["internal"] }],
    });

    expect(options.rp.id).toBe(PASSKEY_RP_ID);
    expect(options.authenticatorSelection).toMatchObject({
      authenticatorAttachment: "platform",
      residentKey: "required",
      userVerification: "required",
    });
    expect(options.excludeCredentials).toContainEqual({ id: "existing-passkey", type: "public-key", transports: ["internal"] });
  });

  it("uses discoverable, user-verified credentials for Face ID sign-in", async () => {
    const options = await createPasskeyAuthenticationOptions();
    expect(options).toMatchObject({ rpId: PASSKEY_RP_ID, userVerification: "required" });
    expect(options.allowCredentials).toBeUndefined();
  });

  it("filters passkey transports and reconstructs a server verification credential", () => {
    expect(normalizePasskeyTransports(["internal", "invalid", 7, "hybrid"])).toEqual(["internal", "hybrid"]);
    const credential = toWebAuthnCredential({
      credentialId: "credential-id",
      publicKey: Buffer.from("public-key").toString("base64url"),
      counter: 9,
      transports: ["internal"],
    });
    expect(credential).toMatchObject({ id: "credential-id", counter: 9, transports: ["internal"] });
    expect(Buffer.from(credential.publicKey).toString()).toBe("public-key");
  });

  it("accepts only the configured public site origins for passkey assertions", () => {
    expect(isWrcPasskeyOrigin("https://wrcfantasyfootball.com")).toBe(true);
    expect(isWrcPasskeyOrigin("https://www.wrcfantasyfootball.com")).toBe(true);
    expect(isWrcPasskeyOrigin("https://attacker.example")).toBe(false);
  });
});
