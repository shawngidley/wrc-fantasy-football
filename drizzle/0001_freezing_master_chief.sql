CREATE TABLE `fantasypros_news_archive` (
	`id` int AUTO_INCREMENT NOT NULL,
	`archiveKey` varchar(128) NOT NULL,
	`source` varchar(32) NOT NULL DEFAULT 'FantasyPros',
	`sourceItemId` varchar(64),
	`playerId` int,
	`playerName` varchar(160) NOT NULL,
	`team` varchar(8),
	`position` varchar(8),
	`title` text NOT NULL,
	`description` text,
	`impact` text,
	`author` varchar(160),
	`articleUrl` text,
	`publishedAt` timestamp NOT NULL,
	`capturedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `fantasypros_news_archive_id` PRIMARY KEY(`id`),
	CONSTRAINT `fantasypros_news_archive_archive_key_uq` UNIQUE(`archiveKey`)
);
--> statement-breakpoint
CREATE TABLE `fantasypros_news_archive_config` (
	`id` varchar(64) NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`retentionDays` int NOT NULL DEFAULT 30,
	`lastCollectedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fantasypros_news_archive_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `fantasypros_news_archive_published_at_idx` ON `fantasypros_news_archive` (`publishedAt`);--> statement-breakpoint
CREATE INDEX `fantasypros_news_archive_position_published_idx` ON `fantasypros_news_archive` (`position`,`publishedAt`);