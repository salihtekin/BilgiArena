CREATE TABLE `account_guardrails` (
	`id_hash` text PRIMARY KEY NOT NULL,
	`deleted_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`day_key` text NOT NULL,
	`ranked_starts` integer DEFAULT 0 NOT NULL,
	`suspended` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `account_guardrails_expiry_idx` ON `account_guardrails` (`expires_at`);--> statement-breakpoint
ALTER TABLE `players` ADD `policy_version` text;--> statement-breakpoint
ALTER TABLE `players` ADD `policy_accepted_at` integer;