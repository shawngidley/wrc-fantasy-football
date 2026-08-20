import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from "@simplewebauthn/server";

export const PASSKEY_RP_ID = "wrcfantasyfootball.com";
export const PASSKEY_RP_NAME = "WRC Fantasy Football";
export const PASSKEY_EXPECTED_ORIGINS = [
  "https://wrcfantasyfootball.com",
  "https://www.wrcfantasyfootball.com",
] as const;
export const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000;

export type StoredPasskey = {
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[];
};

export function isWrcPasskeyOrigin(origin: unknown): origin is (typeof PASSKEY_EXPECTED_ORIGINS)[number] {
  return typeof origin === "string" && PASSKEY_EXPECTED_ORIGINS.includes(origin as (typeof PASSKEY_EXPECTED_ORIGINS)[number]);
}

export function normalizePasskeyTransports(value: unknown): Array<"ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb"> {
  const allowed = new Set(["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"]);
  return Array.isArray(value)
    ? value.filter((item): item is "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb" => typeof item === "string" && allowed.has(item))
    : [];
}

export function toWebAuthnCredential(passkey: StoredPasskey): WebAuthnCredential {
  return {
    id: passkey.credentialId,
    publicKey: Buffer.from(passkey.publicKey, "base64url"),
    counter: Number(passkey.counter) || 0,
    transports: normalizePasskeyTransports(passkey.transports),
  };
}

export async function createPasskeyRegistrationOptions(input: {
  teamId: string;
  teamName: string;
  ownerName: string;
  existingCredentials: Array<Pick<StoredPasskey, "credentialId" | "transports">>;
}) {
  return generateRegistrationOptions({
    rpName: PASSKEY_RP_NAME,
    rpID: PASSKEY_RP_ID,
    userName: input.teamId,
    userDisplayName: `${input.teamName} — ${input.ownerName}`,
    attestationType: "none",
    excludeCredentials: input.existingCredentials.map(credential => ({
      id: credential.credentialId,
      transports: normalizePasskeyTransports(credential.transports),
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
      authenticatorAttachment: "platform",
    },
    preferredAuthenticatorType: "localDevice",
  });
}

export async function createPasskeyAuthenticationOptions(input: {
  credentials: Array<Pick<StoredPasskey, "credentialId" | "transports">>;
}) {
  return generateAuthenticationOptions({
    rpID: PASSKEY_RP_ID,
    allowCredentials: input.credentials.map(credential => ({
      id: credential.credentialId,
      transports: normalizePasskeyTransports(credential.transports),
    })),
    userVerification: "required",
  });
}

export async function verifyPasskeyRegistration(input: {
  response: RegistrationResponseJSON;
  expectedChallenge: string;
}) {
  return verifyRegistrationResponse({
    response: input.response,
    expectedChallenge: input.expectedChallenge,
    expectedOrigin: [...PASSKEY_EXPECTED_ORIGINS],
    expectedRPID: PASSKEY_RP_ID,
    requireUserVerification: true,
  });
}

export async function verifyPasskeyAuthentication(input: {
  response: AuthenticationResponseJSON;
  expectedChallenge: string;
  passkey: StoredPasskey;
}) {
  return verifyAuthenticationResponse({
    response: input.response,
    expectedChallenge: input.expectedChallenge,
    expectedOrigin: [...PASSKEY_EXPECTED_ORIGINS],
    expectedRPID: PASSKEY_RP_ID,
    credential: toWebAuthnCredential(input.passkey),
    requireUserVerification: true,
  });
}
