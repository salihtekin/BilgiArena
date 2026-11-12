import {sql} from "drizzle-orm";
import { sqliteTable, text, integer, index, uniqueIndex, check } from "drizzle-orm/sqlite-core";
export const players = sqliteTable("players", {
  ownerHash: text("owner_hash"), id: text("id").primaryKey(), name: text("name").notNull(), createdAt: integer("created_at").notNull(),
  status: text("status").notNull().default("active"), suspensionReason: text("suspension_reason"),
  avatar:text("avatar").notNull().default("mint"),analyticsConsent:integer("analytics_consent").notNull().default(0),policyVersion: text("policy_version"), policyAcceptedAt: integer("policy_accepted_at"),
});
export const rounds = sqliteTable("rounds", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => players.id),
  game: text("game").notNull(), mode: text("mode").notNull(), weekKey: text("week_key").notNull(), dayKey: text("day_key").notNull(),
  questions: text("questions_json").notNull(), answers: text("answers_json").notNull(), nextIndex: integer("next_index").notNull().default(0),
  score: integer("score").notNull().default(0), correct: integer("correct").notNull().default(0), elapsedMs: integer("elapsed_ms").notNull().default(0),
  status: text("status").notNull().default("active"), createdAt: integer("created_at").notNull(), questionStartedAt: integer("question_started_at"),
  completedAt: integer("completed_at"), expiresAt: integer("expires_at").notNull(),
}, (t) => [index("rounds_user_day_idx").on(t.userId,t.dayKey,t.mode),index("rounds_week_idx").on(t.weekKey,t.mode,t.status)]);
export const demoPlacements = sqliteTable("demo_placements", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => players.id), roundId: text("round_id").notNull().references(() => rounds.id),
  weekKey: text("week_key").notNull(), createdAt: integer("created_at").notNull(),
});
export const integrityChallenges = sqliteTable("integrity_challenges", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => players.id),
  requestHash: text("request_hash").notNull(), payloadHash: text("payload_hash").notNull(),
  createdAt: integer("created_at").notNull(), expiresAt: integer("expires_at").notNull(), consumedAt: integer("consumed_at"),
}, (t) => [index("integrity_user_created_idx").on(t.userId,t.createdAt),index("integrity_expiry_idx").on(t.expiresAt)]);
export const adminSettings=sqliteTable("admin_settings",{
 id:text("id").primaryKey(),maintenance:integer("maintenance").notNull().default(0),disabledGames:text("disabled_games_json").notNull().default("[]"),
 revision:integer("revision").notNull().default(0),updatedAt:integer("updated_at").notNull().default(0),updatedBy:text("updated_by"),
});
export const adminAudit=sqliteTable("admin_audit",{
 id:text("id").primaryKey(),actorId:text("actor_id").notNull(),action:text("action").notNull(),targetId:text("target_id").notNull(),
 reason:text("reason").notNull(),before:text("before_json").notNull(),after:text("after_json").notNull(),createdAt:integer("created_at").notNull(),
},t=>[index("admin_audit_created_idx").on(t.createdAt)]);
export const apiRateLimits=sqliteTable("api_rate_limits",{
 id:text("id").primaryKey(),userId:text("user_id").notNull(),windowKey:integer("window_key").notNull(),requests:integer("requests").notNull(),
},t=>[index("rate_limits_user_window_idx").on(t.userId,t.windowKey)]);
export const accountGuardrails=sqliteTable("account_guardrails",{
 idHash:text("id_hash").primaryKey(),deletedAt:integer("deleted_at").notNull(),expiresAt:integer("expires_at").notNull(),
 dayKey:text("day_key").notNull(),rankedStarts:integer("ranked_starts").notNull().default(0),suspended:integer("suspended").notNull().default(0),
},t=>[index("account_guardrails_expiry_idx").on(t.expiresAt)]);

export const competitions=sqliteTable('competitions',{
 rulesVersion:text('rules_version').notNull().default('2026-10-21'),id:text('id').primaryKey(),weekKey:text('week_key').notNull(),kind:text('kind').notNull(),title:text('title').notNull(),status:text('status').notNull().default('draft'),
 poolKurus:integer('pool_kurus').notNull(),winnerCount:integer('winner_count').notNull(),minimumQualifiers:integer('minimum_qualifiers').notNull(),minimumCheckins:integer('minimum_checkins').notNull(),
 qualifiesAt:integer('qualifies_at').notNull(),checkinAt:integer('checkin_at').notNull(),startsAt:integer('starts_at').notNull(),questions:text('questions_json').notNull(),
 processedStages:integer('processed_stages').notNull().default(0),revision:integer('revision').notNull().default(0),createdAt:integer('created_at').notNull(),reason:text('reason'),fundingReference:text('funding_reference'),
},t=>[uniqueIndex('competitions_week_kind').on(t.weekKey,t.kind),index('competition_status_start').on(t.status,t.startsAt)]);
export const competitionEntrants=sqliteTable('competition_entrants',{
 id:text('id').primaryKey(),competitionId:text('competition_id').notNull().references(()=>competitions.id),userId:text('user_id').references(()=>players.id,{onDelete:'set null'}),ownerHash:text('owner_hash').notNull(),qualifierRank:integer('qualifier_rank').notNull(),
 status:text('status').notNull().default('qualified'),joinedAt:integer('joined_at'),correct:integer('correct').notNull().default(0),elapsedMs:integer('elapsed_ms').notNull().default(0),
},t=>[uniqueIndex('entrant_owner').on(t.competitionId,t.ownerHash),index('entrant_status').on(t.competitionId,t.status)]);
export const competitionAnswers=sqliteTable('competition_answers',{
 id:text('id').primaryKey(),competitionId:text('competition_id').notNull().references(()=>competitions.id),entryId:text('entry_id').notNull().references(()=>competitionEntrants.id),stage:integer('stage').notNull(),correct:integer('correct').notNull(),interrupted:integer('interrupted').notNull(),elapsedMs:integer('elapsed_ms').notNull(),acceptedAt:integer('accepted_at').notNull(),
},t=>[uniqueIndex('answer_entry_stage').on(t.entryId,t.stage)]);
export const competitionStages=sqliteTable('competition_stages',{
 id:text('id').primaryKey(),competitionId:text('competition_id').notNull().references(()=>competitions.id),stage:integer('stage').notNull(),token:text('token').notNull(),settledAt:integer('settled_at').notNull(),
},t=>[uniqueIndex('stage_competition').on(t.competitionId,t.stage)]);
export const prizeAwards=sqliteTable('prize_awards',{
 id:text('id').primaryKey(),competitionId:text('competition_id').notNull().references(()=>competitions.id),entryId:text('entry_id').notNull().references(()=>competitionEntrants.id),ownerHash:text('owner_hash').notNull(),amountKurus:integer('amount_kurus').notNull(),status:text('status').notNull(),createdAt:integer('created_at').notNull(),
},t=>[uniqueIndex('award_entry').on(t.entryId),index('award_owner').on(t.ownerHash)]);
export const wallets=sqliteTable('wallets',{
 ownerHash:text('owner_hash').primaryKey(),availableKurus:integer('available_kurus').notNull().default(0),heldKurus:integer('held_kurus').notNull().default(0),earnedKurus:integer('earned_kurus').notNull().default(0),paidKurus:integer('paid_kurus').notNull().default(0),updatedAt:integer('updated_at').notNull(),
},t=>[check('wallet_nonnegative',sql`${t.availableKurus}>=0 AND ${t.heldKurus}>=0 AND ${t.earnedKurus}>=0 AND ${t.paidKurus}>=0`)]);
export const payoutMethods=sqliteTable('payout_methods',{
 ownerHash:text('owner_hash').primaryKey(),encryptedPayee:text('encrypted_payee').notNull(),maskedIban:text('masked_iban').notNull(),revision:integer('revision').notNull(),updatedAt:integer('updated_at').notNull(),
});
export const payoutRequests=sqliteTable('payout_requests',{
 id:text('id').primaryKey(),ownerHash:text('owner_hash').notNull(),amountKurus:integer('amount_kurus').notNull(),encryptedPayee:text('encrypted_payee'),maskedIban:text('masked_iban').notNull(),idempotencyKey:text('idempotency_key').notNull(),status:text('status').notNull(),revision:integer('revision').notNull(),requestedAt:integer('requested_at').notNull(),updatedAt:integer('updated_at').notNull(),paidAt:integer('paid_at'),reference:text('reference'),note:text('note'),
},t=>[uniqueIndex('payout_owner_key').on(t.ownerHash,t.idempotencyKey),uniqueIndex('payout_reference').on(t.reference),index('payout_owner_date').on(t.ownerHash,t.requestedAt),index('payout_status_date').on(t.status,t.updatedAt),check('payout_positive',sql`${t.amountKurus}>0`)]);
export const walletLedger=sqliteTable('wallet_ledger',{
 id:text('id').primaryKey(),ownerHash:text('owner_hash').notNull(),kind:text('kind').notNull(),referenceId:text('reference_id').notNull(),availableDelta:integer('available_delta').notNull(),heldDelta:integer('held_delta').notNull(),createdAt:integer('created_at').notNull(),
},t=>[uniqueIndex('ledger_reference_kind').on(t.kind,t.referenceId),index('ledger_owner_date').on(t.ownerHash,t.createdAt)]);

export const contentEditions=sqliteTable('content_editions',{
 id:text('id').primaryKey(),game:text('game').notNull(),version:text('version').notNull(),questions:text('questions_json').notNull(),status:text('status').notNull().default('draft'),createdAt:integer('created_at').notNull(),publishedAt:integer('published_at'),
},t=>[uniqueIndex('content_game_version').on(t.game,t.version),index('content_game_status').on(t.game,t.status)]);
export const questionReports=sqliteTable('question_reports',{
 id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>players.id,{onDelete:'cascade'}),questionId:text('question_id').notNull(),contentVersion:text('content_version').notNull(),reason:text('reason').notNull(),status:text('status').notNull().default('open'),createdAt:integer('created_at').notNull(),
},t=>[uniqueIndex('question_report_owner').on(t.userId,t.questionId,t.contentVersion)]);
export const supportTickets=sqliteTable('support_tickets',{
 id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>players.id,{onDelete:'cascade'}),category:text('category').notNull(),status:text('status').notNull().default('open'),message:text('message').notNull(),reply:text('reply'),revision:integer('revision').notNull().default(0),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull(),
},t=>[index('support_owner_date').on(t.userId,t.createdAt)]);
export const productEvents=sqliteTable('product_events',{
 id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>players.id,{onDelete:'cascade'}),day:text('day').notNull(),event:text('event').notNull(),game:text('game').notNull(),count:integer('count').notNull().default(1),
},t=>[index('event_day').on(t.day),index('event_owner_day').on(t.userId,t.day)]);
export const roundAccess=sqliteTable('round_access',{
 roundId:text('round_id').primaryKey().references(()=>rounds.id,{onDelete:'cascade'}),userId:text('user_id').notNull().references(()=>players.id,{onDelete:'cascade'}),tokenHash:text('token_hash').notNull(),expiresAt:integer('expires_at').notNull(),
});
export const prizeReviews=sqliteTable('prize_reviews',{
 awardId:text('award_id').primaryKey().references(()=>prizeAwards.id),decision:text('decision').notNull(),evidenceRef:text('evidence_ref').notNull(),note:text('note').notNull(),reviewedBy:text('reviewed_by').notNull(),reviewedAt:integer('reviewed_at').notNull(),
});
export const adEvents=sqliteTable('ad_events',{
 id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>players.id,{onDelete:'cascade'}),event:text('event').notNull(),currency:text('currency').notNull(),micros:integer('micros').notNull(),precision:integer('precision').notNull(),createdAt:integer('created_at').notNull(),
},t=>[index('ad_owner_date').on(t.userId,t.createdAt)]);

export const operationRuns=sqliteTable('operation_runs',{
 id:text('id').primaryKey(),kind:text('kind').notNull(),source:text('source').notNull(),status:text('status').notNull(),leaseToken:text('lease_token').notNull(),leaseExpiresAt:integer('lease_expires_at').notNull(),startedAt:integer('started_at').notNull(),finishedAt:integer('finished_at'),attempts:integer('attempts').notNull().default(1),errorTag:text('error_tag'),summary:text('summary_json').notNull().default('{}'),
},t=>[index('operation_kind_date').on(t.kind,t.startedAt)]);
