import { index, int, mediumtext, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Private, attributed rolling cache of eligible FantasyPros player-news metadata. */
export const fantasyprosNewsArchive = mysqlTable(
  "fantasypros_news_archive",
  {
    id: int("id").autoincrement().primaryKey(),
    archiveKey: varchar("archiveKey", { length: 128 }).notNull(),
    source: varchar("source", { length: 32 }).notNull().default("FantasyPros"),
    sourceItemId: varchar("sourceItemId", { length: 64 }),
    playerId: int("playerId"),
    playerName: varchar("playerName", { length: 160 }).notNull(),
    team: varchar("team", { length: 8 }),
    position: varchar("position", { length: 8 }),
    title: text("title").notNull(),
    description: text("description"),
    impact: text("impact"),
    author: varchar("author", { length: 160 }),
    articleUrl: text("articleUrl"),
    publishedAt: timestamp("publishedAt").notNull(),
    capturedAt: timestamp("capturedAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
  },
  table => ({
    archiveKeyUnique: uniqueIndex("fantasypros_news_archive_archive_key_uq").on(table.archiveKey),
    publishedAtIndex: index("fantasypros_news_archive_published_at_idx").on(table.publishedAt),
    positionPublishedIndex: index("fantasypros_news_archive_position_published_idx").on(table.position, table.publishedAt),
  }),
);

/** Durable project-level schedule metadata for the rolling news collector. */
export const fantasyprosNewsArchiveConfig = mysqlTable("fantasypros_news_archive_config", {
  id: varchar("id", { length: 64 }).primaryKey(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  retentionDays: int("retentionDays").notNull().default(30),
  lastCollectedAt: timestamp("lastCollectedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Durable server-side snapshot for position-player season stats shared by all browsers. */
export const wrcSeasonStatsCache = mysqlTable("wrc_season_stats_cache", {
  id: varchar("id", { length: 64 }).primaryKey(),
  season: int("season").notNull(),
  source: varchar("source", { length: 96 }).notNull(),
  payload: mediumtext("payload").notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  refreshedAt: timestamp("refreshedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FantasyprosNewsArchive = typeof fantasyprosNewsArchive.$inferSelect;
export type InsertFantasyprosNewsArchive = typeof fantasyprosNewsArchive.$inferInsert;

// TODO: Add your tables here
