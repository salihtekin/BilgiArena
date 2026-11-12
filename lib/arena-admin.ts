import {RANK_ORDER_SQL} from "./ranking.ts";
import {ArenaError} from "./arena-error.ts";
import {GAME_IDS,seasonInfo} from "./game-engine.ts";
import {TRIVIA,WORDS} from "./question-content.ts";
import {adminIds,exactKeys,requireAdmin} from "./arena-security.ts";
import type {AdminEnv,ArenaIdentity} from "./arena-security.ts";
import {integrityStatus} from "./play-integrity.ts";
import type {IntegrityEnv} from "./play-integrity.ts";
import type {AdminAudit,AdminOverview,AdminPage,AdminPlayer,AdminRound,AdminSettings} from "./admin-types";
import type {GameId} from "./game-types";
export type AdminContext={db:D1Database;user:ArenaIdentity|null;env:AdminEnv&IntegrityEnv};
type SettingsRow={maintenance:number;disabled_games_json:string;revision:number;updated_at:number};
export async function getAdminSettings(db:D1Database):Promise<AdminSettings>{
 const row=await db.prepare("SELECT maintenance,disabled_games_json,revision,updated_at FROM admin_settings WHERE id='global'").first<SettingsRow>();
 return{maintenance:!!row?.maintenance,disabledGames:row?JSON.parse(row.disabled_games_json):[],revision:row?.revision||0,updatedAt:row?.updated_at||0};
}
export async function assertGameAvailable(db:D1Database,game:GameId){
 const settings=await getAdminSettings(db);
 if(settings.maintenance)throw new ArenaError("Çevrimiçi oyunlar bakımda. Yeni turlar birazdan açılacak.",503);
 if(settings.disabledGames.includes(game))throw new ArenaError("Bu oyun geçici olarak yeni turlara kapalı.",409);
}
function authorized(ctx:AdminContext){requireAdmin(ctx.user,ctx.env);return ctx.user;}
function reason(value:unknown){if(typeof value!=="string"||value.trim().length<10||value.trim().length>300||/[\u0000-\u001f\u202a-\u202e\u2066-\u2069]/.test(value))throw new ArenaError("İşlem gerekçesi 10–300 karakter olmalı.");return value.trim();}
function target(value:unknown){if(typeof value!=="string"||value.length<1||value.length>100)throw new ArenaError("Geçersiz kayıt.");return value;}
function pageValue(value:string|null){const page=value===null?0:Number(value);if(!Number.isInteger(page)||page<0||page>200)throw new ArenaError("Geçersiz sayfa.");return page;}
function pageOf<T>(rows:T[],page:number):AdminPage<T>{return{rows:rows.slice(0,50),page,hasMore:rows.length>50};}
export async function getAdminOverview(ctx:AdminContext,now=Date.now()):Promise<AdminOverview>{
 authorized(ctx);const {db}=ctx,season=seasonInfo(now);
 const [players,suspended,weeklyPlayers,completed,active,voided,placements,days,games,leaders,settings]=await Promise.all([
  db.prepare("SELECT COUNT(*) n FROM players").first<{n:number}>(),
  db.prepare("SELECT COUNT(*) n FROM players WHERE status='suspended'").first<{n:number}>(),
  db.prepare("SELECT COUNT(DISTINCT r.user_id) n FROM rounds r JOIN players p ON p.id=r.user_id WHERE r.week_key=? AND r.mode='ranked' AND r.status='completed' AND p.status='active'").bind(season.key).first<{n:number}>(),
  db.prepare("SELECT COUNT(*) n FROM rounds WHERE week_key=? AND status='completed'").bind(season.key).first<{n:number}>(),
  db.prepare("SELECT COUNT(*) n FROM rounds WHERE week_key=? AND status IN ('active','revealing') AND expires_at>?").bind(season.key,now).first<{n:number}>(),
  db.prepare("SELECT COUNT(*) n FROM rounds WHERE week_key=? AND status='voided'").bind(season.key).first<{n:number}>(),
  db.prepare("SELECT COUNT(*) n FROM demo_placements WHERE week_key=?").bind(season.key).first<{n:number}>(),
  db.prepare("SELECT day_key day,COUNT(DISTINCT user_id) players,COUNT(*) rounds FROM rounds WHERE week_key=? GROUP BY day_key ORDER BY day_key").bind(season.key).all<{day:string;players:number;rounds:number}>(),
  db.prepare("SELECT game,COUNT(*) rounds,COALESCE(SUM(score),0) score FROM rounds WHERE week_key=? AND status='completed' GROUP BY game").bind(season.key).all<{game:GameId;rounds:number;score:number}>(),
  db.prepare(`SELECT p.id,p.name,SUM(r.score) score,ROW_NUMBER() OVER(ORDER BY ${RANK_ORDER_SQL}) rank FROM players p JOIN rounds r ON r.user_id=p.id WHERE p.status='active' AND r.week_key=? AND r.mode='ranked' AND r.status='completed' GROUP BY p.id HAVING SUM(r.score)>0 ORDER BY rank LIMIT 200`).bind(season.key).all<AdminOverview["leaders"][number]>(),
  getAdminSettings(db),
 ]);
 return{season,settings,totals:{players:players?.n||0,suspended:suspended?.n||0,weeklyPlayers:weeklyPlayers?.n||0,completed:completed?.n||0,active:active?.n||0,voided:voided?.n||0,demoPlacements:placements?.n||0},days:days.results,games:games.results,leaders:leaders.results,security:{...integrityStatus(ctx.env),rateLimitsEnabled:true},content:{trivia:TRIVIA.length,words:WORDS.length},finance:{revenue:0,paid:0,balance:0,connected:false}};
}
export async function getAdminPlayers(ctx:AdminContext,params:URLSearchParams,now=Date.now()){
 authorized(ctx);const page=pageValue(params.get("page")),search=params.get("search")||"";if(search.length>100)throw new ArenaError("Arama en çok 100 karakter olabilir.");
 const pattern=`%${search.replace(/[\\%_]/g,"\\$&")}%`;
 const rows=await ctx.db.prepare(`SELECT p.id,p.name,p.status,p.created_at createdAt,p.suspension_reason reason,COUNT(r.id) rounds,
  COALESCE(SUM(CASE WHEN r.week_key=? AND r.mode='ranked' AND r.status='completed' THEN r.score ELSE 0 END),0) weeklyScore
  FROM players p LEFT JOIN rounds r ON r.user_id=p.id WHERE (p.name LIKE ? ESCAPE '\\' OR p.id=?) GROUP BY p.id ORDER BY p.created_at DESC,p.id LIMIT 51 OFFSET ?`).bind(seasonInfo(now).key,pattern,search,page*50).all<AdminPlayer>();
 return pageOf(rows.results,page);
}
export async function getAdminRounds(ctx:AdminContext,params:URLSearchParams){
 authorized(ctx);const page=pageValue(params.get("page")),status=params.get("status")||"",user=params.get("user")||"";
 if(status&&!["active","revealing","completed","eliminated","expired","abandoned","voided"].includes(status))throw new ArenaError("Geçersiz tur filtresi.");if(user.length>100)throw new ArenaError("Geçersiz oyuncu filtresi.");
 const rows=await ctx.db.prepare(`SELECT r.id,r.user_id userId,p.name,r.game,r.mode,r.status,r.score,r.correct,r.created_at createdAt,r.completed_at completedAt,r.elapsed_ms elapsedMs
  FROM rounds r JOIN players p ON p.id=r.user_id WHERE (?='' OR r.status=?) AND (?='' OR r.user_id=?) ORDER BY r.created_at DESC,r.id LIMIT 51 OFFSET ?`).bind(status,status,user,user,page*50).all<AdminRound>();
 // Deliberately excludes questions_json and answers_json, even for administrators.
 return pageOf(rows.results,page);
}
export async function getAdminAudit(ctx:AdminContext,params:URLSearchParams){
 authorized(ctx);const page=pageValue(params.get("page"));const rows=await ctx.db.prepare("SELECT id,actor_id actorId,action,target_id targetId,reason,before_json before,after_json after,created_at createdAt FROM admin_audit ORDER BY created_at DESC,id LIMIT 51 OFFSET ?").bind(page*50).all<AdminAudit>();return pageOf(rows.results,page);
}
export async function mutateAdmin(ctx:AdminContext,body:Record<string,unknown>,now=Date.now()){
 const actor=authorized(ctx),{db}=ctx,why=reason(body.reason),auditId=crypto.randomUUID();
 if(body.action==="player-status"){
  exactKeys(body,["action","userId","status","reason"]);const userId=target(body.userId),status=body.status;
  if(!["active","suspended"].includes(String(status)))throw new ArenaError("Geçersiz hesap durumu.");
  if(adminIds(ctx.env).has(userId))throw new ArenaError("Yönetici hesapları bu panelden askıya alınamaz.",403);
  const old=await db.prepare("SELECT status,suspension_reason reason FROM players WHERE id=?").bind(userId).first<{status:string;reason:string|null}>();
  if(!old)throw new ArenaError("Oyuncu bulunamadı.",404);if(old.status===status)throw new ArenaError("Hesap zaten bu durumda.",409);
  const results=await db.batch([
   db.prepare("INSERT INTO admin_audit (id,actor_id,action,target_id,reason,before_json,after_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM players WHERE id=? AND status=?)").bind(auditId,actor.userId,"player-status",userId,why,JSON.stringify(old),JSON.stringify({status}),now,userId,old.status),
   db.prepare("UPDATE players SET status=?,suspension_reason=? WHERE id=? AND status=? AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)").bind(status,status==="suspended"?why:null,userId,old.status,auditId),
   db.prepare("UPDATE rounds SET status='abandoned',question_started_at=NULL WHERE user_id=? AND status IN ('active','revealing') AND ?='suspended' AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)").bind(userId,status,auditId),
  ]);if(!results[0].meta.changes)throw new ArenaError("Kayıt değişti. Yenileyip yeniden dene.",409);
 }else if(body.action==="void-round"){
  exactKeys(body,["action","roundId","reason"]);const id=target(body.roundId);
  const old=await db.prepare("SELECT status,mode,score,user_id userId FROM rounds WHERE id=?").bind(id).first<{status:string;mode:string;score:number;userId:string}>();
  if(!old)throw new ArenaError("Tur bulunamadı.",404);if(old.status!=="completed"||old.mode!=="ranked")throw new ArenaError("Yalnızca tamamlanmış puanlı turlar geçersiz kılınabilir.",409);
  const results=await db.batch([
   db.prepare("INSERT INTO admin_audit (id,actor_id,action,target_id,reason,before_json,after_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM rounds WHERE id=? AND status='completed' AND mode='ranked')").bind(auditId,actor.userId,"void-round",id,why,JSON.stringify(old),JSON.stringify({status:"voided"}),now,id),
   db.prepare("UPDATE rounds SET status='voided',question_started_at=NULL WHERE id=? AND status='completed' AND mode='ranked' AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)").bind(id,auditId),
  ]);if(!results[0].meta.changes)throw new ArenaError("Tur değişti. Yenileyip yeniden dene.",409);
 }else if(body.action==="settings"){
  exactKeys(body,["action","maintenance","disabledGames","revision","reason"]);
  if(typeof body.maintenance!=="boolean"||!Array.isArray(body.disabledGames)||body.disabledGames.length>6||!body.disabledGames.every(v=>GAME_IDS.includes(v))||new Set(body.disabledGames).size!==body.disabledGames.length||!Number.isSafeInteger(body.revision))throw new ArenaError("Geçersiz oyun ayarları.");
  await db.prepare("INSERT OR IGNORE INTO admin_settings (id) VALUES ('global')").run();const old=await getAdminSettings(db);
  if(old.revision!==body.revision)throw new ArenaError("Ayarlar başka bir oturumda değişti. Yenile.",409);
  const next={maintenance:body.maintenance,disabledGames:body.disabledGames,revision:old.revision+1};
  const results=await db.batch([
   db.prepare("INSERT INTO admin_audit (id,actor_id,action,target_id,reason,before_json,after_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM admin_settings WHERE id='global' AND revision=?)").bind(auditId,actor.userId,"settings","global",why,JSON.stringify(old),JSON.stringify(next),now,old.revision),
   db.prepare("UPDATE admin_settings SET maintenance=?,disabled_games_json=?,revision=revision+1,updated_at=?,updated_by=? WHERE id='global' AND revision=? AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)").bind(Number(next.maintenance),JSON.stringify(next.disabledGames),now,actor.userId,old.revision,auditId),
  ]);if(!results[0].meta.changes)throw new ArenaError("Ayarlar değişti. Yenileyip yeniden dene.",409);
 }else throw new ArenaError("Geçersiz yönetim işlemi.");
 return{ok:true,auditId};
}
