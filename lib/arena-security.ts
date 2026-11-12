import {ArenaError} from "./arena-error.ts";

export type ArenaIdentity={userId:string;email:string;fullName?:string|null};
export type AdminEnv={ARENA_ADMIN_USER_IDS?:string;ARENA_ADMIN_EMAILS?:string};
const entries=(value?:string)=>new Set((value||"").split(",").map(v=>v.trim()).filter(Boolean));
export function isAdmin(user:ArenaIdentity|null,env:AdminEnv){
 return !!user&&entries(env.ARENA_ADMIN_USER_IDS).has(user.userId)&&entries(env.ARENA_ADMIN_EMAILS?.toLowerCase()).has(user.email.toLowerCase());
}
export function requireAdmin(user:ArenaIdentity|null,env:AdminEnv):asserts user is ArenaIdentity{
 if(!user)throw new ArenaError("Yönetim paneli için giriş yapmalısın.",401);
 if(!isAdmin(user,env))throw new ArenaError("Bu alana erişim yetkin yok.",403);
}
export function adminIds(env:AdminEnv){return entries(env.ARENA_ADMIN_USER_IDS);}
export async function assertPlayerActive(db:D1Database,userId:string){
 const player=await db.prepare("SELECT status FROM players WHERE id=?").bind(userId).first<{status:string}>();
 if(player?.status==="suspended")throw new ArenaError("Hesabın inceleme için askıya alındı. Şu anda çevrimiçi oyunlara erişilemiyor.",403);
}
export function assertWriteOrigin(request:Request,admin=false){
 const origin=request.headers.get("origin"),site=request.headers.get("sec-fetch-site");
 if((origin&&origin!==new URL(request.url).origin)||site==="cross-site"||site==="same-site")throw new ArenaError("Bu istek kaynağı kabul edilmedi.",403);
 // Native Android has no Fetch Metadata. Browser admin mutations require both
 // a same-origin Origin and a non-simple custom header, never a URL token.
 if(admin&&(origin!==new URL(request.url).origin||request.headers.get("x-arena-admin")!=="1"))throw new ArenaError("Yönetim isteği doğrulanamadı. Sayfayı yenile.",403);
}
export async function readJson(request:Request,maxBytes=8192){
 if(request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/json")throw new ArenaError("JSON isteği gerekli.",415);
 const length=request.headers.get("content-length");
 if(length&&(!/^\d+$/.test(length)||Number(length)>maxBytes))throw new ArenaError("İstek çok büyük.",413);
 const reader=request.body?.getReader();if(!reader)throw new ArenaError("İstek gövdesi gerekli.");
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){void reader.cancel();throw new ArenaError("İstek çok büyük.",413);}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 let raw:string,body:Record<string,unknown>;
 try{raw=new TextDecoder("utf-8",{fatal:true}).decode(bytes);body=JSON.parse(raw);}catch{throw new ArenaError("Geçersiz JSON isteği.");}
 if(!body||typeof body!=="object"||Array.isArray(body))throw new ArenaError("Geçersiz istek.");
 return{raw,body};
}
export function exactKeys(body:Record<string,unknown>,allowed:string[]){
 if(Object.keys(body).some(key=>!allowed.includes(key)))throw new ArenaError("İstek desteklenmeyen bir alan içeriyor.");
}
export function validateArenaBody(body:Record<string,unknown>){
 const actions:Record<string,string[]>={start:["game","mode"],profile:["name"],"integrity-challenge":["payload"],answer:["roundId","index","answer"],interrupt:["roundId","index","reason"],next:["roundId"],resume:["roundId"],abandon:["roundId"]};
 if(typeof body.action!=="string"||!Object.hasOwn(actions,body.action))throw new ArenaError("Geçersiz işlem.");
 exactKeys(body,["action",...actions[body.action]]);
 if(["answer","interrupt","next","resume","abandon"].includes(body.action)&&(typeof body.roundId!=="string"||body.roundId.length<1||body.roundId.length>100))throw new ArenaError("Tur bilgisi gerekli.");
 if(["answer","interrupt"].includes(body.action)&&(!Number.isInteger(body.index)||Number(body.index)<0||Number(body.index)>9))throw new ArenaError("Geçersiz soru.");
 if(body.action==="answer"&&!(body.answer===null||typeof body.answer==="string"&&body.answer.length<=100||typeof body.answer==="number"&&Number.isFinite(body.answer)||Array.isArray(body.answer)&&body.answer.length<=9&&body.answer.every(n=>Number.isInteger(n)&&n>=0&&n<9)))throw new ArenaError("Geçersiz yanıt.");
 if(body.action==="interrupt"&&!["background","multi_window"].includes(String(body.reason)))throw new ArenaError("Geçersiz kesinti bildirimi.");
}
/** D1 provides the atomic counter across Worker instances. No process-local Map. */
export async function enforceRateLimit(db:D1Database,userId:string,bucket:string,limit:number,now=Date.now()){
 const window=Math.floor(now/60_000),key=JSON.stringify([userId,bucket,window]);
 const row=await db.prepare(`INSERT INTO api_rate_limits (id,user_id,window_key,requests) VALUES (?,?,?,1)
  ON CONFLICT(id) DO UPDATE SET requests=requests+1 WHERE requests<? RETURNING requests`).bind(key,userId,window,limit).first();
 if(!row)throw new ArenaError("Çok sık istek gönderildi. Bir dakika bekleyip yeniden dene.",429);
 // Per-user cleanup is indexed and cannot erase another user's live window.
 await db.prepare("DELETE FROM api_rate_limits WHERE user_id=? AND window_key<?").bind(userId,window-2).run();
}
export const PRIVATE_HEADERS={"Cache-Control":"no-store, private","Vary":"Cookie","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
export function apiResponse(body:unknown,status=200){return Response.json(body,{status,headers:{...PRIVATE_HEADERS,...(status===429?{"Retry-After":"60"}:{})}});}
export function apiFailure(error:unknown,area="arena"){
 if(error instanceof ArenaError)return apiResponse({error:error.message},error.status);
 // Do not log bodies, names, cookies, tokens, database SQL or service secrets.
 console.error(`${area}_request_failed`);return apiResponse({error:"İstek şu anda tamamlanamadı. Birazdan yeniden dene."},500);
}
