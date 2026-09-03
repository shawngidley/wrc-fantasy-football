/**
 * Minimal Twilio SMS integration -- calls Twilio's REST API directly via
 * fetch rather than pulling in their SDK, since all that's needed here is
 * a single POST to send a text. Requires three environment variables:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER   (the Twilio phone number texts are sent from,
 *                          in E.164 format, e.g. "+15551234567")
 */

export interface SendSmsResult {
  sent: boolean;
  reason?: string;
}

export async function sendSms(toPhoneNumber: string, body: string): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    // Not configured -- this is expected until Twilio env vars are set in
    // Vercel, so this fails quietly (logged, not thrown) rather than
    // breaking whatever feature triggered the notification. Sending a text
    // should never be able to block the underlying action (e.g. creating a
    // trade proposal) from succeeding.
    console.warn("[twilioSms] Skipped -- TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER not fully configured");
    return { sent: false, reason: "not-configured" };
  }

  const to = normalizeToE164(toPhoneNumber);
  if (!to) {
    return { sent: false, reason: "invalid-phone-number" };
  }

  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
      body: new URLSearchParams({ To: to, From: fromNumber, Body: body }).toString(),
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(`[twilioSms] Twilio request failed with status ${response.status}: ${errorBody}`);
      return { sent: false, reason: `twilio-error-${response.status}` };
    }
    return { sent: true };
  } catch (error) {
    console.error("[twilioSms] Request failed:", error);
    return { sent: false, reason: "request-failed" };
  }
}

/** Accepts common US phone number formats and normalizes to E.164
 * ("+1XXXXXXXXXX"), which Twilio requires. Returns null if the input
 * doesn't look like a valid 10-digit US number after stripping
 * formatting characters. */
function normalizeToE164(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
