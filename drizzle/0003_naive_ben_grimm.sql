CREATE TABLE `admin_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`before_json` text NOT NULL,
	`after_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_audit_created_idx` ON `admin_audit` (`created_at`);--> statement-breakpoint
CREATE TABLE `admin_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`maintenance` integer DEFAULT 0 NOT NULL,
	`disabled_games_json` text DEFAULT '[]' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL,
	`updated_by` text
);
--> statement-breakpoint
CREATE TABLE `api_rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`window_key` integer NOT NULL,
	`requests` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limits_user_window_idx` ON `api_rate_limits` (`user_id`,`window_key`);--> statement-breakpoint
ALTER TABLE `players` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `suspension_reason` text;