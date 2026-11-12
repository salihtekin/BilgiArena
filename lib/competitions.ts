import {contentQuestions} from './content-store.ts';
import {REACHED_TOTAL_SQL,RANK_ORDER_SQL} from './ranking.ts';
import {ArenaError} from './arena-error.ts';
import {accountHash} from './account-store.ts';
import {requireAdmin,adminIds,exactKeys} from './arena-security.ts';
import {makeQuestions,isCorrect,publicAnswer,questionSeconds,seasonInfo} from './game-engine.ts';
import type {Question,GameId} from './game-types.ts';
import {cashReadiness,requireCash,reason,identifier,type FinanceContext} from './finance.ts';
export const COMPETITION_RULES='2026-10-31';
type Item={game:GameId;question:Question};
type Contest={id:string;week_key:string;kind:string;title:string;status:string;pool_kurus:number;winner_count:number;minimum_qualifiers:number;minimum_checkins:number;qualifies_at:number;checkin_at:number;starts_at:number;questions_json:string;processed_stages:number;revision:number;rules_version:string;reason:string|null};
type Entry={id:string;user_id:string|null;owner_hash:string;qualifier_rank:number;status:string;joined_at:number|null;correct:number;elapsed_ms:number};
const get=async(db:D1Database,id:string)=>{const c=await db.prepare('SELECT * FROM competitions WHERE id=?').bind(identifier(id)).first<Contest>();if(!c)throw new ArenaError('Yarışma bulunamadı.',404);return c;};
const own=async(c:FinanceContext,id:string)=>c.db.prepare('SELECT * FROM competition_entrants WHERE competition_id=? AND owner_hash=?').bind(id,await accountHash(c.user.userId)).first<Entry>();
async function pack(db:D1Database):Promise<Item[]>{const seed=crypto.randomUUID(),games:GameId[]=['memory','math','colors','trivia','word','reverse','memory','math','colors','trivia'];const items:Item[]=[];for(let i=0;i<10;i++)items.push({game:games[i],question:(await contentQuestions(db,games[i],seed+':'+i))[i]});return items;}
function timeline(c:Contest){let at=c.starts_at;return (JSON.parse(c.questions_json) as Item[]).map(item=>{const start=at,deadline=start+questionSeconds(item.question)*1000;at=deadline+5000;return{...item,start,deadline,nextAt:at};});}
const counts=async(db:D1Database,id:string)=>await db.prepare("SELECT COUNT(*) qualified,COALESCE(SUM(joined_at IS NOT NULL),0) checkedIn,COALESCE(SUM(status IN('playing','winner')),0) survivors FROM competition_entrants WHERE competition_id=?").bind(id).first<{qualified:number;checkedIn:number;survivors:number}>();
async function summary(ctx:FinanceContext,c:Contest,now:number){const e=await own(ctx,c.id),n=await counts(ctx.db,c.id);return{id:c.id,title:c.title,kind:c.kind,status:c.status,weekKey:c.week_key,poolKurus:c.pool_kurus,winnerCount:c.winner_count,minimumQualifiers:c.minimum_qualifiers,minimumCheckins:c.minimum_checkins,qualifierLimit:200,qualifiesAt:c.qualifies_at,checkinAt:c.checkin_at,startsAt:c.starts_at,revision:c.revision,reason:c.reason,rulesVersion:c.rules_version,...n,myRank:e?.qualifier_rank||null,myStatus:e?(e.joined_at&&e.status==='qualified'?'checked-in':e.status):'not-qualified',canJoin:c.status==='sealed'&&e?.status==='qualified'&&!e.joined_at&&now>=c.checkin_at&&now<c.starts_at,serverNow:now};}
async function seal(ctx:FinanceContext,c:Contest,now:number){
 const db=ctx.db,excluded=c.kind==='cash'?[...adminIds(ctx.env)]:[],where=excluded.length?`AND p.id NOT IN(${excluded.map(()=>'?').join(',')})`:'';
 const ranking=`SELECT p.id,p.owner_hash,SUM(r.score) score,${REACHED_TOTAL_SQL} completed FROM players p JOIN rounds r ON r.user_id=p.id WHERE p.status='active' AND r.week_key=? AND r.mode='ranked' AND r.status='completed' AND r.completed_at<? ${where} GROUP BY p.id HAVING SUM(r.score)>0 ORDER BY score DESC,completed ASC,p.id LIMIT 200`;
 const candidates=(await db.prepare(ranking).bind(c.week_key,c.qualifies_at,...excluded).all<{id:string;owner_hash:string|null}>()).results;
 // Hash only the current top 200. Never send internal identity or answers to other players.
 const missing=await Promise.all(candidates.filter(p=>!p.owner_hash).map(async p=>({id:p.id,hash:await accountHash(p.id)})));
 if(missing.length){const mapping=JSON.stringify(missing);await db.prepare("UPDATE players SET owner_hash=(SELECT json_extract(value,'$.hash') FROM json_each(?) WHERE json_extract(value,'$.id')=players.id) WHERE owner_hash IS NULL AND id IN(SELECT json_extract(value,'$.id') FROM json_each(?))").bind(mapping,mapping).run();}
 const token=crypto.randomUUID();await db.batch([
  db.prepare("INSERT INTO admin_audit SELECT ?,'system','competition-seal',?,'Haftalık sıralama sunucu saatinde donduruldu','{}','{}',? WHERE EXISTS(SELECT 1 FROM competitions WHERE id=? AND status='published' AND revision=?)").bind(token,c.id,now,c.id,c.revision),
  db.prepare(`INSERT INTO competition_entrants(id,competition_id,user_id,owner_hash,qualifier_rank,status,correct,elapsed_ms)
   SELECT ?||':'||rank,?,id,owner_hash,rank,'qualified',0,0 FROM (SELECT p.id,p.owner_hash,ROW_NUMBER() OVER(ORDER BY ${RANK_ORDER_SQL}) rank FROM players p JOIN rounds r ON r.user_id=p.id WHERE p.status='active' AND p.owner_hash IS NOT NULL AND r.week_key=? AND r.mode='ranked' AND r.status='completed' AND r.completed_at<? ${where} GROUP BY p.id HAVING SUM(r.score)>0 ORDER BY rank LIMIT 200) WHERE EXISTS(SELECT 1 FROM admin_audit WHERE id=?)`).bind(c.id,c.id,c.week_key,c.qualifies_at,...excluded,token),
  db.prepare("UPDATE competitions SET status=CASE WHEN (SELECT COUNT(*) FROM competition_entrants WHERE competition_id=?)>=minimum_qualifiers THEN 'sealed' ELSE 'cancelled' END,reason=CASE WHEN (SELECT COUNT(*) FROM competition_entrants WHERE competition_id=?)<minimum_qualifiers THEN 'Yeterli sayıda nitelikli oyuncu oluşmadı; ödüllü yarışma başlamadı.' ELSE NULL END,revision=revision+1 WHERE id=? AND status='published' AND revision=? AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)").bind(c.id,c.id,c.id,c.revision,token)
 ]);
}
async function start(ctx:FinanceContext,c:Contest,now:number){const db=ctx.db,token=crypto.randomUUID();await db.batch([
 db.prepare("INSERT INTO admin_audit SELECT ?,'system','competition-start',?,'Ortak final süresi başladı','{}','{}',? WHERE EXISTS(SELECT 1 FROM competitions WHERE id=? AND status='sealed' AND revision=?)").bind(token,c.id,now,c.id,c.revision),
 db.prepare("UPDATE competition_entrants SET status=CASE WHEN joined_at IS NOT NULL AND user_id IN(SELECT id FROM players WHERE status='active') THEN 'playing' ELSE 'absent' END WHERE competition_id=? AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)").bind(c.id,token),
 db.prepare("UPDATE competitions SET status=CASE WHEN (SELECT COUNT(*) FROM competition_entrants WHERE competition_id=? AND status='playing')>=minimum_checkins THEN 'running' ELSE 'cancelled' END,reason=CASE WHEN (SELECT COUNT(*) FROM competition_entrants WHERE competition_id=? AND status='playing')<minimum_checkins THEN 'Asgari katılım sağlanamadı; ödül dağıtılmadı.' ELSE NULL END,revision=revision+1 WHERE id=? AND status='sealed' AND revision=? AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)").bind(c.id,c.id,c.id,c.revision,token)
 ]);}
async function settle(ctx:FinanceContext,c:Contest,now:number){
 const db=ctx.db,i=c.processed_stages,q=timeline(c)[i],token=crypto.randomUUID(),sid=c.id+':'+i;
 // All state changes, awards and the stage nonce commit together. An overlapping
 // Worker cannot process the same stage or issue the same award twice.
 const guard='EXISTS(SELECT 1 FROM competition_stages WHERE id=? AND token=?)';
 const remaining="(SELECT COUNT(*) FROM competition_entrants WHERE competition_id=competitions.id AND status='playing')";
 await db.batch([
  db.prepare("INSERT OR IGNORE INTO competition_stages SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM competitions WHERE id=? AND status='running' AND processed_stages=? AND revision=?)").bind(sid,c.id,i,token,now,c.id,i,c.revision),
  db.prepare(`UPDATE competition_entrants SET correct=correct+COALESCE((SELECT correct FROM competition_answers WHERE entry_id=competition_entrants.id AND stage=?),0),elapsed_ms=elapsed_ms+COALESCE((SELECT elapsed_ms FROM competition_answers WHERE entry_id=competition_entrants.id AND stage=?),?) WHERE competition_id=? AND status='playing' AND ${guard}`).bind(i,i,q.deadline-q.start,c.id,sid,token),
  db.prepare(`UPDATE competition_entrants SET status='eliminated' WHERE competition_id=? AND status='playing' AND ${guard} AND (user_id IS NULL OR user_id NOT IN(SELECT id FROM players WHERE status='active') OR NOT EXISTS(SELECT 1 FROM competition_answers WHERE entry_id=competition_entrants.id AND stage=? AND interrupted=0) OR (EXISTS(SELECT 1 FROM competition_answers a JOIN competition_entrants e ON e.id=a.entry_id WHERE a.competition_id=? AND a.stage=? AND a.correct=1 AND e.status='playing') AND NOT EXISTS(SELECT 1 FROM competition_answers WHERE entry_id=competition_entrants.id AND stage=? AND correct=1)))`).bind(c.id,sid,token,i,c.id,i,i),
  db.prepare(`UPDATE competitions SET processed_stages=processed_stages+1,revision=revision+1,status=CASE WHEN ${remaining}=0 THEN 'cancelled' WHEN ${remaining}<=winner_count OR processed_stages=9 THEN 'review' ELSE 'running' END,reason=CASE WHEN ${remaining}=0 THEN 'Yanıt veren oyuncu kalmadı; ödül dağıtılmadı.' ELSE NULL END WHERE id=? AND status='running' AND processed_stages=? AND ${guard}`).bind(c.id,i,sid,token),
  db.prepare(`INSERT INTO prize_awards(id,competition_id,entry_id,owner_hash,amount_kurus,status,created_at)
   SELECT ?||':'||pos,?,id,owner_hash,CASE WHEN kind='rehearsal' THEN 0 ELSE CAST(pool_kurus/n AS INTEGER)+CASE WHEN pos<=pool_kurus%n THEN 1 ELSE 0 END END,CASE WHEN kind='rehearsal' THEN 'rehearsal' ELSE 'pending' END,? FROM (
    SELECT e.id,e.owner_hash,c.kind,c.pool_kurus,ROW_NUMBER() OVER(ORDER BY e.correct DESC,CASE WHEN c.rules_version='2026-10-21' THEN e.elapsed_ms ELSE 0 END,e.qualifier_rank) pos,MIN(c.winner_count,COUNT(*) OVER()) n FROM competition_entrants e JOIN competitions c ON c.id=e.competition_id WHERE c.id=? AND c.status='review' AND e.status='playing') WHERE pos<=n AND ${guard}`).bind(c.id,c.id,now,c.id,sid,token),
  db.prepare(`UPDATE competition_entrants SET status=CASE WHEN id IN(SELECT entry_id FROM prize_awards WHERE competition_id=?) THEN 'winner' ELSE 'finished' END WHERE competition_id=? AND status='playing' AND EXISTS(SELECT 1 FROM competitions WHERE id=? AND status='review') AND ${guard}`).bind(c.id,c.id,c.id,sid,token),
  db.prepare(`UPDATE competitions SET status='settled' WHERE id=? AND kind='rehearsal' AND status='review' AND ${guard}`).bind(c.id,sid,token)
 ]);
}
export async function advanceCompetition(ctx:FinanceContext,id:string,now=Date.now()){
 let c=await get(ctx.db,id);if(c.status==='published'&&now>=c.qualifies_at){await seal(ctx,c,now);c=await get(ctx.db,id);}if(c.status==='sealed'&&now>=c.starts_at){await start(ctx,c,now);c=await get(ctx.db,id);}for(let j=0;j<10&&c.status==='running'&&now>=timeline(c)[c.processed_stages].deadline;j++){await settle(ctx,c,now);c=await get(ctx.db,id);}return c;
}
export async function competitions(ctx:FinanceContext,now=Date.now()){
 const rows=(await ctx.db.prepare("SELECT id FROM competitions WHERE status<>'draft' ORDER BY starts_at DESC LIMIT 8").all<{id:string}>()).results;const list=[];for(const r of rows)list.push(await summary(ctx,await advanceCompetition(ctx,r.id,now),now));return{competitions:list,readiness:cashReadiness(ctx.env),rulesVersion:COMPETITION_RULES};
}
export async function competitionView(ctx:FinanceContext,id:string,now=Date.now()){
 const c=await advanceCompetition(ctx,id,now);if(c.status==='draft')throw new ArenaError('Yarışma bulunamadı.',404);const e=await own(ctx,id),s=await summary(ctx,c,now),items=timeline(c),i=Math.min(c.processed_stages,9);
 const base={liveCompetition:true,id,game:items[i].game,mode:'final',total:10,nextIndex:i,score:(e?.correct||0)*10,correct:e?.correct||0,serverNow:now,survivors:s.survivors,question:null as unknown,status:'active',phase:'lobby',competition:s,locked:false};
 const award=e?await ctx.db.prepare('SELECT amount_kurus,status FROM prize_awards WHERE entry_id=?').bind(e.id).first():null;
 // Only entrants who checked in can receive a current question. Future questions
 // and aggregate answer distributions never leave this module.
 if(c.processed_stages>0&&now<items[c.processed_stages-1].nextAt&&e?.joined_at){const previous=items[c.processed_stages-1],a=await ctx.db.prepare('SELECT * FROM competition_answers WHERE entry_id=? AND stage=?').bind(e.id,c.processed_stages-1).first<{correct:number;interrupted:number;elapsed_ms:number}>();return{...base,game:previous.game,phase:'reveal',nextIndex:c.processed_stages-1,nextAt:previous.nextAt,award,feedback:{index:c.processed_stages-1,correct:!!a?.correct,interrupted:!!a?.interrupted,timedOut:!a,correctAnswer:publicAnswer(previous.question),explanation:previous.question.explanation,points:a?.correct?10:0,elapsedMs:a?.elapsed_ms||previous.deadline-previous.start,adOpportunity:false}};}
 if(!['published','sealed','running'].includes(c.status)||e&&['eliminated','absent','withdrawn','finished','winner'].includes(e.status))return{...base,status:'completed',phase:'finished',award};
 if(c.status!=='running'||e?.status!=='playing'||!e.joined_at||now<items[i].start)return{...base,award};
 const q=items[i],{answer:_,explanation:__,...publicQ}=q.question;const answered=await ctx.db.prepare('SELECT id FROM competition_answers WHERE entry_id=? AND stage=?').bind(e.id,i).first();
 return{...base,phase:'question',question:{...publicQ,index:i,deadline:q.deadline,durationMs:q.deadline-q.start},locked:!!answered,revealAt:q.deadline,award};
}
export async function competitionMutation(ctx:FinanceContext,b:Record<string,unknown>,now=Date.now()){
 const id=identifier(b.roundId),c=await advanceCompetition(ctx,id,now),e=await own(ctx,id);
 if(b.action==='contest-join'){
  exactKeys(b,['action','roundId','rulesVersion','confirmed']);if(!e)throw new ArenaError('Bu haftanın ilk 200 listesinde değilsin.',403);if(b.confirmed!==true||b.rulesVersion!==c.rules_version)throw new ArenaError('Yayımlanan final kurallarını onayla.');if(c.kind==='cash')requireCash(ctx.env);if(c.status!=='sealed'||now<c.checkin_at||now>=c.starts_at)throw new ArenaError('Katılım penceresi açık değil.',409);
  await ctx.db.prepare("UPDATE competition_entrants SET joined_at=COALESCE(joined_at,?) WHERE id=? AND status='qualified'").bind(now,e.id).run();return competitionView(ctx,id,now);
 }
 exactKeys(b,b.action==='contest-interrupt'?['action','roundId','index','reason']:['action','roundId','index','answer']);
 if(!['contest-answer','contest-interrupt'].includes(String(b.action)))throw new ArenaError('Geçersiz final işlemi.');if(!e||!e.joined_at)throw new ArenaError('Yarışmaya katılımın yok.',403);
 if(c.status!=='running'||e.status!=='playing'||b.index!==c.processed_stages)throw new ArenaError('Bu aşama kapandı.',409);
 const i=c.processed_stages,q=timeline(c)[i],interrupted=b.action==='contest-interrupt';if(interrupted&&!['background','multi_window'].includes(String(b.reason)))throw new ArenaError('Geçersiz kesinti.');
 if(now<q.start||now>=q.deadline)throw new ArenaError('Yanıt süresi kapandı.',409);
 const a=b.answer;if(!interrupted&&!(a===null||typeof a==='string'&&a.length<=100||typeof a==='number'&&Number.isFinite(a)||Array.isArray(a)&&a.length<=9&&a.every(n=>Number.isInteger(n)&&n>=0&&n<=8)))throw new ArenaError('Geçersiz yanıt.');
 if(!interrupted&&a!==null&&q.question.kind==='memory'&&now-q.start<(q.question.sequence?.length||0)*700+450)throw new ArenaError('Hafıza gösterimi sürüyor.',409);
 const normal=!interrupted&&a!==null,correct=normal&&isCorrect(q.question,a);
 await ctx.db.prepare('INSERT OR IGNORE INTO competition_answers VALUES(?,?,?,?,?,?,?,?)').bind(e.id+':'+i,id,e.id,i,correct?1:0,normal?0:1,correct?now-q.start:q.deadline-q.start,now).run();
 return competitionView(ctx,id,now);
}
export async function adminCompetitions(ctx:FinanceContext,now=Date.now()){
 requireAdmin(ctx.user,ctx.env);const rows=(await ctx.db.prepare('SELECT id FROM competitions ORDER BY starts_at DESC LIMIT 30').all<{id:string}>()).results;const list=[];for(const r of rows){const c=await advanceCompetition(ctx,r.id,now);const awards=(await ctx.db.prepare('SELECT e.qualifier_rank,e.correct,e.elapsed_ms,e.user_id userId,p.name playerName,p.status playerStatus,a.id,a.amount_kurus,a.status,(SELECT decision FROM prize_reviews v WHERE v.award_id=a.id) reviewDecision,(SELECT evidence_ref FROM prize_reviews v WHERE v.award_id=a.id) evidenceRef FROM prize_awards a JOIN competition_entrants e ON e.id=a.entry_id LEFT JOIN players p ON p.id=e.user_id WHERE a.competition_id=? ORDER BY a.id').bind(c.id).all()).results;list.push({...await summary(ctx,c,now),awards});}return{competitions:list,readiness:cashReadiness(ctx.env)};
}
export async function adminCompetitionMutation(ctx:FinanceContext,b:Record<string,unknown>,now=Date.now()){
 requireAdmin(ctx.user,ctx.env);const why=reason(b.reason),db=ctx.db;
 if(b.action==='competition-create'){
  exactKeys(b,['action','title','weekKey','kind','poolKurus','winnerCount','minimumCheckins','startsAt','reason']);
  if(typeof b.title!=='string'||b.title.trim().length<3||b.title.length>80||/[<>\x00-\x1f]/.test(b.title))throw new ArenaError('Yarışma adı 3–80 karakter olmalı.');
  if(!['cash','rehearsal'].includes(String(b.kind))||![1,2].includes(Number(b.winnerCount))||!Number.isInteger(b.winnerCount)||!Number.isInteger(b.minimumCheckins)||Number(b.minimumCheckins)<2||Number(b.minimumCheckins)>200)throw new ArenaError('Geçersiz yarışma ayarı.');
  const cash=b.kind==='cash';if(cash&&b.minimumCheckins!==200)throw new ArenaError('Nakit final için odada 200 katılımcı gerekir. Küçük gruplar için nakitsiz prova oluştur.');if(Number(b.minimumCheckins)<=Number(b.winnerCount))throw new ArenaError('Asgari katılım kazanan sayısından fazla olmalı.');if(!Number.isSafeInteger(b.poolKurus)||Number(b.poolKurus)<(cash?100:0)||Number(b.poolKurus)>100000000||!cash&&b.poolKurus!==0)throw new ArenaError('Geçersiz ödül havuzu.');
  if(typeof b.weekKey!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.weekKey)||!Number.isFinite(Date.parse(b.weekKey+'T12:00:00+03:00'))||seasonInfo(Date.parse(b.weekKey+'T12:00:00+03:00')).key!==b.weekKey)throw new ArenaError('Hafta başlangıcı pazartesi olmalı.');
  const season=seasonInfo(Date.parse(b.weekKey+'T12:00:00+03:00')),start=cash?Date.parse(season.finalAt):Number(b.startsAt),cutoff=cash?Date.parse(season.closesAt):start-120000,checkin=cash?start-600000:start-60000;
  if(!Number.isSafeInteger(start)||cutoff<=now)throw new ArenaError('Yarışmayı sıralama kesiminden önce planla.');
  const id=crypto.randomUUID();await db.batch([
   db.prepare("INSERT INTO competitions(id,week_key,kind,title,status,pool_kurus,winner_count,minimum_qualifiers,minimum_checkins,qualifies_at,checkin_at,starts_at,questions_json,processed_stages,revision,created_at,rules_version) VALUES(?,?,?,?,'draft',?,?,?,?,?,?,?, ?,0,0,?,?)").bind(id,b.weekKey,b.kind,b.title.trim(),b.poolKurus,b.winnerCount,cash?200:2,b.minimumCheckins,cutoff,checkin,start,JSON.stringify(await pack(db)),now,COMPETITION_RULES),
   db.prepare("INSERT INTO admin_audit VALUES(?,?,'competition-create',?,?, '{}','{}',?)").bind(crypto.randomUUID(),ctx.user.userId,id,why,now)
  ]);return{id};
 }
 const id=identifier(b.id),c=await get(db,id),token=crypto.randomUUID();if(b.revision!==c.revision)throw new ArenaError('Yarışma değişmiş; yenile.',409);
 if(b.action==='competition-review-award'){
  exactKeys(b,['action','id','revision','awardId','decision','evidenceRef','identityReviewed','ageReviewed','duplicateReviewed','reason']);if(c.status!=='review'||c.kind!=='cash'||!['approve','hold'].includes(String(b.decision))||typeof b.evidenceRef!=='string'||!/^[a-zA-Z0-9._:/-]{6,100}$/.test(b.evidenceRef))throw new ArenaError('Geçerli ödül incelemesi ve kayıt referansı gerekli.');
  if(b.decision==='approve'&&(b.identityReviewed!==true||b.ageReviewed!==true||b.duplicateReviewed!==true))throw new ArenaError('Hesap sahipliği, 18 yaş ve çoklu hesap incelemesini tamamla.');
  const a=await db.prepare("SELECT id FROM prize_awards WHERE id=? AND competition_id=? AND status='pending'").bind(String(b.awardId),c.id).first();if(!a)throw new ArenaError('İncelenecek ödül bulunamadı.',404);
  await db.batch([db.prepare("INSERT INTO admin_audit VALUES(?,?,'award-review',?,?, '{}','{}',?)").bind(token,ctx.user.userId,String(b.awardId),why,now),db.prepare('INSERT INTO prize_reviews VALUES(?,?,?,?,?,?) ON CONFLICT(award_id) DO UPDATE SET decision=excluded.decision,evidence_ref=excluded.evidence_ref,note=excluded.note,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at').bind(String(b.awardId),b.decision,b.evidenceRef,why,ctx.user.userId,now)]);return{ok:true};
 }else if(b.action==='competition-publish'){
  exactKeys(b,['action','id','revision','reason','fundingConfirmed','fundingReference']);if(c.status!=='draft'||now>=c.qualifies_at)throw new ArenaError('Taslak artık yayımlanamaz.',409);if(c.kind==='cash'){if(c.minimum_checkins!==200)throw new ArenaError('Bu eski taslağı iptal edip 200 katılımcı şartıyla yeniden oluştur.');requireCash(ctx.env);if(b.fundingConfirmed!==true||typeof b.fundingReference!=='string'||b.fundingReference.trim().length<5||b.fundingReference.length>120)throw new ArenaError('Ödül bütçesini ayırdığını ve finansman kaydını onayla.');}
  await db.batch([
   db.prepare("INSERT INTO admin_audit SELECT ?,?,'competition-publish',?,?, '{}','{}',? WHERE EXISTS(SELECT 1 FROM competitions WHERE id=? AND status='draft' AND revision=?)").bind(token,ctx.user.userId,id,why,now,id,c.revision),
   db.prepare("UPDATE competitions SET status='published',revision=revision+1,funding_reference=? WHERE id=? AND status='draft' AND revision=? AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)").bind(c.kind==='cash'?String(b.fundingReference).trim():null,id,c.revision,token)
  ]);
 }else if(b.action==='competition-cancel'){
  exactKeys(b,['action','id','revision','reason']);if(['settled','cancelled'].includes(c.status))throw new ArenaError('Tamamlanmış yarışma değiştirilemez.',409);
  await db.batch([
   db.prepare("INSERT INTO admin_audit SELECT ?,?,'competition-cancel',?,?, '{}','{}',? WHERE EXISTS(SELECT 1 FROM competitions WHERE id=? AND revision=?)").bind(token,ctx.user.userId,id,why,now,id,c.revision),
   db.prepare("UPDATE competitions SET status='cancelled',reason=?,revision=revision+1 WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)").bind(why,id,c.revision,token),
   db.prepare("UPDATE prize_awards SET status='cancelled' WHERE competition_id=? AND status='pending' AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)").bind(id,token)
  ]);
 }else if(b.action==='competition-release'){
  exactKeys(b,['action','id','revision','reason']);if(c.status!=='review'||c.kind!=='cash')throw new ArenaError('İncelenecek nakit ödül bulunamadı.',409);if(await db.prepare("SELECT a.id FROM prize_awards a WHERE a.competition_id=? AND a.status='pending' AND NOT EXISTS(SELECT 1 FROM prize_reviews r WHERE r.award_id=a.id AND r.decision='approve')").bind(c.id).first())throw new ArenaError('Her kazanan için hesap sahipliği, yaş ve çoklu hesap incelemesini kaydet.',409);
  await db.batch([
   db.prepare("INSERT INTO admin_audit SELECT ?,?,'competition-release',?,?, '{}','{}',? WHERE EXISTS(SELECT 1 FROM competitions WHERE id=? AND status='review' AND revision=?)").bind(token,ctx.user.userId,id,why,now,id,c.revision),
   db.prepare("INSERT OR IGNORE INTO wallets(owner_hash,updated_at) SELECT owner_hash,? FROM prize_awards WHERE competition_id=? AND status='pending' AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)").bind(now,id,token),
   db.prepare("INSERT INTO wallet_ledger SELECT 'award:'||id,owner_hash,'award',id,amount_kurus,0,? FROM prize_awards WHERE competition_id=? AND status='pending' AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)").bind(now,id,token),
   db.prepare("UPDATE wallets SET available_kurus=available_kurus+(SELECT amount_kurus FROM prize_awards WHERE competition_id=? AND owner_hash=wallets.owner_hash AND status='pending'),earned_kurus=earned_kurus+(SELECT amount_kurus FROM prize_awards WHERE competition_id=? AND owner_hash=wallets.owner_hash AND status='pending'),updated_at=? WHERE owner_hash IN(SELECT owner_hash FROM prize_awards WHERE competition_id=? AND status='pending') AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)").bind(id,id,now,id,token),
   db.prepare("UPDATE prize_awards SET status='released' WHERE competition_id=? AND status='pending' AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)").bind(id,token),
   db.prepare("UPDATE competitions SET status='settled',revision=revision+1 WHERE id=? AND status='review' AND revision=? AND EXISTS(SELECT 1 FROM admin_audit WHERE id=?)").bind(id,c.revision,token)
  ]);
 }else throw new ArenaError('Geçersiz yarışma yönetimi.');
 if(!await db.prepare('SELECT id FROM admin_audit WHERE id=?').bind(token).first())throw new ArenaError('Yarışma başka işlemde değişti; yenile.',409);return{ok:true};
}
