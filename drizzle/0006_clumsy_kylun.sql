CREATE TABLE `competition_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`competition_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`stage` integer NOT NULL,
	`correct` integer NOT NULL,
	`interrupted` integer NOT NULL,
	`elapsed_ms` integer NOT NULL,
	`accepted_at` integer NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entry_id`) REFERENCES `competition_entrants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `answer_entry_stage` ON `competition_answers` (`entry_id`,`stage`);--> statement-breakpoint
CREATE TABLE `competition_entrants` (
	`id` text PRIMARY KEY NOT NULL,
	`competition_id` text NOT NULL,
	`user_id` text,
	`owner_hash` text NOT NULL,
	`qualifier_rank` integer NOT NULL,
	`status` text DEFAULT 'qualified' NOT NULL,
	`joined_at` integer,
	`correct` integer DEFAULT 0 NOT NULL,
	`elapsed_ms` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entrant_owner` ON `competition_entrants` (`competition_id`,`owner_hash`);--> statement-breakpoint
CREATE INDEX `entrant_status` ON `competition_entrants` (`competition_id`,`status`);--> statement-breakpoint
CREATE TABLE `competition_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`competition_id` text NOT NULL,
	`stage` integer NOT NULL,
	`token` text NOT NULL,
	`settled_at` integer NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stage_competition` ON `competition_stages` (`competition_id`,`stage`);--> statement-breakpoint
CREATE TABLE `competitions` (
	`id` text PRIMARY KEY NOT NULL,
	`week_key` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`pool_kurus` integer NOT NULL,
	`winner_count` integer NOT NULL,
	`minimum_qualifiers` integer NOT NULL,
	`minimum_checkins` integer NOT NULL,
	`qualifies_at` integer NOT NULL,
	`checkin_at` integer NOT NULL,
	`starts_at` integer NOT NULL,
	`questions_json` text NOT NULL,
	`processed_stages` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`reason` text,
	`funding_reference` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competitions_week_kind` ON `competitions` (`week_key`,`kind`);--> statement-breakpoint
CREATE INDEX `competition_status_start` ON `competitions` (`status`,`starts_at`);--> statement-breakpoint
CREATE TABLE `payout_methods` (
	`owner_hash` text PRIMARY KEY NOT NULL,
	`encrypted_payee` text NOT NULL,
	`masked_iban` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payout_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_hash` text NOT NULL,
	`amount_kurus` integer NOT NULL,
	`encrypted_payee` text,
	`masked_iban` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text NOT NULL,
	`revision` integer NOT NULL,
	`requested_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`paid_at` integer,
	`reference` text,
	`note` text,
	CONSTRAINT "payout_positive" CHECK("payout_requests"."amount_kurus">0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payout_owner_key` ON `payout_requests` (`owner_hash`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `payout_reference` ON `payout_requests` (`reference`);--> statement-breakpoint
CREATE INDEX `payout_owner_date` ON `payout_requests` (`owner_hash`,`requested_at`);--> statement-breakpoint
CREATE INDEX `payout_status_date` ON `payout_requests` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `prize_awards` (
	`id` text PRIMARY KEY NOT NULL,
	`competition_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`owner_hash` text NOT NULL,
	`amount_kurus` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entry_id`) REFERENCES `competition_entrants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `award_entry` ON `prize_awards` (`entry_id`);--> statement-breakpoint
CREATE INDEX `award_owner` ON `prize_awards` (`owner_hash`);--> statement-breakpoint
CREATE TABLE `wallet_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_hash` text NOT NULL,
	`kind` text NOT NULL,
	`reference_id` text NOT NULL,
	`available_delta` integer NOT NULL,
	`held_delta` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ledger_reference_kind` ON `wallet_ledger` (`kind`,`reference_id`);--> statement-breakpoint
CREATE INDEX `ledger_owner_date` ON `wallet_ledger` (`owner_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `wallets` (
	`owner_hash` text PRIMARY KEY NOT NULL,
	`available_kurus` integer DEFAULT 0 NOT NULL,
	`held_kurus` integer DEFAULT 0 NOT NULL,
	`earned_kurus` integer DEFAULT 0 NOT NULL,
	`paid_kurus` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "wallet_nonnegative" CHECK("wallets"."available_kurus">=0 AND "wallets"."held_kurus">=0 AND "wallets"."earned_kurus">=0 AND "wallets"."paid_kurus">=0)
);
--> statement-breakpoint
ALTER TABLE `players` ADD `owner_hash` text;