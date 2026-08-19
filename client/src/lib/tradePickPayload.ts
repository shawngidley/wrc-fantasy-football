export type TradePickPayload = {
  year: number;
  round: number;
  originalTeamId?: string;
};

export function getTradePickKey(pick: TradePickPayload) {
  return `${pick.year}-${pick.round}-${pick.originalTeamId ?? ""}`;
}

export function serializeTradePick(pick: TradePickPayload): TradePickPayload {
  return {
    year: pick.year,
    round: pick.round,
    ...(pick.originalTeamId ? { originalTeamId: pick.originalTeamId } : {}),
  };
}
