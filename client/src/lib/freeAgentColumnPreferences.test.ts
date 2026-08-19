import { describe, expect, it } from "vitest";
import {
  FREE_AGENT_CONFIGURABLE_COLUMNS,
  normalizeFreeAgentVisibleColumns,
  toggleFreeAgentVisibleColumn,
} from "./freeAgentColumnPreferences";

describe("Free Agents column preferences", () => {
  it("uses the complete default optional column set when no saved choice exists", () => {
    expect(normalizeFreeAgentVisibleColumns(null)).toEqual(FREE_AGENT_CONFIGURABLE_COLUMNS);
  });

  it("filters unknown saved values and keeps the configured display order stable", () => {
    expect(normalizeFreeAgentVisibleColumns(["proj", "notAColumn", "bye", "proj"])).toEqual(["bye", "proj"]);
  });

  it("toggles optional columns without disturbing the canonical order", () => {
    expect(toggleFreeAgentVisibleColumn(["bye", "proj"], "wrcPts")).toEqual(["bye", "wrcPts", "proj"]);
    expect(toggleFreeAgentVisibleColumn(["bye", "wrcPts", "proj"], "bye")).toEqual(["wrcPts", "proj"]);
  });
});
