import { supabaseAdmin } from "./supabaseAdmin";

/**
 * Columns of the `earnings` table, one per prize on the Money page's
 * 2026 Earnings table. `gow` is the Rivalry Game column (the table was
 * created when that prize was still called Game of the Week).
 */
export type PrizeColumn = "gow" | "wild_card" | "divisional" | "super_bowl" | "champ";

export const PRIZE_AMOUNTS: Record<PrizeColumn, number> = {
  gow: 30,
  wild_card: 50,
  divisional: 100,
  super_bowl: 300,
  champ: 600,
};

/** earnings.id for an owner display name: "David S." -> "davids". Same convention as money_owed. */
export function earningsIdForOwner(owner: string): string {
  return owner.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Adds a prize to one owner's row on the 2026 Earnings table, creating the
 * row if it doesn't exist yet. Prize money comes out of the pool; it never
 * touches money_owed, which tracks league fees only.
 */
export async function creditPrizeEarnings(owner: string, column: PrizeColumn, season: number, amount = PRIZE_AMOUNTS[column]): Promise<void> {
  const id = earningsIdForOwner(owner);
  const { data: existing, error: readError } = await supabaseAdmin
    .from("earnings")
    .select("id, name, season, gow, wild_card, divisional, super_bowl, champ")
    .eq("id", id)
    .maybeSingle();
  if (readError) throw new Error(`Unable to read earnings for ${owner}: ${readError.message}`);

  const row: Record<string, string | number | null> = {
    id,
    name: existing?.name ?? owner,
    season: existing?.season ?? season,
    gow: existing?.gow ?? null,
    wild_card: existing?.wild_card ?? null,
    divisional: existing?.divisional ?? null,
    super_bowl: existing?.super_bowl ?? null,
    champ: existing?.champ ?? null,
  };
  row[column] = Number(row[column] ?? 0) + amount;
  const { error: writeError } = await supabaseAdmin.from("earnings").upsert(row, { onConflict: "id" });
  if (writeError) throw new Error(`Unable to credit ${owner}'s ${column} earnings: ${writeError.message}`);
}
