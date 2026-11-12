import {ArenaError} from './arena-error.ts';
import {accountHash} from './account-store.ts';
import {requireAdmin,exactKeys,type ArenaIdentity,type AdminEnv} from './arena-security.ts';
import {integrityStatus,type IntegrityEnv} from './play-integrity.ts';
export type FinanceEnv=AdminEnv&IntegrityEnv&{ARENA_PAYOUT_KEYRING?:string;ARENA_CASH_ENABLED?:string};
export type FinanceContext={db:D1Database;user:ArenaIdentity;env:FinanceEnv};
const fail=(m:string,s=400):never=>{throw new ArenaError(m,s);};
export function amount(v:unknown){if(!Number.isSafeInteger(v)||Number(v)<100||Number(v)>100000000)fail('Tutar 1–1.000.000 TL arasında tam kuruş olmalı.');return Number(v);}
export function reason(v:unknown){if(typeof v!=='string'||v.trim().length<10||v.length>300||/[\x00-\x1f\u202a-\u202e\u2066-\u2069]/.test(v))fail('10–300 karakter işlem gerekçesi gerekli.');return (v as string).trim();}
export function identifier(v:unknown){if(typeof v!=='string'||!/^[-a-zA-Z0-9_:]{1,100}$/.test(v))fail('Geçersiz kayıt kimliği.');return v as string;}
export function payee(name:unknown,raw:unknown){if(typeof name!=='string'||!/^\p{L}[\p{L} .'-]{3,98}\p{L}$/u.test(name.trim())||!name.trim().includes(' '))fail('Hesap sahibinin adını ve soyadını gir.');if(typeof raw!=='string')fail('TR IBAN gerekli.');const iban=(raw as string).replace(/\s/g,'').toUpperCase();if(!/^TR\d{24}$/.test(iban)||iban[9]!=='0')fail('Geçersiz TR IBAN.');let mod=0;for(const c of iban.slice(4)+'2927'+iban.slice(2,4))mod=(mod*10+Number(c))%97;if(mod!==1)fail('IBAN kontrol hanesi geçersiz.');return {name:(name as string).trim(),iban};}
const mask=(s:string)=>s.slice(0,4)+' •••• •••• •••• •••• '+s.slice(-4);
function ring(env:FinanceEnv){try{const r=JSON.parse(env.ARENA_PAYOUT_KEYRING||'');if(!r.keys||typeof r.current!=='string'||!/^[-\w]{1,32}$/.test(r.current)||Object.keys(r.keys).length>5||typeof r.keys[r.current]!=='string'||atob(r.keys[r.current]).length!==32)throw 0;return r as {current:string;keys:Record<string,string>};}catch{throw new ArenaError('Ödeme şifreleme anahtarı yapılandırılmadı.',503);}}
const b64=(a:Uint8Array)=>btoa(String.fromCharCode(...a));
export async function encryptPayee(env:FinanceEnv,owner:string,p:ReturnType<typeof payee>){const r=ring(env),iv=crypto.getRandomValues(new Uint8Array(12)),key=await crypto.subtle.importKey('raw',Uint8Array.from(atob(r.keys[r.current]),c=>c.charCodeAt(0)),'AES-GCM',false,['encrypt']);return JSON.stringify({v:1,kid:r.current,iv:b64(iv),data:b64(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode('arena:payee:'+owner)},key,new TextEncoder().encode(JSON.stringify(p)))))});}
export async function decryptPayee(env:FinanceEnv,owner:string,value:string){try{const r=ring(env),v=JSON.parse(value);if(v.v!==1||!r.keys[v.kid])throw 0;const key=await crypto.subtle.importKey('raw',Uint8Array.from(atob(r.keys[v.kid]),c=>c.charCodeAt(0)),'AES-GCM',false,['decrypt']);const p=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(atob(v.iv),c=>c.charCodeAt(0)),additionalData:new TextEncoder().encode('arena:payee:'+owner)},key,Uint8Array.from(atob(v.data),c=>c.charCodeAt(0)))));return payee(p.name,p.iban);}catch{throw new ArenaError('Banka bilgisi çözülemedi. Yönetici anahtar yedeğini kontrol etmeli.',503);}}
export function cashReadiness(env:FinanceEnv){const blockers:string[]=[];if(env.ARENA_CASH_ENABLED!=='true')blockers.push('Nakit yarışma açılmadı');try{ring(env);}catch{blockers.push('Ödeme şifreleme anahtarı eksik');}const i=integrityStatus(env);if(!i.integrityRequired||!i.integrityConfigured)blockers.push('Play Integrity bağlantısı ve zorunluluğu eksik');return{enabled:blockers.length===0,blockers,paymentMode:'manual_bank'};}
export function requireCash(env:FinanceEnv){const r=cashReadiness(env);if(!r.enabled)fail(r.blockers.join('. '),503);}
async function cleanup(db:D1Database,now:number){await db.prepare("UPDATE payout_requests SET encrypted_payee=NULL WHERE id IN(SELECT id FROM payout_requests WHERE status IN('paid','rejected','cancelled') AND updated_at<? AND encrypted_payee IS NOT NULL ORDER BY updated_at LIMIT 100)").bind(now-90*86400000).run();}
export async function wallet(c:FinanceContext,now=Date.now()){
 const owner=await accountHash(c.user.userId);await cleanup(c.db,now);
 const a=await c.db.prepare('SELECT available_kurus,held_kurus,earned_kurus,paid_kurus FROM wallets WHERE owner_hash=?').bind(owner).first<Record<string,number>>();
 const m=await c.db.prepare('SELECT masked_iban,revision FROM payout_methods WHERE owner_hash=?').bind(owner).first();
 const payouts=(await c.db.prepare('SELECT id,amount_kurus,masked_iban,status,revision,requested_at,updated_at,paid_at,reference,note FROM payout_requests WHERE owner_hash=? ORDER BY requested_at DESC LIMIT 50').bind(owner).all()).results;
 const awards=(await c.db.prepare('SELECT id,competition_id,amount_kurus,status,created_at FROM prize_awards WHERE owner_hash=? ORDER BY created_at DESC LIMIT 50').bind(owner).all()).results;
 const ledger=(await c.db.prepare('SELECT id,kind,available_delta,held_delta,created_at FROM wallet_ledger WHERE owner_hash=? ORDER BY created_at DESC,id DESC LIMIT 50').bind(owner).all()).results;
 return {availableKurus:a?.available_kurus||0,heldKurus:a?.held_kurus||0,earnedKurus:a?.earned_kurus||0,paidKurus:a?.paid_kurus||0,method:m,payouts,awards,ledger,readiness:cashReadiness(c.env)};
}
export async function walletMutation(c:FinanceContext,b:Record<string,unknown>,now=Date.now()){
 const owner=await accountHash(c.user.userId),db=c.db;
 if(b.action==='method-save'){
  exactKeys(b,['action','recipientName','iban','revision','ownAccountConfirmed']);if(b.ownAccountConfirmed!==true)fail('Yalnızca kendi banka hesabını kullanabilirsin.');if(!Number.isSafeInteger(b.revision)||Number(b.revision)<0)fail('Geçersiz sürüm.');
  const award=await db.prepare("SELECT id FROM prize_awards WHERE owner_hash=? AND amount_kurus>0 AND status IN('pending','released') LIMIT 1").bind(owner).first();if(!award)fail('Banka bilgisi yalnızca ödül kazananlardan alınır.',409);
  const p=payee(b.recipientName,b.iban),encrypted=await encryptPayee(c.env,owner,p),rev=Number(b.revision);
  const result=rev===0?await db.prepare('INSERT INTO payout_methods(owner_hash,encrypted_payee,masked_iban,revision,updated_at) VALUES(?,?,?,1,?) ON CONFLICT DO NOTHING RETURNING owner_hash').bind(owner,encrypted,mask(p.iban),now).first():await db.prepare('UPDATE payout_methods SET encrypted_payee=?,masked_iban=?,revision=revision+1,updated_at=? WHERE owner_hash=? AND revision=? RETURNING owner_hash').bind(encrypted,mask(p.iban),now,owner,rev).first();
  if(!result)fail('Banka kaydı değişmiş; yenile.',409);return wallet(c,now);
 }
 if(b.action==='method-remove'){exactKeys(b,['action']);await db.prepare('DELETE FROM payout_methods WHERE owner_hash=?').bind(owner).run();return wallet(c,now);}
 if(b.action==='request'){
  exactKeys(b,['action','amountKurus','idempotencyKey','confirmed']);requireCash(c.env);const n=amount(b.amountKurus),key=identifier(b.idempotencyKey);if(key.length<16||b.confirmed!==true)fail('Para çekme isteğini onayla.');
  const existing=await db.prepare('SELECT id,amount_kurus FROM payout_requests WHERE owner_hash=? AND idempotency_key=?').bind(owner,key).first<{id:string;amount_kurus:number}>();if(existing){if(existing.amount_kurus!==n)fail('Aynı işlem anahtarı farklı tutarla kullanılamaz.',409);return wallet(c,now);}
  const m=await db.prepare('SELECT * FROM payout_methods WHERE owner_hash=?').bind(owner).first<{encrypted_payee:string;masked_iban:string}>();if(!m)fail('Önce kendi TR IBAN hesabını kaydet.',409);await decryptPayee(c.env,owner,m!.encrypted_payee);
  const id=crypto.randomUUID();await db.batch([
   db.prepare("INSERT OR IGNORE INTO payout_requests(id,owner_hash,amount_kurus,encrypted_payee,masked_iban,idempotency_key,status,revision,requested_at,updated_at) SELECT ?,?,?,?,?,?,'pending',0,?,? FROM wallets WHERE owner_hash=? AND available_kurus>=?").bind(id,owner,n,m!.encrypted_payee,m!.masked_iban,key,now,now,owner,n),
   db.prepare("INSERT INTO wallet_ledger(id,owner_hash,kind,reference_id,available_delta,held_delta,created_at) SELECT ?,?,'reserve',?,-amount_kurus,amount_kurus,? FROM payout_requests WHERE id=?").bind('reserve:'+id,owner,id,now,id),
   db.prepare("UPDATE wallets SET available_kurus=available_kurus-?,held_kurus=held_kurus+?,updated_at=? WHERE owner_hash=? AND EXISTS(SELECT 1 FROM wallet_ledger WHERE id=?)").bind(n,n,now,owner,'reserve:'+id)
  ]);const saved=await db.prepare('SELECT amount_kurus FROM payout_requests WHERE owner_hash=? AND idempotency_key=?').bind(owner,key).first<{amount_kurus:number}>();if(!saved)fail('Çekilebilir bakiye yetersiz.',409);if(saved!.amount_kurus!==n)fail('Aynı işlem anahtarı farklı tutarla kullanılamaz.',409);return wallet(c,now);
 }
 if(b.action==='cancel'){
  exactKeys(b,['action','id']);const id=identifier(b.id),p=await db.prepare('SELECT status FROM payout_requests WHERE id=? AND owner_hash=?').bind(id,owner).first<{status:string}>();if(!p)fail('İstek bulunamadı.',404);if(p!.status==='cancelled')return wallet(c,now);if(p!.status!=='pending')fail('İşleme alınan istek iptal edilemez.',409);
  await db.batch([
   db.prepare("INSERT OR IGNORE INTO wallet_ledger(id,owner_hash,kind,reference_id,available_delta,held_delta,created_at) SELECT ?,owner_hash,'cancel',id,amount_kurus,-amount_kurus,? FROM payout_requests WHERE id=? AND owner_hash=? AND status='pending'").bind('cancel:'+id,now,id,owner),
   db.prepare("UPDATE wallets SET available_kurus=available_kurus+(SELECT amount_kurus FROM payout_requests WHERE id=?),held_kurus=held_kurus-(SELECT amount_kurus FROM payout_requests WHERE id=?),updated_at=? WHERE owner_hash=? AND EXISTS(SELECT 1 FROM payout_requests WHERE id=? AND status='pending') AND EXISTS(SELECT 1 FROM wallet_ledger WHERE id=?)").bind(id,id,now,owner,id,'cancel:'+id),
   db.prepare("UPDATE payout_requests SET status='cancelled',revision=revision+1,updated_at=? WHERE id=? AND owner_hash=? AND status='pending'").bind(now,id,owner)
  ]);return wallet(c,now);
 }
 fail('Geçersiz cüzdan işlemi.');
}
export async function financeOverview(c:FinanceContext,page=0,now=Date.now()){
 requireAdmin(c.user,c.env);if(!Number.isInteger(page)||page<0||page>10000)fail('Geçersiz sayfa.');await cleanup(c.db,now);
 const totals=await c.db.prepare('SELECT COALESCE(SUM(available_kurus),0) available,COALESCE(SUM(held_kurus),0) held,COALESCE(SUM(earned_kurus),0) earned,COALESCE(SUM(paid_kurus),0) paid FROM wallets').first();
 const rows=(await c.db.prepare('SELECT id,amount_kurus,masked_iban,status,revision,requested_at,updated_at,paid_at,reference,note FROM payout_requests ORDER BY requested_at DESC,id LIMIT 51 OFFSET ?').bind(page*50).all()).results;
 return {totals,rows:rows.slice(0,50),hasMore:rows.length>50,readiness:cashReadiness(c.env),bankConnection:'manual_operator_confirmation',adRevenue:null};
}
export async function financeMutation(c:FinanceContext,b:Record<string,unknown>,now=Date.now()){
 requireAdmin(c.user,c.env);const db=c.db,id=identifier(b.id),why=reason(b.reason);
 const p=await db.prepare('SELECT * FROM payout_requests WHERE id=?').bind(id).first<{owner_hash:string;encrypted_payee:string|null;status:string;revision:number;amount_kurus:number}>();if(!p)fail('Ödeme isteği bulunamadı.',404);
 if(b.action==='payout-reveal'){
  exactKeys(b,['action','id','reason']);if(!p!.encrypted_payee)fail('Banka ayrıntılarının saklama süresi dolmuş.',410);
  await db.prepare("INSERT INTO admin_audit VALUES(?,?, 'payout-reveal',?,?, '{}','{}',?)").bind(crypto.randomUUID(),c.user.userId,id,why,now).run();return decryptPayee(c.env,p!.owner_hash,p!.encrypted_payee!);
 }
 exactKeys(b,['action','id','reason','revision','decision','reference','transferConfirmed','notSentConfirmed']);if(b.action!=='payout-status'||b.revision!==p!.revision)fail('İstek değişmiş; yenile.',409);
 const decision=String(b.decision),from=decision==='process'||decision==='reject'?'pending':'processing',to=decision==='process'?'processing':decision==='paid'?'paid':'rejected';
 if(!['process','reject','paid','not-sent'].includes(decision)||p!.status!==from)fail('Bu durum geçişi yapılamaz.',409);
 let reference:string|null=null;if(decision==='paid'){if(b.transferConfirmed!==true||typeof b.reference!=='string'||!/^[-a-zA-Z0-9_:/ .]{6,100}$/.test(b.reference.trim()))fail('Gerçek banka havalesini ve dekont referansını onayla.');reference=(b.reference as string).trim();if(await db.prepare('SELECT id FROM payout_requests WHERE reference=?').bind(reference).first())fail('Bu havale referansı kullanılmış.',409);}
 if(decision==='not-sent'&&b.notSentConfirmed!==true)fail('Banka havalesinin yapılmadığını doğrula.');
 const token=crypto.randomUUID(),revision=p!.revision,n=p!.amount_kurus,refund=to==='rejected',terminal=to!=='processing';
 try{await db.batch([
  db.prepare('INSERT INTO admin_audit(id,actor_id,action,target_id,reason,before_json,after_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM payout_requests WHERE id=? AND status=? AND revision=?)').bind(token,c.user.userId,'payout-'+decision,id,why,JSON.stringify({status:from}),JSON.stringify({status:to}),now,id,from,revision),
  db.prepare('UPDATE payout_requests SET status=?,revision=revision+1,updated_at=?,paid_at=?,reference=?,note=? WHERE id=? AND status=? AND revision=? AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)').bind(to,now,to==='paid'?now:null,reference,why,id,from,revision,token),
  ...(terminal?[
   db.prepare('INSERT INTO wallet_ledger(id,owner_hash,kind,reference_id,available_delta,held_delta,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM admin_audit WHERE id=?)').bind('settle:'+id,p!.owner_hash,to==='paid'?'paid':'refund',id,refund?n:0,-n,now,token),
   db.prepare('UPDATE wallets SET available_kurus=available_kurus+?,held_kurus=held_kurus-?,paid_kurus=paid_kurus+?,updated_at=? WHERE owner_hash=? AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)').bind(refund?n:0,n,to==='paid'?n:0,now,p!.owner_hash,token)
  ]:[])
 ]);}catch(error){if(reference&&await db.prepare('SELECT id FROM payout_requests WHERE reference=?').bind(reference).first())fail('Bu havale referansı kullanılmış.',409);throw error;}
 if(!await db.prepare('SELECT id FROM admin_audit WHERE id=?').bind(token).first())fail('İstek başka bir işlemde değişmiş; yenile.',409);return{ok:true};
}
