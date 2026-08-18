CREATE TABLE `wrc_season_stats_cache` (
	`id` varchar(64) NOT NULL,
	`season` int NOT NULL,
	`source` varchar(96) NOT NULL,
	`payload` text NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`refreshedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wrc_season_stats_cache_id` PRIMARY KEY(`id`)
);
