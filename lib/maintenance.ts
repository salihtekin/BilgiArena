import {requireAdmin,type ArenaIdentity,type AdminEnv} from './arena-security.ts';
import {advanceCompetition} from './competitions.ts';
import type {FinanceEnv} from './finance.ts';
type Context={db:D1Database;user:ArenaIdentity;env:AdminEnv&FinanceEnv&{PLAY_INTEGRITY_DAILY_QUOTA?:string;ARENA_EXPECTED_DAILY_PLAYERS?:string}};
export async function maintenanceOverview(ctx:Context){requireAdmin(ctx.user,ctx.env);const quota=Number(ctx.env.PLAY_INTEGRITY_DAILY_QUOTA||10000),players=Number(ctx.env.ARENA_EXPECTED_DAILY_PLAYERS||200);const expected=Number.isSafeInteger(players)&&players>0?players:200,projected=expected*33+Math.min(expected,200)*11;return{estimatedFinalDayTokens:projected,withHeadroom:Math.ceil(projected*1.2),declaredQuota:Number.isSafeInteger(quota)&&quota>0?quota:10000,expectedPlayers:Number.isSafeInteger(players)&&players>0?players:200,rankedTokensPerPlayer:33,finalDayTokensPerPlayer:44,headroomFactor:1.2,schedulerVerified:false,providerBackupVerified:false,rounds:(await ctx.db.prepare('SELECT status,COUNT(*) count FROM competitions GROUP BY status').all()).results};}
/** Bounded and idempotent. This admin writer is not an unattended scheduler. */
export async function runMaintenance(ctx:Context,now=Date.now()){
 requireAdmin(ctx.user,ctx.env);const due=(await ctx.db.prepare("SELECT id FROM competitions WHERE status IN('published','sealed','running') AND qualifies_at<=? ORDER BY starts_at LIMIT 20").bind(now).all<{id:string}>()).results;for(const c of due)await advanceCompetition(ctx,c.id,now);
 await ctx.db.batch([
 ctx.db.prepare('DELETE FROM integrity_challenges WHERE id IN(SELECT id FROM integrity_challenges WHERE expires_at<? LIMIT 500)').bind(now-86400000),
 ctx.db.prepare('DELETE FROM round_access WHERE round_id IN(SELECT round_id FROM round_access WHERE expires_at<? LIMIT 500)').bind(now),
 ctx.db.prepare("DELETE FROM product_events WHERE id IN(SELECT id FROM product_events WHERE day<? LIMIT 500)").bind(new Date(now-90*86400000).toISOString().slice(0,10)),
 ctx.db.prepare('DELETE FROM ad_events WHERE id IN(SELECT id FROM ad_events WHERE created_at<? LIMIT 500)').bind(now-90*86400000),
 ctx.db.prepare("UPDATE payout_requests SET encrypted_payee=NULL WHERE id IN(SELECT id FROM payout_requests WHERE status IN('paid','rejected','cancelled') AND updated_at<? AND encrypted_payee IS NOT NULL LIMIT 100)").bind(now-90*86400000),
 ctx.db.prepare("INSERT INTO admin_audit VALUES(?,?,'maintenance','system','Vadesi gelen final durumları ve süreli kayıtlar işlendi','{}','{}',?)").bind(crypto.randomUUID(),ctx.user.userId,now),
 ]);return{ok:true,processedCompetitions:due.length,serverNow:now};
}
