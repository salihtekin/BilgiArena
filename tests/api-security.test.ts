import test from "node:test";
import assert from "node:assert/strict";
import {registerHooks} from "node:module";
import {existsSync,readFileSync} from "node:fs";
import {testStore} from "./test-db.ts";
import {registerAccount} from "../lib/account-store.ts";
import {POLICY_VERSION} from "../lib/release-config.ts";
import {ensurePlayer} from "../lib/arena-store.ts";
import type {ArenaIdentity} from "../lib/arena-security.ts";
const globals=globalThis as typeof globalThis&{__arenaEnv:Record<string,unknown>;__arenaUser:ArenaIdentity|null};
globals.__arenaEnv={};globals.__arenaUser=null;
// Route integration tests execute the actual handlers and D1 SQL. Only the
// platform identity/environment providers are replaced; the edge itself is not tested.
registerHooks({resolve(specifier,ctx,next){
 if(specifier.endsWith(".md?raw")&&ctx.parentURL){const value=readFileSync(new URL(specifier.slice(0,-4),ctx.parentURL),"utf8");return{url:`data:text/javascript,export default ${encodeURIComponent(JSON.stringify(value))}`,shortCircuit:true};}
 if(specifier==="cloudflare:workers")return{url:"data:text/javascript,export const env=globalThis.__arenaEnv",shortCircuit:true};
 if(specifier.endsWith("/chatgpt-auth"))return{url:"data:text/javascript,export async function getChatGPTUser(){return globalThis.__arenaUser}",shortCircuit:true};
 if(specifier.startsWith(".")&&ctx.parentURL?.startsWith("file:")){const url=new URL(specifier+".ts",ctx.parentURL);if(existsSync(url))return next(url.href,ctx);}
 return next(specifier,ctx);
}});
const arena=await import("../app/api/arena/route.ts"),admin=await import("../app/api/admin/route.ts");
const account=await import("../app/api/account/route.ts");
const report=await import("../app/api/admin/report/route.ts");
const BASE="https://arena.test",owner={userId:"owner",email:"owner@example.invalid",fullName:"Salih"},player={userId:"player",email:"player@example.invalid",fullName:"Ada"};
async function setup(user:ArenaIdentity|null=player){
 const result=testStore();for(const key of Object.keys(globals.__arenaEnv))delete globals.__arenaEnv[key];
 Object.assign(globals.__arenaEnv,{DB:result.db,ARENA_ADMIN_USER_IDS:owner.userId,ARENA_ADMIN_EMAILS:owner.email});globals.__arenaUser=user;
 await ensurePlayer(result.db,"owner","Salih");await ensurePlayer(result.db,"player","Ada");for(const user of [owner,player])await registerAccount(result.db,user,{action:"register",name:user.fullName,acceptTerms:true,acknowledgePrivacy:true,policyVersion:POLICY_VERSION});return result;
}
const request=(path:string,body?:unknown,extra:Record<string,string>={})=>new Request(BASE+path,{method:body===undefined?"GET":"POST",headers:body===undefined?extra:{"content-type":"application/json",origin:BASE,"x-arena-admin":"1",...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
test("unauthenticated spoofed identity headers do not grant API or admin access",async()=>{
 await setup(null);const headers={"oai-authenticated-user-id":"owner","oai-authenticated-user-email":owner.email,"x-role":"admin"};
 assert.equal((await arena.GET(request("/api/arena",undefined,headers))).status,401);assert.equal((await admin.GET(request("/api/admin",undefined,headers))).status,401);
});
test("all admin sections reject an ordinary signed-in player",async()=>{
 await setup();for(const section of ["overview","players","rounds","audit"]){const r=await admin.GET(request(`/api/admin?section=${section}`));assert.equal(r.status,403);assert.equal((await r.text()).includes("players"),false);}
 assert.equal((await admin.POST(request("/api/admin",{action:"settings",maintenance:true,disabledGames:[],revision:0,reason:"Yetkisiz ayar değiştirme denemesi"}))).status,403);
});
test("the owner can open each admin section without leaking answer storage",async()=>{
 await setup(owner);for(const section of ["overview","players","rounds","audit"]){const r=await admin.GET(request(`/api/admin?section=${section}`));assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"no-store, private");const raw=await r.text();assert.equal(raw.includes("questions_json"),false);assert.equal(raw.includes("SERVICE_ACCOUNT"),false);}
});
test("forged score and role fields are rejected by the actual gameplay route",async()=>{
 await setup();assert.equal((await arena.POST(request("/api/arena",{action:"start",game:"math",mode:"ranked",score:100}))).status,400);
 assert.equal((await arena.POST(request("/api/arena",{action:"profile",name:"Admin",role:"admin"}))).status,400);
 const r=await arena.GET(request("/api/arena"));assert.equal((await r.json() as any).canManage,false);
});
test("actual routes forbid cross-site JSON and fake JSON content types",async()=>{
 await setup(owner);const body={action:"profile",name:"Yeni Ad"};
 assert.equal((await arena.POST(request("/api/arena",body,{origin:"https://evil.test"}))).status,403);
 const r=new Request(BASE+"/api/arena",{method:"POST",headers:{"content-type":"application/json","sec-fetch-site":"cross-site"},body:JSON.stringify(body)});assert.equal((await arena.POST(r)).status,403);
 assert.equal((await arena.POST(request("/api/arena",body,{"content-type":"text/plain; fake=application/json"}))).status,415);
 const missingMarker=request("/api/admin",{action:"settings",reason:"CSRF denetim kontrolü"});missingMarker.headers.delete("x-arena-admin");assert.equal((await admin.POST(missingMarker)).status,403);
});
test("read, resume, answer, interrupt and abandon cannot target another player's round",async()=>{
 await setup();const start=await arena.POST(request("/api/arena",{action:"start",game:"math",mode:"ranked"}));assert.equal(start.status,200);const {id}=await start.json() as any;globals.__arenaUser=owner;
 assert.equal((await arena.GET(request(`/api/arena?round=${id}`))).status,404);
 for(const action of ["resume","answer","interrupt","abandon"]){const body={action,roundId:id,...(action==="answer"?{index:0,answer:1}:{}),...(action==="interrupt"?{index:0,reason:"background"}:{})};assert.equal((await arena.POST(request("/api/arena",body))).status,404,action);}
});
test("the actual start endpoint enforces the extra start rate limit",async()=>{
 await setup();for(let i=0;i<6;i++)assert.equal((await arena.POST(request("/api/arena",{action:"start",game:"math",mode:"practice"}))).status,200);
 const r=await arena.POST(request("/api/arena",{action:"start",game:"math",mode:"practice"}));assert.equal(r.status,429);assert.equal(r.headers.get("retry-after"),"60");
});
test("owner suspension immediately blocks a previously authenticated player's API session",async()=>{
 await setup(owner);const blocked=await admin.POST(request("/api/admin",{action:"player-status",userId:"player",status:"suspended",reason:"Doğrudan API erişimi incelemesi"}));assert.equal(blocked.status,200);globals.__arenaUser=player;
 assert.equal((await arena.GET(request("/api/arena"))).status,403);assert.equal((await arena.POST(request("/api/arena",{action:"start",game:"math",mode:"practice"}))).status,403);
});
test("interrupt cannot bypass required Play Integrity when a ranked question is active",async()=>{
 await setup();const start=await arena.POST(request("/api/arena",{action:"start",game:"math",mode:"ranked"}));const {id}=await start.json() as any;
 Object.assign(globals.__arenaEnv,{ARENA_INTEGRITY_REQUIRED:"true",PLAY_CLOUD_PROJECT_NUMBER:"123",PLAY_INTEGRITY_CERTIFICATES:"test-cert",PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON:"{}"});
 const r=await arena.POST(request("/api/arena",{action:"interrupt",roundId:id,index:0,reason:"background"}));assert.equal(r.status,428);assert.equal((await r.text()).includes("correctAnswer"),false);
});
test("oversized declared bodies and malformed requests fail before creating a round",async()=>{
 const{sqlite}=await setup();const huge=request("/api/arena",{action:"start",game:"math",mode:"ranked"},{"content-length":"9999999"});assert.equal((await arena.POST(huge)).status,413);
 const malformed=new Request(BASE+"/api/arena",{method:"POST",headers:{"content-type":"application/json",origin:BASE},body:"{not json}"});assert.equal((await arena.POST(malformed)).status,400);
 assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM rounds").get() as any).n,0);
});
test("the security report download also enforces owner authorization",async()=>{
 await setup();assert.equal((await report.GET()).status,403);globals.__arenaUser=null;assert.equal((await report.GET()).status,401);
 globals.__arenaUser=owner;const r=await report.GET();assert.equal(r.status,200);assert.equal(r.headers.get("content-type"),"text/markdown; charset=utf-8");assert.ok(r.headers.get("content-disposition")?.includes("attachment"));assert.equal(r.headers.get("cache-control"),"no-store, private");
});

test("account endpoint trusts provider identity and rejects spoofed account ownership",async()=>{
 await setup(null);assert.equal((await account.GET()).status,401);assert.equal((await account.POST(request("/api/account",{action:"delete",confirmed:true},{"oai-authenticated-user-id":"player"}))).status,401);
 await setup();assert.equal((await account.POST(request("/api/account",{action:"delete",confirmed:true,userId:"owner"}))).status,400);
});
test("first account visit creates no player until the registration endpoint receives explicit consent",async()=>{
 const{sqlite}=await setup();globals.__arenaUser={...player,userId:"new-visitor"};const state=await account.GET();assert.equal((await state.json() as any).state,"none");assert.equal((await arena.GET(request("/api/arena"))).status,428);assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM players WHERE id='new-visitor'").get() as any).n,0);
 const r=await account.POST(request("/api/account",{action:"register",name:"Yeni",policyVersion:POLICY_VERSION,acceptTerms:true,acknowledgePrivacy:true}));assert.equal(r.status,200);assert.equal((await arena.GET(request("/api/arena"))).status,200);
});
test("actual deletion API removes only the session owner and subsequent game access does not recreate it",async()=>{
 const{sqlite}=await setup();const r=await account.POST(request("/api/account",{action:"delete",confirmed:true}));assert.equal(r.status,200);assert.equal((await arena.GET(request("/api/arena"))).status,410);assert.equal((await account.GET()).headers.get("cache-control"),"no-store, private");assert.equal((await (await account.GET()).json() as any).state,"deleted");assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM players WHERE id='player'").get() as any).n,0);assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM players WHERE id='owner'").get() as any).n,1);
});
test("account writes reject cross-site and non-JSON deletion attempts",async()=>{
 await setup();const b={action:"delete",confirmed:true};assert.equal((await account.POST(request("/api/account",b,{origin:"https://evil.test"}))).status,403);assert.equal((await account.POST(request("/api/account",b,{"content-type":"text/plain"}))).status,415);assert.equal((await (await account.GET()).json() as any).state,"active");
});

const walletRoute=await import("../app/api/wallet/route.ts"),competitionRoute=await import("../app/api/competition/route.ts"),commerceRoute=await import("../app/api/admin/commerce/route.ts");
test("commerce routes require trusted authentication and never accept forged owner or cash flags",async()=>{
 await setup(null);for(const route of [walletRoute,competitionRoute,commerceRoute])assert.equal((await route.GET(request("/api/wallet",undefined,{"x-role":"admin","oai-authenticated-user-id":"owner"}))).status,401);
 await setup();assert.equal((await commerceRoute.GET(request("/api/admin/commerce?section=finance"))).status,403);assert.equal((await commerceRoute.POST(request("/api/admin/commerce",{action:"competition-create",role:"admin"}))).status,403);
 assert.equal((await walletRoute.POST(request("/api/wallet",{action:"request",amountKurus:100,ownerHash:"owner",idempotencyKey:"test-request-12345",confirmed:true}))).status,400);
 globals.__arenaUser=owner;const r=await commerceRoute.GET(request("/api/admin/commerce?section=finance"));assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"no-store, private");const value=await r.json() as any;assert.equal(value.readiness.enabled,false);assert.equal(value.adRevenue,null);
});
test("commerce routes enforce CSRF, bounded payloads and strict queries",async()=>{
 await setup(owner);for(const route of [walletRoute,competitionRoute,commerceRoute]){assert.equal((await route.POST(request("/api/wallet",{action:"cancel",id:"test"},{origin:"https://evil.test"}))).status,403);assert.equal((await route.POST(request("/api/wallet",{action:"cancel"},{"content-length":"300000"}))).status,413);}
 assert.equal((await walletRoute.GET(request("/api/wallet?userId=owner"))).status,400);assert.equal((await competitionRoute.GET(request("/api/competition?round=x&round=y"))).status,400);assert.equal((await commerceRoute.GET(request("/api/admin/commerce?section=finance&page=-1"))).status,400);
 const r=request("/api/admin/commerce",{action:"payout-reveal",id:"test",reason:"Test denetim gerekçesi"});r.headers.delete("x-arena-admin");assert.equal((await commerceRoute.POST(r)).status,403);
});
test("live join, answer and interruption cannot bypass required Play Integrity",async()=>{
 await setup();Object.assign(globals.__arenaEnv,{ARENA_INTEGRITY_REQUIRED:"true",PLAY_CLOUD_PROJECT_NUMBER:"123",PLAY_INTEGRITY_CERTIFICATES:"test-cert",PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON:"{}"});
 for(const action of ["contest-join","contest-answer","contest-interrupt"]){const r=await competitionRoute.POST(request("/api/competition",{action,roundId:"test",index:0,answer:0}));assert.equal(r.status,428);assert.equal((await r.text()).includes("correctAnswer"),false);}
});
test("wallet read limits and financial account consent are enforced by actual routes",async()=>{
 const{sqlite}=await setup();for(let i=0;i<90;i++)assert.equal((await walletRoute.GET(request("/api/wallet"))).status,200);assert.equal((await walletRoute.GET(request("/api/wallet"))).status,429);sqlite.prepare("UPDATE players SET policy_version='old' WHERE id='player'").run();assert.equal((await competitionRoute.GET(request("/api/competition"))).status,428);
});

const playerRoute=await import("../app/api/player/route.ts");
const{issueRoundAccess}=await import("../lib/round-access.ts");
const{startRound:ownedStart}=await import("../lib/arena-store.ts");
test("new player services reject cross-origin writes, unknown fields and unauthenticated reads",async()=>{await setup(null);assert.equal((await playerRoute.GET(request('/api/player'))).status,401);await setup();assert.equal((await playerRoute.POST(request('/api/player',{action:'analytics-consent',enabled:true},{origin:'https://evil.invalid'}))).status,403);assert.equal((await playerRoute.POST(request('/api/player',{action:'avatar',avatar:'mint',userId:'owner'}))).status,400);assert.equal((await playerRoute.GET(request('/api/player?page=0&page=1'))).status,400);});
test("round access capability reaches the real route but never bypasses answer attestation",async()=>{const f=await setup(),now=Date.now();const r=await ownedStart(f.db,player.userId,'math','ranked',now),token=await issueRoundAccess(f.db,player.userId,r.id,now);Object.assign(globals.__arenaEnv,{ARENA_INTEGRITY_REQUIRED:'true',PLAY_CLOUD_PROJECT_NUMBER:'12345',PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON:'{}',PLAY_INTEGRITY_CERTIFICATES:'test-only'});const headers={'x-arena-round-access':token!};assert.equal((await arena.POST(request('/api/arena',{action:'resume',roundId:r.id},headers))).status,200);assert.equal((await arena.POST(request('/api/arena',{action:'answer',roundId:r.id,index:0,answer:0},headers))).status,428);globals.__arenaUser=owner;assert.equal((await arena.POST(request('/api/arena',{action:'resume',roundId:r.id},headers))).status,404);assert.equal(f.sqlite.prepare('SELECT score FROM rounds WHERE id=?').get(r.id)?.score,0);});
test("content and service administration stay behind the owner allowlist",async()=>{await setup();for(const section of ['content','services'])assert.equal((await commerceRoute.GET(request('/api/admin/commerce?section='+section))).status,403);assert.equal((await commerceRoute.POST(request('/api/admin/commerce',{action:'maintenance-run'}))).status,403);});
const health=await import('../app/api/health/route.ts');
test('health checks new schema without exposing player data and fails closed on missing tables',async()=>{const f=await setup(null);const response=await health.GET(),value=await response.json() as any;assert.equal(response.status,200);assert.equal(value.ready,true);assert.deepEqual(Object.keys(value).sort(),['ready','version']);f.sqlite.exec('DROP TABLE ad_events');assert.equal((await health.GET()).status,503);});

const mcpRoute=await import('../app/mcp/route.ts');
function mcpRequest(name:string,args:Record<string,unknown>={}){return request('/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}});}
test('MCP requires trusted admin identity even when the caller forges owner headers',async()=>{await setup(null);const fake=mcpRequest('bilgiarena_operations_status');fake.headers.set('oai-authenticated-user-id','owner');fake.headers.set('oai-authenticated-user-email',owner.email);assert.equal((await mcpRoute.POST(fake)).status,401);await setup();assert.equal((await mcpRoute.POST(mcpRequest('bilgiarena_run_maintenance'))).status,403);});
test('MCP exposes static tools, rejects foreign origins and unsupported arguments',async()=>{await setup(owner);const listed=await mcpRoute.POST(request('/mcp',{jsonrpc:'2.0',id:1,method:'tools/list'}));const list=await listed.json() as any;assert.equal(list.result.tools.length,4);const badOrigin=mcpRequest('bilgiarena_run_maintenance');badOrigin.headers.set('origin','https://evil.test');assert.equal((await mcpRoute.POST(badOrigin)).status,403);const extra=await mcpRoute.POST(mcpRequest('bilgiarena_run_maintenance',{releaseAwards:true}));assert.equal((await extra.json() as any).result.isError,true);});
test('authenticated MCP maintenance persists and reads back its run without private player rows',async()=>{const{sqlite}=await setup(owner);const response=await mcpRoute.POST(mcpRequest('bilgiarena_run_maintenance'));const payload=await response.json() as any;assert.equal(payload.result.isError,false);const run=JSON.parse(payload.result.content[0].text).run;assert.equal(run.status,'succeeded');assert.equal(sqlite.prepare('SELECT status FROM operation_runs WHERE id=?').get(run.id)?.status,'succeeded');const state=await mcpRoute.POST(mcpRequest('bilgiarena_operations_status'));const raw=await state.text();assert.equal(raw.includes('questions_json'),false);assert.equal(raw.includes('encrypted_payee'),false);assert.equal(raw.includes('lease_token'),false);});

const mcpMeta={'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientInfo':{name:'fixture-client',version:'1'},'io.modelcontextprotocol/clientCapabilities':{},progressToken:'fixture-progress'};
test('MCP accepts protocol metadata and omitted empty arguments on the actual route',async()=>{await setup(owner);for(const args of [undefined,{}]){const r=await mcpRoute.POST(request('/mcp',{jsonrpc:'2.0',id:'metadata',method:'tools/call',params:{name:'bilgiarena_operations_status',...(args===undefined?{}:{arguments:args}),_meta:mcpMeta}}));assert.equal(r.status,200);const value=await r.json() as any;assert.equal(value.result.resultType,'complete');assert.equal(value.result.isError,false);assert.equal(JSON.parse(value.result.content[0].text).providerBackupVerified,false);}});
test('MCP metadata never grants an ordinary user administrative privileges',async()=>{await setup();const r=await mcpRoute.POST(request('/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'bilgiarena_run_maintenance',arguments:{},_meta:{...mcpMeta,userId:owner.userId,email:owner.email,role:'admin'}}}));assert.equal(r.status,403);});
test('MCP rejects malformed metadata and still rejects undeclared tool arguments',async()=>{await setup(owner);for(const metadata of [null,[],false,'admin']){const r=await mcpRoute.POST(request('/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'bilgiarena_operations_status',arguments:{},_meta:metadata}}));assert.equal((await r.json() as any).result.isError,true);}const r=await mcpRoute.POST(request('/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'bilgiarena_run_maintenance',arguments:{releaseAwards:true},_meta:mcpMeta}}));assert.equal((await r.json() as any).result.isError,true);});
test('health fails closed when the maintenance migration is unavailable',async()=>{const f=await setup(null);f.sqlite.exec('DROP TABLE operation_runs');assert.equal((await health.GET()).status,503);});
test('crash count telemetry remains opt-in, bounded and cleared on consent withdrawal',async()=>{const{sqlite}=await setup();const playerRoute=await import('../app/api/player/route.ts');const body={action:'event',event:'crash-recovered',game:'none',count:3};assert.equal((await playerRoute.POST(request('/api/player',body))).status,200);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM product_events').get()?.n,0);await playerRoute.POST(request('/api/player',{action:'analytics-consent',enabled:true}));assert.equal((await playerRoute.POST(request('/api/player',body))).status,200);assert.equal(sqlite.prepare("SELECT count FROM product_events WHERE event='crash-recovered'").get()?.count,3);assert.equal((await playerRoute.POST(request('/api/player',{...body,count:100}))).status,400);assert.equal((await playerRoute.POST(request('/api/player',{...body,stack:'private'}))).status,400);await playerRoute.POST(request('/api/player',{action:'analytics-consent',enabled:false}));assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM product_events').get()?.n,0);});
