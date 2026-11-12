import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync,readdirSync} from "node:fs";
import {ensurePlayer,startRound,submitAnswer,nextQuestion,getRound,roundView,getDashboard,abandonRound,renamePlayer} from "../lib/arena-store.ts";
import {dayKey,seasonInfo,makeQuestions,normalizeAnswer,questionSeconds,GAME_IDS,isCorrect} from "../lib/game-engine.ts";
import {TRIVIA,WORDS} from "../lib/question-content.ts";
import type {GameId,Question,RoundMode} from "../lib/game-types.ts";
import {createChallenge,hash,integrityStatus,validateVerdict,verifyRequest,ANDROID_PACKAGE} from "../lib/play-integrity.ts";

import {MINIMUM_ANDROID_VERSION_CODE} from "../lib/release-config.ts";
const MONDAY=Date.parse("2026-10-19T09:00:00+03:00");
function store(){
 const sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON");
 for(const file of readdirSync(new URL("../drizzle/",import.meta.url)).filter(f=>f.endsWith(".sql")).sort())sqlite.exec(readFileSync(new URL(`../drizzle/${file}`,import.meta.url),"utf8"));
 function prepare(sql:string){let bindings:unknown[]=[];return{bind(...args:unknown[]){bindings=args;return this;},async first(){return sqlite.prepare(sql).get(...bindings as any[])||null;},async all(){return{results:sqlite.prepare(sql).all(...bindings as any[]),success:true,meta:{}};},async run(){const result=sqlite.prepare(sql).run(...bindings as any[]);return{success:true,results:[],meta:{changes:Number(result.changes)}};}};}
 return{db:{prepare} as unknown as D1Database,sqlite};
}
async function play(db:D1Database,sqlite:DatabaseSync,user:string,game:GameId,mode:RoundMode,now:number){
 let view=await startRound(db,user,game,mode,now);
 for(let i=0;i<10;i++){
  const stored=sqlite.prepare("SELECT questions_json FROM rounds WHERE id=?").get(view.id) as {questions_json:string};
  const q=(JSON.parse(stored.questions_json) as Question[])[i];
  now+=q.kind==="memory"?5000:900;view=await submitAnswer(db,user,view.id,i,q.answer,now);
  if(mode==="final"){now=Math.max(now,view.revealAt||now);view=roundView(await getRound(db,user,view.id,now),now);}
  if(i<9){now+=700;view=await nextQuestion(db,user,view.id,now);}
 }
 return{view,now};
}

test("six games produce valid deterministic ten-stage rounds with 10/15-second limits",()=>{
 assert.equal(TRIVIA.length,60);assert.equal(WORDS.length,80);assert.equal(new Set(TRIVIA.map(q=>q.id)).size,60);
 for(const item of TRIVIA){assert.equal(item.choices.length,4);assert.equal(new Set(item.choices).size,4);assert.ok(item.answer>=0&&item.answer<4);}
 for(const game of GAME_IDS){const qs=makeQuestions(game,"fixed-seed");assert.equal(qs.length,10);assert.deepEqual(qs,makeQuestions(game,"fixed-seed"));for(const q of qs){
  assert.ok([10,15].includes(questionSeconds(q)));assert.ok(isCorrect(q,q.answer));
  if(q.kind==="choice"||q.kind==="colors"){assert.equal(new Set(q.options).size,4);assert.ok(Number(q.answer)>=0&&Number(q.answer)<4);}
  if(q.kind==="word")assert.equal([...q.scrambled!].sort().join(""),[...String(q.answer).toLocaleUpperCase("tr-TR")].sort().join(""));
  if(q.kind==="memory"){assert.ok(q.sequence!.length>=3&&q.sequence!.length<=5);assert.ok(q.sequence!.every(n=>n>=0&&n<9));assert.equal(isCorrect(q,[...(q.answer as number[])].reverse()),false);}
 }}
 assert.equal(normalizeAnswer("  KÜTÜPHANE "),"kütüphane");
});

test("Istanbul calendar switches day and week at local midnight",()=>{
 assert.equal(dayKey(Date.parse("2026-10-18T20:59:59Z")),"2026-10-18");
 assert.equal(seasonInfo(Date.parse("2026-10-18T20:59:59Z")).key,"2026-10-12");
 assert.equal(seasonInfo(Date.parse("2026-10-18T21:00:00Z")).key,"2026-10-19");
});

test("public round state never contains answer keys, explanations or future questions",async()=>{
 const{db}=store();await ensurePlayer(db,"u1","Salih",MONDAY);
 const view=await startRound(db,"u1","trivia","ranked",MONDAY);
 assert.ok(view.question);assert.equal("answer" in view.question!,false);assert.equal("explanation" in view.question!,false);assert.equal("questions_json" in view,false);
 assert.equal(view.question?.index,0);assert.equal(view.total,10);
});

test("completed ranked round persists 100 points and records two demo opportunities, zero revenue",async()=>{
 const{db,sqlite}=store();await ensurePlayer(db,"u1","Salih",MONDAY);
 const{view,now}=await play(db,sqlite,"u1","trivia","ranked",MONDAY);
 assert.equal(view.score,100);assert.equal(view.status,"completed");assert.equal(view.correct,10);
 const dashboard=await getDashboard(db,"u1",now);
 assert.equal(dashboard.weeklyScore,100);assert.equal(dashboard.rank,1);assert.equal(dashboard.rankedRemaining,2);
 assert.equal(dashboard.metrics.demoPlacements,2);assert.equal(dashboard.metrics.realImpressions,0);assert.equal(dashboard.metrics.revenue,0);
});

test("answer retries and concurrent duplicate submissions do not double award points",async()=>{
 const{db,sqlite}=store();await ensurePlayer(db,"u1",null,MONDAY);
 const view=await startRound(db,"u1","math","ranked",MONDAY);
 const raw=sqlite.prepare("SELECT questions_json FROM rounds WHERE id=?").get(view.id) as {questions_json:string};
 const answer=(JSON.parse(raw.questions_json) as Question[])[0].answer;
 await Promise.all([submitAnswer(db,"u1",view.id,0,answer,MONDAY+1000),submitAnswer(db,"u1",view.id,0,answer,MONDAY+1000)]);
 const saved=await getRound(db,"u1",view.id,MONDAY+1100);assert.equal(saved.score,10);assert.equal(saved.next_index,1);
 await submitAnswer(db,"u1",view.id,0,answer,MONDAY+1200);assert.equal((await getRound(db,"u1",view.id,MONDAY+1200)).score,10);
});

test("server deadline rejects a correct answer sent late",async()=>{
 const{db,sqlite}=store();await ensurePlayer(db,"u1",null,MONDAY);
 const view=await startRound(db,"u1","math","ranked",MONDAY);
 const raw=sqlite.prepare("SELECT questions_json FROM rounds WHERE id=?").get(view.id) as {questions_json:string};
 const answer=(JSON.parse(raw.questions_json) as Question[])[0].answer;
 const result=await submitAnswer(db,"u1",view.id,0,answer,MONDAY+26000);
 assert.equal(result.feedback?.timedOut,true);assert.equal(result.score,0);
 const next=await nextQuestion(db,"u1",view.id,MONDAY+60000);assert.equal(next.question?.deadline,MONDAY+60000+next.question!.durationMs);
});

test("a user cannot read, answer or abandon another user's round",async()=>{
 const{db}=store();await ensurePlayer(db,"alice",null,MONDAY);await ensurePlayer(db,"bob",null,MONDAY);
 const view=await startRound(db,"alice","trivia","ranked",MONDAY);
 await assert.rejects(()=>getRound(db,"bob",view.id,MONDAY),/bulunamadı/);
 await assert.rejects(()=>submitAnswer(db,"bob",view.id,0,0,MONDAY+1000),/bulunamadı/);
 await assert.rejects(()=>abandonRound(db,"bob",view.id,MONDAY),/bulunamadı/);
});

test("three daily ranked starts are enforced while practice remains available",async()=>{
 const{db}=store();await ensurePlayer(db,"u1",null,MONDAY);
 for(let i=0;i<3;i++){const view=await startRound(db,"u1","trivia","ranked",MONDAY+i*2000);await abandonRound(db,"u1",view.id,MONDAY+i*2000+1000);}
 await assert.rejects(()=>startRound(db,"u1","trivia","ranked",MONDAY+10000),/3 puanlı/);
 const practice=await startRound(db,"u1","word","practice",MONDAY+10000);assert.equal(practice.mode,"practice");
});

test("simultaneous start retries resume one round instead of consuming multiple attempts",async()=>{
 const{db,sqlite}=store();await ensurePlayer(db,"u1",null,MONDAY);
 const views=await Promise.all(Array.from({length:5},()=>startRound(db,"u1","math","ranked",MONDAY)));
 assert.equal(new Set(views.map(v=>v.id)).size,1);assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM rounds").get() as {n:number}).n,1);
});

test("practice points and final simulations never enter the weekly cash qualification board",async()=>{
 const{db,sqlite}=store();await ensurePlayer(db,"u1",null,MONDAY);
 let done=await play(db,sqlite,"u1","word","practice",MONDAY);
 done=await play(db,sqlite,"u1","trivia","final",done.now+2000);
 assert.equal(done.view.survivors,1);assert.equal(done.view.score,100);
 const dash=await getDashboard(db,"u1",done.now);assert.equal(dash.weeklyScore,0);assert.equal(dash.leaders.length,0);assert.equal(dash.rankedRemaining,3);
});

test("one wrong final answer eliminates the player and issues no monetary reward",async()=>{
 const{db}=store();await ensurePlayer(db,"u1",null,MONDAY);const view=await startRound(db,"u1","trivia","final",MONDAY);
 let result=await submitAnswer(db,"u1",view.id,0,999,MONDAY+1000);assert.equal(result.locked,true);result=roundView(await getRound(db,"u1",view.id,view.question!.deadline),view.question!.deadline);assert.equal(result.status,"eliminated");assert.equal(result.score,0);assert.equal("payout" in result,false);
});

test("weekly cutoff rejects new ranked rounds and stops an unfinished ranked round",async()=>{
 const{db}=store();const before=Date.parse("2026-10-25T17:59:50+03:00"),after=Date.parse("2026-10-25T18:00:01+03:00");await ensurePlayer(db,"u1",null,before);
 const view=await startRound(db,"u1","math","ranked",before);await assert.rejects(()=>submitAnswer(db,"u1",view.id,0,0,after),/sona erdi/);
 await assert.rejects(()=>startRound(db,"u1","trivia","ranked",after),/kapandı/);
 assert.equal((await startRound(db,"u1","trivia","practice",after)).mode,"practice");
});

test("weekly reset clears the displayed score without deleting past rounds",async()=>{
 const{db,sqlite}=store();await ensurePlayer(db,"u1",null,MONDAY);await play(db,sqlite,"u1","trivia","ranked",MONDAY);
 const nextWeek=await getDashboard(db,"u1",MONDAY+7*86400000);assert.equal(nextWeek.weeklyScore,0);assert.equal(nextWeek.history.length,1);assert.equal(nextWeek.rankedRemaining,3);
});

test("profile validation rejects unsafe display names and preserves other players",async()=>{
 const{db}=store();await ensurePlayer(db,"u1","Salih",MONDAY);await ensurePlayer(db,"u2","Ada",MONDAY);
 await assert.rejects(()=>renamePlayer(db,"u1","<script>"),/2–24/);await renamePlayer(db,"u1","Salih T.");
 assert.equal((await getDashboard(db,"u1",MONDAY)).player.name,"Salih T.");assert.equal((await getDashboard(db,"u2",MONDAY)).player.name,"Ada");
});

test("a background interruption closes only the owned current question, is idempotent, and survives reload",async()=>{
 const{db}=store();await ensurePlayer(db,"u1",null,MONDAY);await ensurePlayer(db,"u2",null,MONDAY);
 const view=await startRound(db,"u1","trivia","ranked",MONDAY);
 await assert.rejects(()=>submitAnswer(db,"u2",view.id,0,null,MONDAY+1000,true),/bulunamadı/);
 const interrupted=await submitAnswer(db,"u1",view.id,0,null,MONDAY+1500,true);
 assert.equal(interrupted.feedback?.interrupted,true);assert.equal(interrupted.score,0);assert.equal(interrupted.nextIndex,1);assert.equal(interrupted.question,null);
 const reload=roundView(await getRound(db,"u1",view.id,MONDAY+2000),MONDAY+2000);assert.equal(reload.feedback?.interrupted,true);
 const retry=await submitAnswer(db,"u1",view.id,0,0,MONDAY+2000);assert.equal(retry.score,0);assert.equal(retry.feedback?.interrupted,true);
 const next=await nextQuestion(db,"u1",view.id,MONDAY+3000);assert.equal(next.question?.index,1);assert.equal(next.feedback,undefined);
});

test("the exact deadline is expired and a final interruption eliminates without awarding points",async()=>{
 const{db}=store();await ensurePlayer(db,"u1",null,MONDAY);
 let view=await startRound(db,"u1","math","ranked",MONDAY);
 view=await submitAnswer(db,"u1",view.id,0,null,view.question!.deadline);assert.equal(view.feedback?.timedOut,true);
 await abandonRound(db,"u1",view.id,MONDAY+26000);
 view=await startRound(db,"u1","trivia","final",MONDAY+27000);
 const close=view.question!.deadline;view=await submitAnswer(db,"u1",view.id,0,null,MONDAY+28000,true);assert.equal(view.locked,true);view=roundView(await getRound(db,"u1",view.id,close),close);assert.equal(view.status,"eliminated");assert.equal(view.score,0);
});

const integrityEnv={ARENA_INTEGRITY_REQUIRED:"true",PLAY_CLOUD_PROJECT_NUMBER:"123456789",PLAY_INTEGRITY_CERTIFICATES:"test-cert",PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON:"{}"};
function verdict(requestHash="hash") {return {requestDetails:{requestPackageName:ANDROID_PACKAGE,requestHash,timestampMillis:String(MONDAY)},appIntegrity:{appRecognitionVerdict:"PLAY_RECOGNIZED",packageName:ANDROID_PACKAGE,versionCode:String(MINIMUM_ANDROID_VERSION_CODE),certificateSha256Digest:["test-cert"]},deviceIntegrity:{deviceRecognitionVerdict:["MEETS_DEVICE_INTEGRITY"]},accountDetails:{appLicensingVerdict:"LICENSED"},environmentDetails:{appAccessRiskVerdict:{appsDetected:["KNOWN_INSTALLED","UNKNOWN_INSTALLED"]}}};}
const integrityPolicy={packageName:ANDROID_PACKAGE,certificates:["test-cert"]};

test("Play validation accepts verified apps, not client claims, and missing configuration stays closed",async()=>{
 assert.equal(integrityStatus({}).integrityRequired,false);assert.equal(integrityStatus(integrityEnv).realPrizeEnabled,false);
 validateVerdict(verdict(),"hash",integrityPolicy,MONDAY);
 for(const modify of [
  (v:ReturnType<typeof verdict>)=>v.requestDetails.requestHash="different",
  (v:ReturnType<typeof verdict>)=>v.requestDetails.requestPackageName="com.other",
  (v:ReturnType<typeof verdict>)=>v.requestDetails.timestampMillis=String(MONDAY-121000),
  (v:ReturnType<typeof verdict>)=>v.requestDetails.timestampMillis=String(MONDAY+11000),
  (v:ReturnType<typeof verdict>)=>v.appIntegrity.appRecognitionVerdict="UNRECOGNIZED_VERSION",
  (v:ReturnType<typeof verdict>)=>v.appIntegrity.certificateSha256Digest=["other"],
  (v:ReturnType<typeof verdict>)=>v.deviceIntegrity.deviceRecognitionVerdict=[],
  (v:ReturnType<typeof verdict>)=>v.accountDetails.appLicensingVerdict="UNLICENSED",
 ]){const v=verdict();modify(v);assert.throws(()=>validateVerdict(v,"hash",integrityPolicy,MONDAY));}
 const{db}=store();await ensurePlayer(db,"u1",null,MONDAY);
 await assert.rejects(()=>verifyRequest(db,"u1","{}",new Request("https://test/api"),{ARENA_INTEGRITY_REQUIRED:"true"},MONDAY),/yapılandırılmadı/);
 await assert.rejects(()=>verifyRequest(db,"u1",JSON.stringify({verified:true}),new Request("https://test/api"),integrityEnv,MONDAY),/doğrulanmış Android/);
});

test("capture, control and overlay risks are blocked; unavailable risk signals are not treated as safe",()=>{
 for(const risk of ["KNOWN_CAPTURING","UNKNOWN_CAPTURING","KNOWN_CONTROLLING","UNKNOWN_CONTROLLING","KNOWN_OVERLAYS","UNKNOWN_OVERLAYS"]){const v=verdict();v.environmentDetails.appAccessRiskVerdict.appsDetected=[risk];assert.throws(()=>validateVerdict(v,"hash",integrityPolicy,MONDAY),/uygulamayı kapat/);}
 const v=verdict();v.environmentDetails.appAccessRiskVerdict.appsDetected=[];assert.throws(()=>validateVerdict(v,"hash",integrityPolicy,MONDAY),/doğrulanamadı/);
});

test("challenges bind exact request bytes and the authenticated user, expire, and have a creation rate limit",async()=>{
 const{db,sqlite}=store();await ensurePlayer(db,"u1",null,MONDAY);await ensurePlayer(db,"u2",null,MONDAY);
 const raw=JSON.stringify({action:"start",game:"trivia",mode:"ranked"});
 const c=await createChallenge(db,"u1",raw,integrityEnv,MONDAY);
 const stored=sqlite.prepare("SELECT * FROM integrity_challenges WHERE id=?").get(c.id) as Record<string,unknown>;
 assert.equal(stored.user_id,"u1");assert.equal(stored.payload_hash,await hash(raw));assert.equal(c.requestHash,await hash(JSON.stringify(["bilgiarena:v1","u1",c.id,raw])));
 const request=new Request("https://test/api",{headers:{"X-Arena-Challenge":c.id,"X-Arena-Integrity-Token":"fake"}});
 await assert.rejects(()=>verifyRequest(db,"u2",raw,request,integrityEnv,MONDAY),/geçersiz/);
 await assert.rejects(()=>verifyRequest(db,"u1",raw+" ",request,integrityEnv,MONDAY),/geçersiz/);
 await assert.rejects(()=>verifyRequest(db,"u1",raw,request,integrityEnv,MONDAY+120000),/süresi dolmuş/);
 for(let i=1;i<40;i++)await createChallenge(db,"u1",raw,integrityEnv,MONDAY);
 await assert.rejects(()=>createChallenge(db,"u1",raw,integrityEnv,MONDAY),/Çok sık/);
 assert.ok((await createChallenge(db,"u2",raw,integrityEnv,MONDAY)).id);
});

test("server-side Google token exchange is required and a verified challenge is consumed exactly once",async()=>{
 const{db,sqlite}=store();await ensurePlayer(db,"u1",null,MONDAY);
 const pair=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
 const pkcs8=Buffer.from(await crypto.subtle.exportKey("pkcs8",pair.privateKey)).toString("base64");
 const env={...integrityEnv,PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON:JSON.stringify({client_email:"test@example.invalid",private_key:`-----BEGIN PRIVATE KEY-----\n${pkcs8}\n-----END PRIVATE KEY-----`})};
 const raw=JSON.stringify({action:"start",game:"math",mode:"ranked"}),c=await createChallenge(db,"u1",raw,env,MONDAY),original=globalThis.fetch;
 let oauth=0,decode=0;
 globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=String(input);
  if(url==="https://oauth2.googleapis.com/token"){oauth++;assert.ok(String(init?.body).includes("assertion="));return Response.json({access_token:"server-only-test-token",expires_in:3600});}
  assert.equal(url,`https://playintegrity.googleapis.com/v1/${ANDROID_PACKAGE}:decodeIntegrityToken`);decode++;
  assert.equal(new Headers(init?.headers).get("Authorization"),"Bearer server-only-test-token");assert.equal(JSON.parse(String(init?.body)).integrity_token,"opaque-play-token");
  return Response.json({tokenPayloadExternal:verdict(c.requestHash)});
 }) as typeof fetch;
 try{
  const request=new Request("https://test/api",{headers:{"X-Arena-Challenge":c.id,"X-Arena-Integrity-Token":"opaque-play-token"}});
  const results=await Promise.allSettled([verifyRequest(db,"u1",raw,request,env,MONDAY),verifyRequest(db,"u1",raw,request,env,MONDAY)]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.ok(oauth>=1);assert.ok(decode>=1);
  assert.equal((sqlite.prepare("SELECT consumed_at FROM integrity_challenges WHERE id=?").get(c.id) as {consumed_at:number}).consumed_at,MONDAY);
  await assert.rejects(()=>verifyRequest(db,"u1",raw,request,env,MONDAY),/geçersiz/);
 }finally{globalThis.fetch=original;}
});


test("final answers stay secret through retries, next requests and dashboard reads until the common deadline",async()=>{
 const{db,sqlite}=store();await ensurePlayer(db,"private","Oyuncu",MONDAY);
 const start=await startRound(db,"private","trivia","final",MONDAY),deadline=start.question!.deadline;
 const q=JSON.parse((sqlite.prepare("SELECT questions_json FROM rounds WHERE id=?").get(start.id) as {questions_json:string}).questions_json)[0] as Question;
 for(const view of [await submitAnswer(db,"private",start.id,0,q.answer,MONDAY+1000),await submitAnswer(db,"private",start.id,0,q.answer,MONDAY+2000),await nextQuestion(db,"private",start.id,MONDAY+3000)]){
  assert.equal(view.locked,true);assert.equal(view.feedback,undefined);assert.equal(view.score,0);assert.equal(view.correct,0);assert.equal(view.nextIndex,0);assert.equal(view.survivors,200);assert.equal(view.question!.deadline,deadline);assert.equal("answer" in view.question!,false);
 }
 const dashboard=await getDashboard(db,"private",deadline-1);assert.equal(dashboard.history.length,0);assert.equal(dashboard.pending?.id,start.id);assert.equal(dashboard.wallet.available,0);assert.equal(dashboard.wallet.payoutsEnabled,false);
 const after=roundView(await getRound(db,"private",start.id,deadline),deadline);assert.equal(after.feedback?.correct,true);assert.equal(after.score,10);assert.equal(after.survivors,130);
});

test("memory playback cannot be skipped by directly submitting the visible sequence",async()=>{
 const{db,sqlite}=store();await ensurePlayer(db,"m","Oyuncu",MONDAY);const start=await startRound(db,"m","memory","practice",MONDAY);
 const q=JSON.parse((sqlite.prepare("SELECT questions_json FROM rounds WHERE id=?").get(start.id) as {questions_json:string}).questions_json)[0] as Question;
 await assert.rejects(()=>submitAnswer(db,"m",start.id,0,q.answer,MONDAY+1000),/dizisini/);
 const valid=await submitAnswer(db,"m",start.id,0,q.answer,MONDAY+5000);assert.equal(valid.score,10);
});


test("every game completes a ranked round with server-owned scoring",async()=>{
 const{db,sqlite}=store();
 for(const game of GAME_IDS){await ensurePlayer(db,game,"Oyuncu",MONDAY);const{view}=await play(db,sqlite,game,game,"ranked",MONDAY);assert.equal(view.score,100,game);assert.equal(view.status,"completed",game);}
});
