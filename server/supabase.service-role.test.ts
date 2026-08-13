import { describe, expect, it } from "vitest";

const SUPABASE_URL = "https://aquroadkdiltzsvahuff.supabase.co";

describe("Supabase service-role credential", () => {
  it("authorizes a lightweight server-only teams metadata request", async () => {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(serviceRoleKey).toBeTruthy();

    const response = await fetch(`${SUPABASE_URL}/rest/v1/teams?select=id&limit=1`, {
      headers: {
        apikey: serviceRoleKey!,
        Authorization: `Bearer ${serviceRoleKey!}`,
      },
      signal: AbortSignal.timeout(15_000),
    });

    expect(response.status).toBe(200);
  }, 20_000);
});
