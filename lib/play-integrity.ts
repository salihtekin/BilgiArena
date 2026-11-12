import {MINIMUM_ANDROID_VERSION_CODE} from "./release-config.ts";
import {ArenaError} from "./arena-error.ts";

export const ANDROID_PACKAGE="com.bilgiarena.app";
const LIFETIME=120_000;
export type IntegrityEnv={ARENA_CASH_ENABLED?:string;ARENA_INTEGRITY_REQUIRED?:string;PLAY_CLOUD_PROJECT_NUMBER?:string;PLAY_INTEGRITY_CERTIFICATES?:string;PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON?:string};
type Challenge={id:string;user_id:string;request_hash:string;payload_hash:string;created_at:number;expires_at:number;consumed_at:number|null};
type Policy={packageName:string;certificates:string[];minimumVersionCode?:number};
type Verdict={requestDetails?:{requestPackageName?:string;requestHash?:string;timestampMillis?:string};appIntegrity?:{appRecognitionVerdict?:string;packageName?:string;certificateSha256Digest?:string[];versionCode?:string};deviceIntegrity?:{deviceRecognitionVerdict?:string[]};accountDetails?:{appLicensingVerdict?:string};environmentDetails?:{appAccessRiskVerdict?:{appsDetected?:string[]}}};
function b64url(bytes:Uint8Array){let s="";for(const n of bytes)s+=String.fromCharCode(n);return btoa(s).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");}
export async function hash(value:string){return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))));}
export function integrityStatus(env:IntegrityEnv){
 const required=env.ARENA_INTEGRITY_REQUIRED==="true";
 const project=Number(env.PLAY_CLOUD_PROJECT_NUMBER||0);
 const configured=Number.isSafeInteger(project)&&project>0&&!!env.PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON&&!!env.PLAY_INTEGRITY_CERTIFICATES?.trim();
 return{integrityRequired:required,integrityConfigured:configured,cloudProjectNumber:configured?project:0,packageName:ANDROID_PACKAGE,realPrizeEnabled:env.ARENA_CASH_ENABLED==="true"&&required&&configured};
}
function policy(env:IntegrityEnv):Policy{
 if(!integrityStatus(env).integrityConfigured)throw new ArenaError("Cihaz doğrulaması henüz yapılandırılmadı. Antrenmanlar kullanılabilir.",503);
 return{minimumVersionCode:MINIMUM_ANDROID_VERSION_CODE,packageName:ANDROID_PACKAGE,certificates:env.PLAY_INTEGRITY_CERTIFICATES!.split(",").map(s=>s.trim().replace(/=+$/,""))};
}
export async function createChallenge(db:D1Database,userId:string,payload:unknown,env:IntegrityEnv,now=Date.now()){
 policy(env);
 if(typeof payload!=="string"||payload.length>8192)throw new ArenaError("Geçersiz doğrulama isteği.");
 let parsed;try{parsed=JSON.parse(payload);}catch{throw new ArenaError("Geçersiz doğrulama isteği.");}
 if(!parsed||!["start","answer","next","resume","interrupt","contest-join","contest-answer","contest-interrupt"].includes(parsed.action))throw new ArenaError("Bu işlem doğrulanamaz.");
 // Keep at most one day of consumed/expired challenges, and bound creation per player.
 await db.prepare("DELETE FROM integrity_challenges WHERE id IN(SELECT id FROM integrity_challenges WHERE expires_at < ? LIMIT 500)").bind(now-86_400_000).run();
 const id=crypto.randomUUID(),payloadHash=await hash(payload),requestHash=await hash(JSON.stringify(["bilgiarena:v1",userId,id,payload]));
 const saved=await db.prepare(`INSERT INTO integrity_challenges (id,user_id,request_hash,payload_hash,created_at,expires_at)
  SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM integrity_challenges WHERE user_id=? AND created_at>?) < 40 RETURNING id`)
  .bind(id,userId,requestHash,payloadHash,now,now+LIFETIME,userId,now-60_000).first();
 if(!saved)throw new ArenaError("Çok sık doğrulama isteği gönderildi. Biraz bekle.",429);
 return{id,requestHash,expiresAt:now+LIFETIME};
}

/** Only call with the token payload returned by Google's authenticated decode endpoint. */
export function validateVerdict(v:Verdict,expectedHash:string,p:Policy,now=Date.now()){
 const request=v.requestDetails,app=v.appIntegrity,timestamp=Number(request?.timestampMillis);
 if(request?.requestPackageName!==p.packageName||request?.requestHash!==expectedHash||!Number.isFinite(timestamp)||now-timestamp>LIFETIME||timestamp-now>10_000)
  throw new ArenaError("Cihaz doğrulaması bu istekle eşleşmedi. Yeniden dene.",403);
 if(app?.appRecognitionVerdict!=="PLAY_RECOGNIZED"||app.packageName!==p.packageName||!Array.isArray(app.certificateSha256Digest)||!app.certificateSha256Digest.some(c=>p.certificates.includes(c.replace(/=+$/,""))))
  throw new ArenaError("Google Play üzerinden sunulan resmî sürümü kullanmalısın.",403);
 if(p.minimumVersionCode&&(!Number.isSafeInteger(Number(app.versionCode))||Number(app.versionCode)<p.minimumVersionCode))throw new ArenaError("Puanlı oyun için Android uygulamasını güncelle.",426);
 if(!v.deviceIntegrity?.deviceRecognitionVerdict?.includes("MEETS_DEVICE_INTEGRITY")||v.accountDetails?.appLicensingVerdict!=="LICENSED")
  throw new ArenaError("Bu cihaz veya uygulama lisansı doğrulanamadı. Google Play hizmetlerini kontrol et.",403);
 const risks=v.environmentDetails?.appAccessRiskVerdict?.appsDetected;
 if(!Array.isArray(risks)||risks.length===0)throw new ArenaError("Ekran erişimi doğrulanamadı. Daha sonra yeniden dene.",403);
 if(risks.some(r=>/_(CAPTURING|CONTROLLING|OVERLAYS)$/.test(r)))throw new ArenaError("Ekranı kaydeden, kaplayan veya kontrol eden uygulamayı kapatıp yeniden dene.",403);
}

let cachedAccess:{identity:string;token:string;expiresAt:number}|undefined;
async function accessToken(env:IntegrityEnv,now:number){
 let account:{client_email?:string;private_key?:string};try{account=JSON.parse(env.PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON!);}catch{throw new ArenaError("Cihaz doğrulama ayarı geçersiz.",503);}
 if(!account.client_email||!account.private_key)throw new ArenaError("Cihaz doğrulama ayarı eksik.",503);
 if(cachedAccess?.identity===account.client_email&&cachedAccess.expiresAt>now+60_000)return cachedAccess.token;
 const encode=(v:unknown)=>b64url(new TextEncoder().encode(JSON.stringify(v)));
 const unsigned=`${encode({alg:"RS256",typ:"JWT"})}.${encode({iss:account.client_email,scope:"https://www.googleapis.com/auth/playintegrity",aud:"https://oauth2.googleapis.com/token",iat:Math.floor(now/1000),exp:Math.floor(now/1000)+3600})}`;
 const pem=account.private_key.replace(/-----[^-]+-----|\s/g,"");
 let key:CryptoKey;try{key=await crypto.subtle.importKey("pkcs8",Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);}catch{throw new ArenaError("Cihaz doğrulama anahtarı geçersiz.",503);}
 const signature=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(unsigned));
 const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:`${unsigned}.${b64url(new Uint8Array(signature))}`}),signal:AbortSignal.timeout(10_000)});
 if(!response.ok)throw new ArenaError("Cihaz doğrulama hizmetine ulaşılamadı.",503);
 const result=await response.json() as {access_token?:string;expires_in?:number};if(!result.access_token)throw new ArenaError("Cihaz doğrulama hizmeti yanıt vermedi.",503);
 cachedAccess={identity:account.client_email,token:result.access_token,expiresAt:now+Math.min(3600,result.expires_in||300)*1000};return result.access_token;
}
export async function verifyRequest(db:D1Database,userId:string,raw:string,request:Request,env:IntegrityEnv,now=Date.now()){
 if(!integrityStatus(env).integrityRequired)return;
 const p=policy(env),id=request.headers.get("x-arena-challenge"),token=request.headers.get("x-arena-integrity-token");
 if(!id||id.length>100||!token||token.length>32_000)throw new ArenaError("Bu tur için doğrulanmış Android uygulamasını kullanmalısın.",428);
 const challenge=await db.prepare("SELECT * FROM integrity_challenges WHERE id=? AND user_id=?").bind(id,userId).first<Challenge>();
 if(!challenge||challenge.consumed_at!==null||challenge.expires_at<=now||challenge.payload_hash!==await hash(raw))throw new ArenaError("Doğrulama isteği geçersiz veya süresi dolmuş.",403);
 const access=await accessToken(env,now);
 const response=await fetch(`https://playintegrity.googleapis.com/v1/${ANDROID_PACKAGE}:decodeIntegrityToken`,{method:"POST",headers:{Authorization:`Bearer ${access}`,"Content-Type":"application/json"},body:JSON.stringify({integrity_token:token}),signal:AbortSignal.timeout(12_000)});
 if(!response.ok)throw new ArenaError("Cihaz doğrulaması tamamlanamadı. Yeniden dene.",403);
 const decoded=await response.json() as {tokenPayloadExternal?:Verdict};
 if(!decoded.tokenPayloadExternal)throw new ArenaError("Cihaz doğrulama yanıtı eksik.",403);
 validateVerdict(decoded.tokenPayloadExternal,challenge.request_hash,p,now);
 const used=await db.prepare("UPDATE integrity_challenges SET consumed_at=? WHERE id=? AND user_id=? AND consumed_at IS NULL AND expires_at>? RETURNING id").bind(now,id,userId,now).first();
 if(!used)throw new ArenaError("Bu cihaz doğrulaması daha önce kullanıldı.",403);
}
