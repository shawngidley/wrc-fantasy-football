import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from "@simplewebauthn/browser";

const WRC_PASSKEY_HOSTS = new Set(["wrcfantasyfootball.com", "www.wrcfantasyfootball.com"]);

export function isWrcPasskeyHost(hostname: string): boolean {
  return WRC_PASSKEY_HOSTS.has(hostname.toLowerCase());
}

export async function canUseWrcPasskeys(): Promise<boolean> {
  if (typeof window === "undefined" || !isWrcPasskeyHost(window.location.hostname)) return false;
  return browserSupportsWebAuthn() && platformAuthenticatorIsAvailable();
}
