import {ArenaError} from "./arena-error.ts";
import {dayKey,DAILY_RANKED_LIMIT} from "./game-engine.ts";
import {APP_VERSION,MINIMUM_ANDROID_VERSION_CODE,POLICY_VERSION} from "./release-config.ts";
import type {ArenaIdentity} from "./arena-security.ts";
const RETENTION=90*86400000,COOLDOWN=60000;
type Guard={deleted_at:number;expires_at:number;day_key:string;ranked_starts:number;suspended:number};
type Player={id:string;name:string;status:string;policy_version:string|null};
export async function accountHash(id:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode("bilgiarena:account:v1:"+id))),v=>v.toString(16).padStart(2,"0")).join("");}
async function guardFor(db:D1Database,id:string,now:number){return db.prepare("SELECT * FROM account_guardrails WHERE id_hash=? AND expires_at>?").bind(await accountHash(id),now).first<Guard>();}
export async function preservedRankedStarts(db:D1Database,id:string,now=Date.now()){const g=await guardFor(db,id,now);return g?.day_key===dayKey(now)?g.ranked_starts:0;}
export async function accountStatus(db:D1Database,user:ArenaIdentity,now=Date.now()){
 const p=await db.prepare("SELECT id,name,status,policy_version FROM players WHERE id=?").bind(user.userId).first<Player>();
 const g=await guardFor(db,user.userId,now);
 const state=p?(p.status==="suspended"?"suspended":"active"):g?(g.suspended?"suspended":"deleted"):"none";
 return{minimumAndroidVersionCode:MINIMUM_ANDROID_VERSION_CODE,latestVersion:APP_VERSION,state,consentCurrent:p?.policy_version===POLICY_VERSION,policyVersion:POLICY_VERSION,name:p?.name||"",canRegister:state!=="suspended"&&(!g||now>=g.deleted_at+COOLDOWN)};
}
export async function requireAppAccount(db:D1Database,user:ArenaIdentity,now=Date.now()){
 const s=await accountStatus(db,user,now);
 if(s.state==="suspended")throw new ArenaError("Oyuncu hesabın askıya alındı. Destek veya hesap silme sayfasını kullanabilirsin.",403);
 if(s.state==="deleted")throw new ArenaError("Oyuncu kartın silindi. Yeniden oynamak için açıkça yeni bir kart oluşturmalısın.",410);
 if(s.state!=="active"||!s.consentCurrent)throw new ArenaError("Önce oyuncu kartını ve güncel koşulları onayla.",428);
}
export async function registerAccount(db:D1Database,user:ArenaIdentity,body:Record<string,unknown>,now=Date.now()){
 if(body.action==="register"&&body.policyVersion!==POLICY_VERSION)throw new ArenaError("Güncel koşullar için uygulamanı "+APP_VERSION+" sürümüne güncelle. Ayarlar veya web indirme bağlantısını kullan.",426);
 if(Object.keys(body).some(k=>!["action","name","policyVersion","acceptTerms","acknowledgePrivacy"].includes(k))||body.action!=="register"||body.acceptTerms!==true||body.acknowledgePrivacy!==true||body.policyVersion!==POLICY_VERSION)throw new ArenaError("Güncel koşulları ve gizlilik metnini okuyup ayrı ayrı onaylamalısın.");
 const name=body.name;if(typeof name!=="string"||name.trim().length<2||name.trim().length>24||/[<>\u0000-\u001f\u202a-\u202e\u2066-\u2069]/.test(name))throw new ArenaError("Oyuncu adı 2–24 karakter olmalı.");
 const status=await accountStatus(db,user,now);if(!status.canRegister)throw new ArenaError(status.state==="suspended"?"Askıya alınan hesap yeniden oluşturulamaz.":"Silme işlemi tamamlandı. Yeni kart için bir dakika bekle.",status.state==="suspended"?403:429);
 const inserted=await db.prepare(`INSERT INTO players(id,name,created_at,policy_version,policy_accepted_at,owner_hash)
 SELECT ?,?,?,?, ?,? WHERE NOT EXISTS(SELECT 1 FROM account_guardrails WHERE id_hash=? AND expires_at>? AND (suspended=1 OR deleted_at>?))
 ON CONFLICT(id) DO UPDATE SET name=excluded.name,policy_version=excluded.policy_version,policy_accepted_at=excluded.policy_accepted_at,owner_hash=excluded.owner_hash WHERE players.status='active' RETURNING id`)
 .bind(user.userId,name.trim(),now,POLICY_VERSION,now,await accountHash(user.userId),await accountHash(user.userId),now,now-COOLDOWN).first();
 if(!inserted)throw new ArenaError("Kart oluşturulamadı. Hesap durumunu yenile.",409);
 return accountStatus(db,user,now);
}
export async function deleteAccount(db:D1Database,user:ArenaIdentity,body:Record<string,unknown>,now=Date.now()){
 if(body.action!=="delete"||body.confirmed!==true||Object.keys(body).some(k=>!["action","confirmed"].includes(k)))throw new ArenaError("Kalıcı hesap silme işlemini onaylamalısın.");
 const hash=await accountHash(user.userId),p=await db.prepare("SELECT id FROM players WHERE id=?").bind(user.userId).first();
 if(!p){const g=await guardFor(db,user.userId,now);return{deleted:true,guardRetainedUntil:g?.expires_at||null};}
 const removed="deleted:"+crypto.randomUUID(),today=dayKey(now);
 await db.batch([
  db.prepare(`INSERT INTO account_guardrails(id_hash,deleted_at,expires_at,day_key,ranked_starts,suspended)
   SELECT ?,?,?,?,MIN(?,(SELECT COUNT(*) FROM rounds WHERE user_id=? AND day_key=? AND mode='ranked')),CASE WHEN EXISTS(SELECT 1 FROM players WHERE id=? AND status='suspended') THEN 1 ELSE 0 END
   ON CONFLICT(id_hash) DO UPDATE SET deleted_at=excluded.deleted_at,expires_at=excluded.expires_at,day_key=excluded.day_key,ranked_starts=MIN(?,excluded.ranked_starts+CASE WHEN account_guardrails.day_key=excluded.day_key THEN account_guardrails.ranked_starts ELSE 0 END),suspended=MAX(account_guardrails.suspended,excluded.suspended)`)
   .bind(hash,now,now+RETENTION,today,DAILY_RANKED_LIMIT,user.userId,today,user.userId,DAILY_RANKED_LIMIT),
  db.prepare(`UPDATE admin_audit SET actor_id=CASE WHEN actor_id=? THEN ? ELSE actor_id END,target_id=CASE WHEN target_id=? OR target_id IN(SELECT id FROM rounds WHERE user_id=?) THEN ? ELSE target_id END,reason='Hesap silme sonrasında kişisel ayrıntılar kaldırıldı',before_json='{}',after_json='{}' WHERE actor_id=? OR target_id=? OR target_id IN(SELECT id FROM rounds WHERE user_id=?)`).bind(user.userId,removed,user.userId,user.userId,removed,user.userId,user.userId,user.userId),
  db.prepare("UPDATE admin_settings SET updated_by=? WHERE updated_by=?").bind(removed,user.userId),
  db.prepare("DELETE FROM demo_placements WHERE user_id=?").bind(user.userId),
  db.prepare("DELETE FROM integrity_challenges WHERE user_id=?").bind(user.userId),
  db.prepare("DELETE FROM rounds WHERE user_id=?").bind(user.userId),
  db.prepare("DELETE FROM api_rate_limits WHERE user_id=?").bind(user.userId),
  db.prepare("DELETE FROM payout_methods WHERE owner_hash=?").bind(hash),
  db.prepare("UPDATE competition_entrants SET status='withdrawn' WHERE user_id=? AND status IN('qualified','playing')").bind(user.userId),
  db.prepare("DELETE FROM players WHERE id=?").bind(user.userId),
 ]);
 return{deleted:true,guardRetainedUntil:now+RETENTION};
}
