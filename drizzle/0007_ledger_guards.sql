CREATE TRIGGER ledger_no_update BEFORE UPDATE ON wallet_ledger BEGIN SELECT RAISE(ABORT,'immutable ledger'); END;
--> statement-breakpoint
CREATE TRIGGER ledger_no_delete BEFORE DELETE ON wallet_ledger BEGIN SELECT RAISE(ABORT,'immutable ledger'); END;
