CREATE TABLE `operation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`lease_token` text NOT NULL,
	`lease_expires_at` integer NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`attempts` integer DEFAULT 1 NOT NULL,
	`error_tag` text,
	`summary_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `operation_kind_date` ON `operation_runs` (`kind`,`started_at`);