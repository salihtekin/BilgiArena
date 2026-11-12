import test from "node:test";
import assert from "node:assert/strict";
import {testStore} from "./test-db.ts";
import {ensurePlayer,startRound,submitAnswer,nextQuestion,getRound,getDashboard} from "../lib/arena-store.ts";
import {getAdminOverview,getAdminPlayers,getAdminRounds,getAdminAudit,mutateAdmin} from "../lib/arena-admin.ts";
import {enforceRateLimit,isAdmin,readJson,assertWriteOrigin,validateArenaBody,apiFailure} from "../lib/arena-security.ts";
import {protectResponse} from "../lib/response-security.ts";
import type {AdminContext} from "../lib/arena-admin.ts";
import type {Question} from "../lib/game-types.ts";
const NOW=Date.parse("2026-10-20T09:00:00+03:00"),owner={userId:"owner",email:"owner@example.invalid"},ordinary={userId:"player",email:"player@example.invalid"};
const env={ARENA_ADMIN_USER_IDS:owner.userId,ARENA_ADMIN_EMAILS:owner.email};
async function setup(){const {db,sqlite}=testStore();await ensurePlayer(db,owner.userId,"Salih",NOW);await ensurePlayer(db,ordinary.userId,"Ada",NOW);const ctx:AdminContext={db,user:owner,env};return{db,sqlite,ctx};}
async function completed(db:D1Database,sqlite:ReturnType<typeof testStore>["sqlite"],user="player"){
 let now=NOW,view=await startRound(db,user,"math","ranked",now);
 for(let i=0;i<10;i++){const raw=sqlite.prepare("SELECT questions_json FROM rounds WHERE id=?").get(view.id) as {questions_json:string};const q=(JSON.parse(raw.questions_json) as Question[])[i];view=await submitAnswer(db,user,view.id,i,q.answer,now+=(q.kind==="memory"?5000:1500));if(i<9)view=await nextQuestion(db,user,view.id,now+=500);}
 return view;
}
test("admin permission is fail-closed and requires BOTH trusted identity fields",()=>{
 assert.equal(isAdmin(owner,env),true);assert.equal(isAdmin({...owner,email:owner.email.toUpperCase()},env),true);
 for(const [user,config] of [[null,env],[owner,{}],[owner,{ARENA_ADMIN_USER_IDS:"owner"}],[ordinary,env],[{...ordinary,email:owner.email},env],[{...owner,email:ordinary.email},env]] as const)assert.equal(isAdmin(user,config),false);
});
test("every admin data operation and mutation rejects a normal user before revealing data",async()=>{
 const {ctx}=await setup();for(const user of [ordinary,null]){const denied={...ctx,user};
  for(const action of [()=>getAdminOverview(denied,NOW),()=>getAdminPlayers(denied,new URLSearchParams(),NOW),()=>getAdminRounds(denied,new URLSearchParams()),()=>getAdminAudit(denied,new URLSearchParams()),()=>mutateAdmin(denied,{action:"settings",reason:"Yetkisiz deneme"},NOW)])await assert.rejects(action,(e:any)=>[401,403].includes(e.status));
 }
});
test("owner overview uses real counts, excludes answers and does not invent money",async()=>{
 const{ctx,db}=await setup();await startRound(db,"player","math","ranked",NOW);const o=await getAdminOverview(ctx,NOW);
 assert.equal(o.totals.players,2);assert.equal(o.totals.active,1);assert.equal(o.totals.weeklyPlayers,0);assert.equal(o.finance.revenue,0);assert.equal(o.finance.connected,false);
 const r=await getAdminRounds(ctx,new URLSearchParams());assert.equal(r.rows.length,1);assert.equal("questions_json" in r.rows[0],false);assert.equal("answers_json" in r.rows[0],false);
});
test("suspension closes active rounds, removes league access, rejects an existing session and is audited",async()=>{
 const{ctx,db,sqlite}=await setup();await completed(db,sqlite);const active=await startRound(db,"player","trivia","ranked",NOW+40000);
 await mutateAdmin(ctx,{action:"player-status",userId:"player",status:"suspended",reason:"Tekrarlanan otomatik istek incelemesi"},NOW+41000);
 assert.equal((sqlite.prepare("SELECT status FROM rounds WHERE id=?").get(active.id) as any).status,"abandoned");
 for(const fn of [()=>getDashboard(db,"player",NOW+42000),()=>getRound(db,"player",active.id,NOW+42000),()=>startRound(db,"player","math","practice",NOW+42000)])await assert.rejects(fn,(e:any)=>e.status===403);
 assert.equal((await getDashboard(db,"owner",NOW+42000)).leaders.length,0);
 const audit=await getAdminAudit(ctx,new URLSearchParams());assert.equal(audit.rows.length,1);assert.equal(audit.rows[0].actorId,"owner");
 await mutateAdmin(ctx,{action:"player-status",userId:"player",status:"active",reason:"İnceleme sonrası erişim yeniden açıldı"},NOW+43000);
 assert.equal((await getDashboard(db,"player",NOW+44000)).weeklyScore,100);
 await assert.rejects(()=>mutateAdmin(ctx,{action:"player-status",userId:"owner",status:"suspended",reason:"Yönetici hesabını kapatma denemesi"},NOW),(e:any)=>e.status===403);
});
test("voiding a ranked round subtracts its points, retains evidence and cannot be replayed",async()=>{
 const{ctx,db,sqlite}=await setup(),view=await completed(db,sqlite);assert.equal((await getDashboard(db,"player",NOW+25000)).weeklyScore,100);
 await mutateAdmin(ctx,{action:"void-round",roundId:view.id,reason:"İncelemede doğrulanmış puanlama hatası"},NOW+26000);
 const saved=sqlite.prepare("SELECT score,status FROM rounds WHERE id=?").get(view.id) as any;assert.deepEqual({...saved},{score:100,status:"voided"});
 assert.equal((await getDashboard(db,"player",NOW+27000)).weeklyScore,0);
 await assert.rejects(()=>mutateAdmin(ctx,{action:"void-round",roundId:view.id,reason:"Tekrar geçersiz kılma denemesi"},NOW+28000),(e:any)=>e.status===409);
 assert.equal((await getAdminAudit(ctx,new URLSearchParams())).rows.length,1);
});
test("an audit write failure rolls back the management change",async()=>{
 const{ctx,sqlite}=await setup();sqlite.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON admin_audit BEGIN SELECT RAISE(ABORT,'simulated failure'); END");
 await assert.rejects(()=>mutateAdmin(ctx,{action:"player-status",userId:"player",status:"suspended",reason:"İşlem atomikliğini doğrulama"},NOW));
 assert.equal((sqlite.prepare("SELECT status FROM players WHERE id='player'").get() as any).status,"active");assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM admin_audit").get() as any).n,0);
});
test("a business change failure also rolls back the previously inserted audit row",async()=>{
 const{ctx,sqlite}=await setup();sqlite.exec("CREATE TRIGGER fail_player BEFORE UPDATE ON players BEGIN SELECT RAISE(ABORT,'simulated failure'); END");
 await assert.rejects(()=>mutateAdmin(ctx,{action:"player-status",userId:"player",status:"suspended",reason:"Ters yönde atomik işlem kontrolü"},NOW));assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM admin_audit").get() as any).n,0);
});
test("maintenance and individual game controls are server-enforced and stale edits lose safely",async()=>{
 const{ctx,db}=await setup(),active=await startRound(db,"owner","math","ranked",NOW);
 await mutateAdmin(ctx,{action:"settings",maintenance:true,disabledGames:[],revision:0,reason:"Planlı sistem bakım çalışması"},NOW+1000);
 await assert.rejects(()=>startRound(db,"player","math","ranked",NOW+2000),(e:any)=>e.status===503);assert.equal((await getRound(db,"owner",active.id,NOW+2000)).status,"active");
 await assert.rejects(()=>mutateAdmin(ctx,{action:"settings",maintenance:false,disabledGames:[],revision:0,reason:"Eski ayar sürümüyle yazma denemesi"},NOW+3000),(e:any)=>e.status===409);
 await mutateAdmin(ctx,{action:"settings",maintenance:false,disabledGames:["trivia"],revision:1,reason:"Bilgi sorularının kontrol edilmesi"},NOW+4000);
 await assert.rejects(()=>startRound(db,"player","trivia","ranked",NOW+5000),(e:any)=>e.status===409);
 await assert.rejects(()=>startRound(db,"player","reverse","final",NOW+5000),(e:any)=>e.status===409);
 assert.equal((await startRound(db,"player","memory","practice",NOW+6000)).game,"memory");
});
test("admin mutations reject arbitrary fields, invalid games and short reasons without writes",async()=>{
 const{ctx,sqlite}=await setup();for(const body of [{action:"settings",maintenance:false,disabledGames:["fake"],revision:0,reason:"Geçersiz oyun ekleme denemesi"},{action:"settings",maintenance:false,disabledGames:[],revision:0,reason:"Kısa"},{action:"player-status",userId:"player",status:"suspended",role:"admin",reason:"Yetki ekleme denemesi alanı"}])await assert.rejects(()=>mutateAdmin(ctx,body,NOW));
 assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM admin_audit").get() as any).n,0);
});
test("parameterized literal search and bounded paging resist SQL injection and wildcard scans",async()=>{
 const{ctx}=await setup();for(const search of ["%' OR 1=1 --","%","_"]){const result=await getAdminPlayers(ctx,new URLSearchParams({search}),NOW);assert.equal(result.rows.length,0);}
 assert.equal((await getAdminPlayers(ctx,new URLSearchParams({search:"Ada"}),NOW)).rows.length,1);
 await assert.rejects(()=>getAdminPlayers(ctx,new URLSearchParams({page:"-1"}),NOW));await assert.rejects(()=>getAdminRounds(ctx,new URLSearchParams({status:"completed' OR 1=1"})));
});
test("rate limits are atomic, separate accounts and buckets, and recover in a new window",async()=>{
 const{db}=await setup();const results=await Promise.allSettled(Array.from({length:12},()=>enforceRateLimit(db,"player","write",5,NOW)));
 assert.equal(results.filter(r=>r.status==="fulfilled").length,5);assert.equal(results.filter(r=>r.status==="rejected").length,7);
 await enforceRateLimit(db,"owner","write",5,NOW);await enforceRateLimit(db,"player","read",5,NOW);await enforceRateLimit(db,"player","write",5,NOW+60000);
});
test("JSON parsing rejects over-limit streams before buffering them in full",async()=>{
 const chunks=[new Uint8Array(6000).fill(32),new Uint8Array(3000).fill(32)];let cancelled=false;
 const stream=new ReadableStream({start(c){for(const v of chunks)c.enqueue(v);},cancel(){cancelled=true;}});
 const request=new Request("https://arena.test/api",{method:"POST",headers:{"content-type":"application/json"},body:stream,duplex:"half"} as RequestInit);
 await assert.rejects(()=>readJson(request),(e:any)=>e.status===413);assert.equal(cancelled,true);
 for(const type of ["text/plain","text/plain; x=application/json"]){await assert.rejects(()=>readJson(new Request("https://arena.test/api",{method:"POST",headers:{"content-type":type},body:"{}"})),(e:any)=>e.status===415);}
 const utf8=new Request("https://arena.test/api",{method:"POST",headers:{"content-type":"application/json"},body:new Uint8Array([0xff,0xfe])});await assert.rejects(()=>readJson(utf8));
});
test("CSRF rejects foreign origins, missing-origin cross-site requests and unmarked admin writes",()=>{
 const req=(headers:Record<string,string>)=>new Request("https://arena.test/api",{method:"POST",headers});
 const bad:Record<string,string>[]=[{origin:"https://evil.test"},{origin:"null"},{"sec-fetch-site":"cross-site"},{"sec-fetch-site":"same-site"}];for(const h of bad)assert.throws(()=>assertWriteOrigin(req(h)));
 assert.doesNotThrow(()=>assertWriteOrigin(req({})));assert.throws(()=>assertWriteOrigin(req({origin:"https://arena.test"}),true));
 assert.doesNotThrow(()=>assertWriteOrigin(req({origin:"https://arena.test","x-arena-admin":"1"}),true));
});
test("strict action validation blocks forged identity, score, admin role and oversized answers",()=>{
 for(const body of [{action:"start",game:"math",mode:"ranked",userId:"owner"},{action:"answer",roundId:"x",index:0,answer:3,score:100},{action:"profile",name:"Ada",isAdmin:true},{action:"answer",roundId:"x",index:0,answer:"a".repeat(101)},{action:"answer",roundId:"x",index:1.5,answer:0}])assert.throws(()=>validateArenaBody(body));
 assert.doesNotThrow(()=>validateArenaBody({action:"answer",roundId:"x",index:0,answer:[1,2,3]}));
});
test("public leaderboard never exposes authentication IDs, including the viewer's",async()=>{
 const{db,sqlite}=await setup();await completed(db,sqlite);const dashboard=await getDashboard(db,"player",NOW+25000);
 assert.equal(dashboard.leaders[0].isMe,true);assert.equal(dashboard.leaders[0].id,"rank-1");assert.equal(JSON.stringify(dashboard.leaders).includes('"id":"player"'),false);
});
test("management responses prohibit caching and third-party framing; errors hide internals",async()=>{
 const response=protectResponse(new Request("https://arena.test/admin"),new Response("owner"));assert.equal(response.headers.get("cache-control"),"no-store, private");assert.ok(response.headers.get("content-security-policy")?.includes("frame-ancestors 'self' https://chatgpt.com"));
 assert.equal(response.headers.get("referrer-policy"),"no-referrer");const original=console.error;console.error=()=>{};try{const r=apiFailure(new Error("SELECT secret FROM api_keys"));assert.equal(r.status,500);assert.equal((await r.text()).includes("secret"),false);}finally{console.error=original;}
});
