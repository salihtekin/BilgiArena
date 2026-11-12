CREATE TABLE `ad_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event` text NOT NULL,
	`currency` text NOT NULL,
	`micros` integer NOT NULL,
	`precision` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ad_owner_date` ON `ad_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `prize_reviews` (
	`award_id` text PRIMARY KEY NOT NULL,
	`decision` text NOT NULL,
	`evidence_ref` text NOT NULL,
	`note` text NOT NULL,
	`reviewed_by` text NOT NULL,
	`reviewed_at` integer NOT NULL,
	FOREIGN KEY (`award_id`) REFERENCES `prize_awards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `round_access` (
	`round_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
