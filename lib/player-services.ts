import {ArenaError} from './arena-error.ts';
import {accountHash} from './account-store.ts';
import {dayKey} from './game-engine.ts';
import {exactKeys,requireAdmin,type ArenaIdentity,type AdminEnv} from './arena-security.ts';
import type {Question} from './game-types.ts';
type Context={db:D1Database;user:ArenaIdentity;env:AdminEnv};
const categories=['game','account','ranking','payment','appeal'];
const reportReasons=['wrong-answer','typo','unclear'];
const events=['first-open','open','tutorial-complete','practice-complete','error','crash-recovered'];
function safeMessage(v:unknown){if(typeof v!=='string'||v.trim().length<10||v.length>1500||/[<>\x00-\x08]/.test(v)||/TR\s*\d{2}(?:\s*\d){20,}/i.test(v)||/\b\d{16,}\b/.test(v))throw new ArenaError('10–1500 karakterle sorunu anlat. Parola, kimlik veya banka bilgisi yazma.');return v.trim();}
export async function playerServices(ctx:Context,page=0){
 const {db,user}=ctx;if(!Number.isInteger(page)||page<0||page>250)throw new ArenaError('Geçersiz sayfa.');
 const prefs=await db.prepare('SELECT analytics_consent FROM players WHERE id=?').bind(user.userId).first<{analytics_consent:number}>();
 return{analyticsConsent:!!prefs?.analytics_consent,history:(await db.prepare("SELECT id,game,mode,score,correct,completed_at completedAt FROM rounds WHERE user_id=? AND status IN('completed','eliminated') ORDER BY completed_at DESC,id LIMIT 21 OFFSET ?").bind(user.userId,page*20).all()).results,tickets:(await db.prepare('SELECT id,category,status,message,reply,revision,created_at,updated_at FROM support_tickets WHERE user_id=? ORDER BY created_at DESC LIMIT 30').bind(user.userId).all()).results};
}
export async function productEvent(db:D1Database,userId:string,event:string,game:string,now=Date.now(),count=1){
 const p=await db.prepare('SELECT analytics_consent FROM players WHERE id=?').bind(userId).first<{analytics_consent:number}>();if(!p?.analytics_consent)return;
 const day=dayKey(now),id=JSON.stringify([userId,day,event,game]);await db.prepare('INSERT INTO product_events SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM players WHERE id=? AND analytics_consent=1) ON CONFLICT(id) DO UPDATE SET count=MIN(count+excluded.count,1000) WHERE EXISTS(SELECT 1 FROM players WHERE id=? AND analytics_consent=1)').bind(id,userId,day,event,game,count,userId,userId).run();
}
export async function playerMutation(ctx:Context,b:Record<string,unknown>,now=Date.now()){
 const {db,user}=ctx;
 if(b.action==='avatar'){exactKeys(b,['action','avatar']);if(!['mint','coral','blue','gold','plum','slate'].includes(String(b.avatar)))throw new ArenaError('Geçersiz oyuncu rengi.');await db.prepare('UPDATE players SET avatar=? WHERE id=?').bind(b.avatar,user.userId).run();return{ok:true};}
 if(b.action==='analytics-consent'){exactKeys(b,['action','enabled']);if(typeof b.enabled!=='boolean')throw new ArenaError('Geçersiz tercih.');await db.batch([db.prepare('UPDATE players SET analytics_consent=? WHERE id=?').bind(b.enabled?1:0,user.userId),...(!b.enabled?[db.prepare('DELETE FROM product_events WHERE user_id=?').bind(user.userId),db.prepare('DELETE FROM ad_events WHERE user_id=?').bind(user.userId)]:[])]);return{ok:true};}
 if(b.action==='event'){exactKeys(b,['action','event','game','count']);if(b.count!==undefined&&(b.event!=='crash-recovered'||!Number.isInteger(b.count)||Number(b.count)<1||Number(b.count)>99))throw new ArenaError('Geçersiz hata sayısı.');if(!events.includes(String(b.event))||!['none','mixed','trivia','word','reverse','memory','math','colors'].includes(String(b.game)))throw new ArenaError('Geçersiz etkinlik.');await productEvent(db,user.userId,String(b.event),String(b.game),now,Number(b.count||1));return{ok:true};}
 if(b.action==='question-report'){
 exactKeys(b,['action','roundId','index','reason']);if(!Number.isInteger(b.index)||Number(b.index)<0||Number(b.index)>9||!reportReasons.includes(String(b.reason)))throw new ArenaError('Geçersiz bildirim.');
 const r=await db.prepare('SELECT questions_json,next_index FROM rounds WHERE id=? AND user_id=?').bind(String(b.roundId),user.userId).first<{questions_json:string;next_index:number}>();let q:Question|undefined;
 if(r&&Number(b.index)<r.next_index)q=(JSON.parse(r.questions_json) as Question[])[Number(b.index)];
 if(!q){const c=await db.prepare("SELECT c.questions_json,c.processed_stages FROM competitions c JOIN competition_entrants e ON e.competition_id=c.id WHERE c.id=? AND e.owner_hash=? AND e.joined_at IS NOT NULL").bind(String(b.roundId),await accountHash(user.userId)).first<{questions_json:string;processed_stages:number}>();if(c&&Number(b.index)<c.processed_stages)q=JSON.parse(c.questions_json)[Number(b.index)]?.question;}
 if(!q)throw new ArenaError('Yalnız tamamladığın aşamayı bildirebilirsin.',403);
 await db.prepare("INSERT OR IGNORE INTO question_reports VALUES(?,?,?,?,?,'open',?)").bind(crypto.randomUUID(),user.userId,q.id,q.contentVersion||'2026-10-21',b.reason,now).run();return{ok:true};
 }
 if(b.action==='ad-event'){
 exactKeys(b,['action','id','event','currency','micros','precision']);if(typeof b.id!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(b.id)||!['impression','paid-estimate'].includes(String(b.event))||typeof b.currency!=='string'||!/^[A-Z]{3}$/.test(b.currency)||!Number.isSafeInteger(b.micros)||Number(b.micros)<0||Number(b.micros)>1000000000||!Number.isInteger(b.precision)||Number(b.precision)<0||Number(b.precision)>3)throw new ArenaError('Geçersiz SDK ölçümü.');
 const prefs=await db.prepare('SELECT analytics_consent FROM players WHERE id=?').bind(user.userId).first<{analytics_consent:number}>();if(!prefs?.analytics_consent)return{ok:true};
 await db.prepare('INSERT OR IGNORE INTO ad_events SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM players WHERE id=? AND analytics_consent=1) AND (SELECT COUNT(*) FROM ad_events WHERE user_id=? AND created_at>?)<1000').bind(user.userId+':'+b.id,user.userId,b.event,b.currency,b.micros,b.precision,now,user.userId,user.userId,now-86400000).run();return{ok:true};
 }
 if(b.action==='support-create'){
 exactKeys(b,['action','category','message']);if(!categories.includes(String(b.category)))throw new ArenaError('Geçersiz destek konusu.');const message=safeMessage(b.message),id=crypto.randomUUID();
 const saved=await db.prepare("INSERT INTO support_tickets SELECT ?,?,?,'open',?,NULL,0,?,? WHERE (SELECT COUNT(*) FROM support_tickets WHERE user_id=? AND status<>'resolved')<5 RETURNING id").bind(id,user.userId,b.category,message,now,now,user.userId).first();if(!saved)throw new ArenaError('Açık 5 destek kaydın var. Yanıtları takip edebilirsin.',409);return{id};
 }throw new ArenaError('Geçersiz oyuncu işlemi.');
}
export async function serviceOverview(ctx:Context){
 requireAdmin(ctx.user,ctx.env);const db=ctx.db;
 const cohorts=(await db.prepare(`WITH cohort AS (SELECT user_id,MIN(day) day FROM product_events GROUP BY user_id)
 SELECT c.day cohort,COUNT(*) players,SUM(EXISTS(SELECT 1 FROM product_events e WHERE e.user_id=c.user_id AND e.day=date(c.day,'+1 day'))) d1,SUM(EXISTS(SELECT 1 FROM product_events e WHERE e.user_id=c.user_id AND e.day=date(c.day,'+7 day'))) d7 FROM cohort c GROUP BY c.day ORDER BY c.day DESC LIMIT 30`).all()).results;
 return{adEstimates:(await db.prepare("SELECT currency,event,COUNT(*) count,SUM(micros) micros FROM ad_events GROUP BY currency,event").all()).results,tickets:(await db.prepare('SELECT id,category,status,message,reply,revision,created_at,updated_at FROM support_tickets ORDER BY updated_at DESC LIMIT 100').all()).results,events:(await db.prepare('SELECT day,event,game,SUM(count) count,COUNT(DISTINCT user_id) players FROM product_events GROUP BY day,event,game ORDER BY day DESC LIMIT 180').all()).results,cohorts,disclosure:'İsteğe bağlı ölçüm; ilk gözlenen gün kohortu. Olgunlaşmamış D1/D7 günleri değerlendirilmez. İstemci etkinlikleri ve SDK tahminleri mali mutabakat değildir.'};
}
export async function serviceAdminMutation(ctx:Context,b:Record<string,unknown>,now=Date.now()){
 requireAdmin(ctx.user,ctx.env);exactKeys(b,['action','id','revision','status','reply','reason']);if(b.action!=='support-reply'||!['waiting','resolved'].includes(String(b.status))||!Number.isInteger(b.revision)||typeof b.reason!=='string'||b.reason.trim().length<8||b.reason.length>500)throw new ArenaError('Geçersiz destek işlemi.');const reply=safeMessage(b.reply),token=crypto.randomUUID();
 await ctx.db.batch([ctx.db.prepare("INSERT INTO admin_audit SELECT ?,?,'support-reply',?,?, '{}','{}',? WHERE EXISTS(SELECT 1 FROM support_tickets WHERE id=? AND revision=?)").bind(token,ctx.user.userId,String(b.id),b.reason,now,String(b.id),b.revision),ctx.db.prepare('UPDATE support_tickets SET reply=?,status=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)').bind(reply,b.status,now,String(b.id),b.revision,token)]);if(!await ctx.db.prepare('SELECT id FROM admin_audit WHERE id=?').bind(token).first())throw new ArenaError('Destek kaydı değişmiş; yenile.',409);return{ok:true};
}
