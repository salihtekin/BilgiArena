import {ArenaError} from './arena-error.ts';
import {requireAdmin,exactKeys,type ArenaIdentity,type AdminEnv} from './arena-security.ts';
import {makeQuestions,shuffle,seededRandom,CONTENT_VERSION} from './game-engine.ts';
import type {Question,GameId} from './game-types.ts';
type Context={db:D1Database;user:ArenaIdentity;env:AdminEnv};
export function validateCatalog(game:unknown,value:unknown):Question[]{
 if(!['trivia','word','reverse'].includes(String(game))||!Array.isArray(value)||value.length<10||value.length>500)throw new ArenaError('Bilgi veya kelime oyunu için 10–500 soruluk bir havuz gir.');
 const ids=new Set<string>();for(const q of value){
 if(!q||typeof q!=='object'||typeof q.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(q.id)||ids.has(q.id))throw new ArenaError('Soru kimlikleri benzersiz olmalı.');ids.add(q.id);
 for(const [key,max] of [['prompt',300],['category',50],['explanation',500]] as const)if(typeof q[key]!=='string'||!q[key].trim()||q[key].length>max||/[<>\x00-\x1f]/.test(q[key]))throw new ArenaError('Soru, kategori ve açıklamayı geçerli metinlerle doldur.');
 if(![10,15].includes(q.seconds)||![1,2,3].includes(q.difficulty))throw new ArenaError('Süre 10/15, zorluk 1/2/3 olmalı.');
 if(game==='trivia'){if(q.kind!=='choice'||!Array.isArray(q.options)||q.options.length!==4||new Set(q.options).size!==4||q.options.some((o:unknown)=>typeof o!=='string'||!o.trim()||o.length>100||/[<>\x00-\x1f]/.test(o))||!Number.isInteger(q.answer)||q.answer<0||q.answer>3)throw new ArenaError('Bilgi sorusunda dört ayrı seçenek ve 0–3 arası doğru cevap gerekir.');}
 else if(q.kind!=='word'||typeof q.answer!=='string'||!/^[a-zçğıöşüâîû]{3,14}$/u.test(q.answer))throw new ArenaError('Kelime cevabını 3–14 küçük Türkçe harfle gir.');
 }
 return value.map(q=>({id:q.id,game:game as GameId,kind:q.kind,category:q.category,prompt:q.prompt,seconds:q.seconds,difficulty:q.difficulty,answer:q.answer,explanation:q.explanation,...(game==='trivia'?{options:q.options}:{})}));
}
export async function contentQuestions(db:D1Database,game:GameId,seed:string,seen:string[]=[]){
 const row=await db.prepare("SELECT version,questions_json FROM content_editions WHERE game=? AND status='published' ORDER BY published_at DESC LIMIT 1").bind(game).first<{version:string;questions_json:string}>();
 if(!row)return makeQuestions(game,seed,seen).map(q=>({...q,game,contentVersion:CONTENT_VERSION}));
 const random=seededRandom(seed);return shuffle(JSON.parse(row.questions_json) as Question[],random).sort((a,b)=>Number(seen.includes(a.id))-Number(seen.includes(b.id))).slice(0,10).map(q=>{
 if(q.kind==='choice'){const opts=shuffle(q.options!.map((text,i)=>({text,correct:i===q.answer})),random);return {...q,options:opts.map(o=>o.text),answer:opts.findIndex(o=>o.correct),contentVersion:row.version};}
 const chars=[...String(q.answer).toLocaleUpperCase('tr-TR')];let scrambled=game==='reverse'?chars.reverse().join(''):shuffle(chars,random).join('');if(game==='word'&&scrambled===chars.join(''))scrambled=chars.slice(1).concat(chars[0]).join('');return {...q,scrambled,contentVersion:row.version};
 });
}
export async function contentOverview(ctx:Context,id?:string){requireAdmin(ctx.user,ctx.env);if(id){const row=await ctx.db.prepare('SELECT id,game,version,status,questions_json FROM content_editions WHERE id=?').bind(id).first<{id:string;game:string;version:string;status:string;questions_json:string}>();if(!row)throw new ArenaError('Sürüm bulunamadı.',404);return {...row,questions:JSON.parse(row.questions_json),questions_json:undefined};}return{templates:Object.fromEntries((['trivia','word','reverse'] as GameId[]).map(game=>[game,makeQuestions(game,'editor-template').map(q=>({...q,game,difficulty:1,contentVersion:CONTENT_VERSION}))])),editions:(await ctx.db.prepare('SELECT id,game,version,status,created_at,published_at FROM content_editions ORDER BY created_at DESC LIMIT 50').all()).results,reports:(await ctx.db.prepare('SELECT question_id,content_version,reason,status,COUNT(*) count FROM question_reports GROUP BY question_id,content_version,reason,status ORDER BY count DESC LIMIT 100').all()).results};}
export async function contentMutation(ctx:Context,b:Record<string,unknown>,now=Date.now()){
 requireAdmin(ctx.user,ctx.env);const db=ctx.db;if(typeof b.reason!=='string'||b.reason.trim().length<8||b.reason.length>500)throw new ArenaError('İşlemin gerekçesini yaz.');
 if(b.action==='content-draft'){
 exactKeys(b,['action','game','version','questions','reason']);if(typeof b.version!=='string'||!/^[a-zA-Z0-9._-]{3,40}$/.test(b.version))throw new ArenaError('Geçerli ve benzersiz sürüm etiketi gir.');const qs=validateCatalog(b.game,b.questions),id=crypto.randomUUID();
 if(await db.prepare('SELECT id FROM content_editions WHERE game=? AND version=?').bind(b.game,b.version).first())throw new ArenaError('Bu sürüm zaten var.',409);
 await db.batch([db.prepare("INSERT INTO content_editions VALUES(?,?,?,?,'draft',?,NULL)").bind(id,b.game,b.version,JSON.stringify(qs),now),db.prepare("INSERT INTO admin_audit VALUES(?,?,'content-draft',?,?, '{}','{}',?)").bind(crypto.randomUUID(),ctx.user.userId,id,b.reason,now)]);return{id};
 }
 if(b.action==='content-publish'){
 exactKeys(b,['action','id','reason','reviewed']);if(b.reviewed!==true)throw new ArenaError('Doğruluk, dil ve süre incelemesini onayla.');const row=await db.prepare("SELECT * FROM content_editions WHERE id=? AND status='draft'").bind(String(b.id)).first<{id:string;game:string;questions_json:string}>();if(!row)throw new ArenaError('Yayımlanabilir taslak bulunamadı.',409);validateCatalog(row.game,JSON.parse(row.questions_json));const token=crypto.randomUUID();
 await db.batch([db.prepare("INSERT INTO admin_audit SELECT ?,?,'content-publish',?,?, '{}','{}',? WHERE EXISTS(SELECT 1 FROM content_editions WHERE id=? AND status='draft')").bind(token,ctx.user.userId,row.id,b.reason,now,row.id),db.prepare("UPDATE content_editions SET status='retired' WHERE game=? AND status='published' AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)").bind(row.game,token),db.prepare("UPDATE content_editions SET status='published',published_at=? WHERE id=? AND status='draft' AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)").bind(now,row.id,token)]);if(!await db.prepare('SELECT id FROM admin_audit WHERE id=?').bind(token).first())throw new ArenaError('Taslak başka işlemde değişti.',409);return{ok:true};
 }throw new ArenaError('Geçersiz içerik işlemi.');
}
