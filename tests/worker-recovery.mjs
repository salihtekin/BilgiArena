// Exercise real workerd crypto, D1 and R2 locally with synthetic records only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {testStore} from './test-db.ts';
const require=createRequire(import.meta.url),wrangler=createRequire(require.resolve('wrangler'));
const {Miniflare}=wrangler('miniflare'),{build}=wrangler('esbuild');
const root=new URL('../',import.meta.url).pathname;
const entry=`import {runOperation,verifyBackup} from './lib/operations-store.ts';
export default {async fetch(request,env){try{const c={db:env.DB,user:{userId:'fixture-owner',email:'owner@example.invalid'},env};const first=await runOperation(c,'backup','mcp');const verified=await verifyBackup(c,first.run.id);return Response.json({first,verified});}catch(e){return Response.json({error:e.message}, {status:500});}}};`;
const bundle=await build({stdin:{contents:entry,resolveDir:root,sourcefile:'worker-recovery-fixture.ts',loader:'ts'},bundle:true,format:'esm',platform:'browser',write:false,target:'es2022'});
const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',d1Databases:['DB'],r2Buckets:['BUCKET'],d1Persist:false,r2Persist:false,bindings:{ARENA_ADMIN_USER_IDS:'fixture-owner',ARENA_ADMIN_EMAILS:'owner@example.invalid',ARENA_PAYOUT_KEYRING:JSON.stringify({current:'v1',keys:{v1:Buffer.alloc(32,107).toString('base64')}})}});
try{
 const db=await mf.getD1Database('DB');
 // SQLite has already parsed the actual migrations. Reuse whole final DDL
 // statements, including triggers with internal semicolons.
 const fixture=testStore();
 const schema=fixture.sqlite.prepare("SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END,rowid").all();
 for(const row of schema)await db.prepare(row.sql).run();
 fixture.sqlite.close();
 await db.prepare('INSERT INTO players(id,name,created_at) VALUES(?,?,?)').bind('fixture-player','Sentetik oyuncu',1).run();
 const response=await mf.dispatchFetch('https://fixture.invalid/backup'),body=await response.json();
 assert.equal(response.status,200,JSON.stringify(body));assert.equal(body.first.run.status,'succeeded');assert.equal(body.verified.readbackVerified,true);assert.equal(body.verified.rowCounts.players,1);
 const retry=await (await mf.dispatchFetch('https://fixture.invalid/backup')).json();assert.equal(retry.first.reused,true);
 const objects=await (await mf.getR2Bucket('BUCKET')).list();assert.equal(objects.objects.length,1);
 console.log('Worker recovery: real workerd crypto + D1 snapshot + R2 readback + retry passed.');
}finally{await mf.dispose();}
