export const FREE_AGENT_CONFIGURABLE_COLUMNS = [
  "age", "bye", "opp", "game", "wrcPts", "ptsPerGame", "proj",
  "passYds", "passTD", "passInt", "rushAtt", "rushYds", "rushTD",
  "targets", "receptions", "recYds", "recTD", "turnovers", "gp",
  "fgMade", "fgAtt", "fgPct", "xpMade", "xpAtt", "xpPct",
  "sacks", "safeties", "takeaways", "dstTD",
] as const;

export type FreeAgentConfigurableColumn = (typeof FREE_AGENT_CONFIGURABLE_COLUMNS)[number];

const allowedColumns = new Set<string>(FREE_AGENT_CONFIGURABLE_COLUMNS);

export function normalizeFreeAgentVisibleColumns(values: readonly string[] | null | undefined): FreeAgentConfigurableColumn[] {
  if (!values) return [...FREE_AGENT_CONFIGURABLE_COLUMNS];
  const selected = new Set(values.filter((value): value is FreeAgentConfigurableColumn => allowedColumns.has(value)));
  return FREE_AGENT_CONFIGURABLE_COLUMNS.filter((column) => selected.has(column));
}

export function toggleFreeAgentVisibleColumn(
  current: readonly FreeAgentConfigurableColumn[],
  column: FreeAgentConfigurableColumn,
): FreeAgentConfigurableColumn[] {
  const selected = new Set(current);
  if (selected.has(column)) selected.delete(column);
  else selected.add(column);
  return FREE_AGENT_CONFIGURABLE_COLUMNS.filter((value) => selected.has(value));
}
