import {ArenaError} from './arena-error.ts';
import type {FinanceEnv} from './finance.ts';
import {APP_VERSION,SITE_ORIGIN} from './release-config.ts';

export const SNAPSHOT_TABLES=['players','rounds','demo_placements','admin_settings','admin_audit','account_guardrails','competitions','competition_entrants','competition_answers','competition_stages','prize_awards','wallets','payout_methods','payout_requests','wallet_ledger','content_editions','question_reports','support_tickets','product_events','prize_reviews','ad_events'] as const;
export const MAX_SNAPSHOT_BYTES=1_800_000,MAX_TABLE_ROWS=1000,MAX_ENVELOPE_BYTES=2_500_000;
type Cell=string|number|null;
type Column={name:string;type:string;notnull:number;pk:number;dflt_value:Cell;cid:number};
export type RecoverySnapshot={format:'bilgiarena-recovery/v1';version:string;createdAt:number;schema:Record<string,Column[]>;tables:Record<string,Record<string,Cell>[]>};
const encoder=new TextEncoder();
const fail=(message='Yedek bütünlüğü doğrulanamadı.',status=422):never=>{throw new ArenaError(message,status);};
const identifier=(s:string)=>{if(!/^[a-z_][a-z0-9_]*$/.test(s))fail();return '"'+s+'"';};
function jsonObject(pairs:string[]){let out="'{}'";for(let i=0;i<pairs.length;i+=15)out='json_set('+out+','+pairs.slice(i,i+15).map(p=>"'$."+p.slice(1)).join(',')+')';return out;}

export async function digest(value:string|Uint8Array){const bytes=typeof value==='string'?encoder.encode(value):value;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource)),v=>v.toString(16).padStart(2,'0')).join('');}
export function validateSnapshot(value:unknown):asserts value is RecoverySnapshot{
 const s=value as RecoverySnapshot;
 if(!s||s.format!=='bilgiarena-recovery/v1'||typeof s.version!=='string'||s.version.length>40||!Number.isSafeInteger(s.createdAt)||!s.schema||!s.tables)fail();
 if(Object.keys(s.tables).sort().join()!==[...SNAPSHOT_TABLES].sort().join()||Object.keys(s.schema).sort().join()!==[...SNAPSHOT_TABLES].sort().join())fail();
 for(const table of SNAPSHOT_TABLES){const columns=s.schema[table],rows=s.tables[table];if(!Array.isArray(columns)||columns.length<1||columns.length>100||!Array.isArray(rows)||rows.length>MAX_TABLE_ROWS)fail();const names=columns.map(c=>c.name);if(new Set(names).size!==names.length)fail();for(const c of columns){identifier(c.name);if(!['TEXT','INTEGER'].includes(c.type)||![0,1].includes(c.notnull)||!Number.isSafeInteger(c.pk))fail();}for(const row of rows){if(!row||Array.isArray(row)||Object.keys(row).sort().join()!==[...names].sort().join())fail();for(const c of columns){const v=row[c.name];if(v===null){if(c.notnull)fail();}else if(c.type==='INTEGER'?!Number.isSafeInteger(v):typeof v!=='string')fail();}}}
 const totals=new Map<string,[number,number]>();
 for(const row of s.tables.wallet_ledger){const owner=String(row.owner_hash),a=totals.get(owner)||[0,0];a[0]+=Number(row.available_delta);a[1]+=Number(row.held_delta);if(!a.every(Number.isSafeInteger))fail();totals.set(owner,a);}
 const owners=new Set<string>();for(const row of s.tables.wallets){const owner=String(row.owner_hash),a=totals.get(owner)||[0,0];if(owners.has(owner)||row.available_kurus!==a[0]||row.held_kurus!==a[1]||['available_kurus','held_kurus','earned_kurus','paid_kurus'].some(k=>Number(row[k])<0))fail();owners.add(owner);}for(const owner of totals.keys())if(!owners.has(owner))fail();
}
/** All table contents are captured by ONE SQL statement. Size limits apply in
 * SQLite before JSON is returned to the Worker; an oversized backup fails closed.
 * Scalar metrics avoid workerd's compound-SELECT limit (unlike Node SQLite). */
export async function captureSnapshot(db:D1Database,now=Date.now()){
 const metadata=await db.batch(SNAPSHOT_TABLES.map(t=>db.prepare('PRAGMA table_info('+identifier(t)+')'))),schema:RecoverySnapshot['schema']={};
 const ctes:string[]=[],metrics:string[]=[],conditions:string[]=[],sizes:string[]=[],json:string[]=[];
 SNAPSHOT_TABLES.forEach((table,i)=>{const columns=metadata[i].results as unknown as Column[];if(!columns.length)fail();schema[table]=columns;const order=columns.filter(c=>c.pk).sort((a,b)=>a.pk-b.pk).map(c=>identifier(c.name)).join(',')||'rowid';ctes.push(`t${i} AS (SELECT ${jsonObject(columns.map(c=>"'"+c.name+"',"+identifier(c.name)))} row_json FROM ${identifier(table)} ORDER BY ${order} LIMIT ${MAX_TABLE_ROWS+1})`);metrics.push(`(SELECT COUNT(*) FROM t${i}) n${i},(SELECT COALESCE(SUM(length(CAST(row_json AS BLOB))),0) FROM t${i}) b${i}`);conditions.push(`n${i}<=${MAX_TABLE_ROWS}`);sizes.push(`b${i}`);json.push(`'${table}',json((SELECT json_group_array(json(row_json)) FROM t${i}))`);});
 const result=await db.prepare(`WITH ${ctes.join(',')}, metrics AS (SELECT ${metrics.join(',')}) SELECT CASE WHEN ${conditions.join(' AND ')} AND (${sizes.join('+')})<=${MAX_SNAPSHOT_BYTES-100000} THEN ${jsonObject(json)} ELSE NULL END tables_json FROM metrics`).first<{tables_json:string|null}>();
 if(!result?.tables_json)return fail('Yedek boyut sınırını aştı; daha büyük kapasiteye geçilmeli.',413);
 const s:RecoverySnapshot={format:'bilgiarena-recovery/v1',version:APP_VERSION,createdAt:now,schema,tables:JSON.parse(result.tables_json)};validateSnapshot(s);if(encoder.encode(JSON.stringify(s)).length>MAX_SNAPSHOT_BYTES)fail('Yedek boyut sınırını aştı.',413);return s;
}
function ring(env:FinanceEnv){try{const r=JSON.parse(env.ARENA_PAYOUT_KEYRING||'');if(!r.keys||typeof r.current!=='string'||!/^[-\w]{1,32}$/.test(r.current)||Object.keys(r.keys).length>5||atob(r.keys[r.current]).length!==32)throw 0;return r as {current:string;keys:Record<string,string>};}catch{throw new ArenaError('Yedek şifreleme anahtarı yapılandırılmadı.',503);}}
const unb64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function b64(bytes:Uint8Array){let out='';for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(out);}
async function keyFor(raw:string){const material=await crypto.subtle.importKey('raw',unb64(raw),'HKDF',false,['deriveKey']);return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:encoder.encode(SITE_ORIGIN),info:encoder.encode('bilgiarena:recovery:v1')},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
export async function sealSnapshot(env:FinanceEnv,id:string,snapshot:RecoverySnapshot){validateSnapshot(snapshot);const text=JSON.stringify(snapshot);if(encoder.encode(text).length>MAX_SNAPSHOT_BYTES)fail('Yedek boyut sınırını aştı.',413);const r=ring(env),header={format:'bilgiarena-encrypted-recovery/v1',id,createdAt:snapshot.createdAt,kid:r.current,origin:SITE_ORIGIN,contentSha256:await digest(text)},iv=crypto.getRandomValues(new Uint8Array(12)),key=await keyFor(r.keys[r.current]);const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(JSON.stringify(header))},key,encoder.encode(text));return JSON.stringify({header,iv:b64(iv),data:b64(new Uint8Array(data))});}
export async function openSnapshot(env:FinanceEnv,sealed:string,expectedId?:string){
 try{if(sealed.length>MAX_ENVELOPE_BYTES)throw 0;const v=JSON.parse(sealed),h=v.header,r=ring(env);if(h.format!=='bilgiarena-encrypted-recovery/v1'||h.origin!==SITE_ORIGIN||!/^backup_[a-f0-9]{32}$/.test(h.id)||(expectedId&&h.id!==expectedId)||!r.keys[h.kid]||unb64(v.iv).length!==12)throw 0;const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(v.iv),additionalData:encoder.encode(JSON.stringify(h))},await keyFor(r.keys[h.kid]),unb64(v.data));if(plain.byteLength>MAX_SNAPSHOT_BYTES)throw 0;const text=new TextDecoder('utf-8',{fatal:true}).decode(plain);if(await digest(text)!==h.contentSha256)throw 0;const s=JSON.parse(text);validateSnapshot(s);if(s.createdAt!==h.createdAt)throw 0;return{snapshot:s,contentSha256:h.contentSha256 as string};}catch{return fail();}
}
