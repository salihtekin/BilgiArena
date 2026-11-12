CREATE TABLE `content_editions` (
	`id` text PRIMARY KEY NOT NULL,
	`game` text NOT NULL,
	`version` text NOT NULL,
	`questions_json` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`published_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_game_version` ON `content_editions` (`game`,`version`);--> statement-breakpoint
CREATE INDEX `content_game_status` ON `content_editions` (`game`,`status`);--> statement-breakpoint
CREATE TABLE `product_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`event` text NOT NULL,
	`game` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `event_day` ON `product_events` (`day`);--> statement-breakpoint
CREATE INDEX `event_owner_day` ON `product_events` (`user_id`,`day`);--> statement-breakpoint
CREATE TABLE `question_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`question_id` text NOT NULL,
	`content_version` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_report_owner` ON `question_reports` (`user_id`,`question_id`,`content_version`);--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`message` text NOT NULL,
	`reply` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `support_owner_date` ON `support_tickets` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `players` ADD `analytics_consent` integer DEFAULT 0 NOT NULL;