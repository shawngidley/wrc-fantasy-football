export const DRAFT_LOTTERY_OWNERS = ["Greg", "Shawn", "Bill", "David R.", "Jason", "Scott N."] as const;

export type DraftLotteryOwner = typeof DRAFT_LOTTERY_OWNERS[number];

export interface LotteryPickLike {
  round: number;
  pickInRound: number;
  owner: string;
}

export function isValidDraftLotteryResult(value: unknown): value is DraftLotteryOwner[] {
  return Array.isArray(value)
    && value.length === DRAFT_LOTTERY_OWNERS.length
    && new Set(value).size === DRAFT_LOTTERY_OWNERS.length
    && value.every(owner => DRAFT_LOTTERY_OWNERS.includes(owner as DraftLotteryOwner));
}

export function applyDraftLottery<T extends LotteryPickLike>(picks: T[], result: DraftLotteryOwner[] | null | undefined): T[] {
  if (!result || !isValidDraftLotteryResult(result)) return picks;
  return picks.map(pick => {
    if (pick.round === 1 && pick.pickInRound >= 1 && pick.pickInRound <= 6) {
      return { ...pick, owner: result[pick.pickInRound - 1] };
    }
    if (pick.round === 2 && pick.pickInRound >= 7 && pick.pickInRound <= 12) {
      return { ...pick, owner: result[12 - pick.pickInRound] };
    }
    return pick;
  });
}

export function createLotteryRows(result: DraftLotteryOwner[]) {
  if (!isValidDraftLotteryResult(result)) throw new Error("Lottery result must contain each eligible owner exactly once.");
  return result.map((owner, index) => ({ owner, lotteryPick: index + 1, round1Pick: index + 1, round2Pick: 12 - index }));
}
