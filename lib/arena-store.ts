import {contentQuestions} from "./content-store.ts";
import {productEvent} from "./player-services.ts";
import {REACHED_TOTAL_SQL} from "./ranking.ts";
import {accountHash} from "./account-store.ts";
import {makeRankedQuestions,CONTENT_VERSION,DAILY_RANKED_LIMIT,FINAL_SURVIVORS,POINTS_PER_CORRECT,GAME_IDS,dayKey,isCorrect,makeQuestions,publicAnswer,questionSeconds,seasonInfo} from "./game-engine.ts";
import type {AnswerFeedback,Dashboard,GameId,Question,RoundMode,RoundView} from "./game-types.ts";
import {ArenaError} from "./arena-error.ts";
import {assertPlayerActive} from "./arena-security.ts";
import {assertGameAvailable} from "./arena-admin.ts";
import {preservedRankedStarts} from "./account-store.ts";
export {ArenaError} from "./arena-error.ts";
type StoredRound={id:string;user_id:string;game:GameId;mode:RoundMode;week_key:string;day_key:string;questions_json:string;answers_json:string;next_index:number;score:number;correct:number;elapsed_ms:number;status:string;created_at:number;question_started_at:number|null;completed_at:number|null;expires_at:number};
export async function ensurePlayer(db:D1Database,userId:string,initialName:string|null,now=Date.now()){
 const clean=initialName?.replace(/[<>\u0000-\u001f\u202a-\u202e\u2066-\u2069]/g,"").trim();
 const name=(clean?.split(/\s+/)[0]||`Oyuncu ${userId.slice(-4).toUpperCase()}`).slice(0,24);
 await db.prepare("INSERT OR IGNORE INTO players (id, name, created_at) VALUES (?, ?, ?)").bind(userId,name,now).run();
 return db.prepare("SELECT id, name FROM players WHERE id = ?").bind(userId).first<{id:string;name:string}>();
}
export async function getRound(db:D1Database,userId:string,id:string,now=Date.now()){
 await assertPlayerActive(db,userId);
 let round=await db.prepare("SELECT * FROM rounds WHERE id = ? AND user_id = ?").bind(id,userId).first<StoredRound>();
 if(!round)throw new ArenaError("Bu tur bulunamadı.",404);
 if(round.status==="revealing"){
  const last=(JSON.parse(round.answers_json) as AnswerFeedback[]).at(-1);
  if(last&&now>=(last.revealAt||0)){
   const complete=round.next_index>=(JSON.parse(round.questions_json) as Question[]).length||!last.correct;
   const status=!last.correct?"eliminated":complete?"completed":"active";
   await db.prepare("UPDATE rounds SET status=?,completed_at=? WHERE id=? AND user_id=? AND status='revealing'").bind(status,complete?last.revealAt||now:null,id,userId).run();
   round=(await db.prepare("SELECT * FROM rounds WHERE id=? AND user_id=?").bind(id,userId).first<StoredRound>())!;
  }
 }
 if(["active","revealing"].includes(round.status)&&(round.expires_at<now||round.week_key!==seasonInfo(now).key||(round.mode==="ranked"&&now>=Date.parse(seasonInfo(now).closesAt)))){
  await db.prepare("UPDATE rounds SET status = 'expired', question_started_at = NULL WHERE id = ? AND user_id = ? AND status IN ('active','revealing')").bind(id,userId).run();
  round={...round,status:"expired",question_started_at:null};
 }
 return round;
}
export function roundView(round:StoredRound,now=Date.now()):RoundView{
 const questions=JSON.parse(round.questions_json) as Question[];
 const history=JSON.parse(round.answers_json) as AnswerFeedback[],last=history.at(-1);
 const locked=round.mode==="final"&&!!last?.revealAt&&now<last.revealAt;
 const index=locked?last!.index:round.next_index;
 const q=locked&&round.status!=="abandoned"?questions[index]:round.status==="active"&&round.question_started_at!==null?questions[index]:null;
 const question=q?{id:q.id,kind:q.kind,category:q.category,prompt:q.prompt,...(q.options?{options:q.options}:{}),...(q.scrambled?{scrambled:q.scrambled}:{}),...(q.sequence?{sequence:q.sequence}:{}),...(q.ink?{ink:q.ink}:{}),seconds:questionSeconds(q),durationMs:questionSeconds(q)*1000,index,deadline:locked?last!.revealAt!:round.question_started_at!+questionSeconds(q)*1000}:null;
 return{id:round.id,game:q?.game||round.game,mode:round.mode,status:locked&&round.status!=="abandoned"?"active":round.status,total:questions.length,nextIndex:index,score:round.score-(locked?last!.points:0),correct:round.correct-(locked?Number(last!.correct):0),serverNow:now,survivors:round.mode==="final"?FINAL_SURVIVORS[Math.min(index,10)]:0,question,...(locked?{locked:true,revealAt:last!.revealAt}:{}),...(!locked&&!question&&last&&last.index===round.next_index-1?{feedback:last}:{})};
}
export async function startRound(db:D1Database,userId:string,game:GameId,mode:RoundMode,now=Date.now()){
 if(!GAME_IDS.includes(game)||!["ranked","practice","final"].includes(mode))throw new ArenaError("Geçersiz oyun seçimi.");
 const season=seasonInfo(now),today=dayKey(now);if(mode==="final")game="trivia";
 await assertPlayerActive(db,userId);await assertGameAvailable(db,game);if(mode==="ranked")for(const g of GAME_IDS)await assertGameAvailable(db,g);
 if(mode==="ranked"&&now>=Date.parse(season.closesAt))throw new ArenaError("Bu haftanın puan toplama süresi kapandı. Antrenman yapabilirsin.",409);
 const existing=await db.prepare("SELECT * FROM rounds WHERE user_id = ? AND status IN ('active','revealing') AND expires_at > ? AND week_key = ? ORDER BY created_at DESC LIMIT 1").bind(userId,now,season.key).first<StoredRound>();
 const active=existing?await getRound(db,userId,existing.id,now):null;
 if(active&&["active","revealing"].includes(active.status)){if(active.mode===mode&&(mode==="ranked"||active.game===game))return roundView(active,now);throw new ArenaError("Devam eden bir turun var. Önce onu tamamla veya tur ekranından ayrıl.",409);}
 const recent=(await db.prepare("SELECT questions_json FROM rounds WHERE user_id=? ORDER BY created_at DESC LIMIT 8").bind(userId).all<{questions_json:string}>()).results.flatMap(r=>(JSON.parse(r.questions_json) as Question[]).map(q=>q.id));
 const preserved=await preservedRankedStarts(db,userId,now),used=await db.prepare("SELECT COUNT(*) n FROM rounds WHERE user_id=? AND day_key=? AND mode='ranked'").bind(userId,today).first<{n:number}>();
 const id=crypto.randomUUID(),seed=crypto.randomUUID(),questions=mode==="ranked"?makeRankedQuestions(seed,(used?.n||0)+preserved,recent):await contentQuestions(db,game,seed,recent);if(mode==="ranked"){const banks=new Map<GameId,Question[]>();for(const g of GAME_IDS)banks.set(g,await contentQuestions(db,g,seed+":"+g,recent));const selected=new Set<string>();for(let i=0;i<questions.length;i++){const bank=banks.get(questions[i].game!)!,candidate=bank[i];questions[i]=!selected.has(candidate.id)?candidate:bank.find(q=>!selected.has(q.id))||candidate;selected.add(questions[i].id);}game="mixed";}
 const inserted=await db.prepare(`INSERT INTO rounds (id,user_id,game,mode,week_key,day_key,questions_json,answers_json,next_index,score,correct,elapsed_ms,status,created_at,question_started_at,completed_at,expires_at)
  SELECT ?,?,?,?,?,?,?,'[]',0,0,0,0,'active',?,?,NULL,?
  WHERE NOT EXISTS (SELECT 1 FROM rounds WHERE user_id = ? AND status IN ('active','revealing') AND expires_at > ? AND week_key = ?)
  AND (? <> 'ranked' OR (SELECT COUNT(*) FROM rounds WHERE user_id = ? AND day_key = ? AND mode = 'ranked') < ?) RETURNING *`)
  .bind(id,userId,game,mode,season.key,today,JSON.stringify(questions),now,now,now+45*60*1000,userId,now,season.key,mode,userId,today,Math.max(0,DAILY_RANKED_LIMIT-preserved)).first<StoredRound>();
 if(!inserted){const pending=await db.prepare("SELECT * FROM rounds WHERE user_id=? AND status IN ('active','revealing') AND expires_at>? AND week_key=? ORDER BY created_at DESC LIMIT 1").bind(userId,now,season.key).first<StoredRound>();if(pending){if(pending.mode===mode&&(mode==="ranked"||pending.game===game))return roundView(pending,now);throw new ArenaError("Devam eden bir turun var. Önce onu tamamla.",409);}throw new ArenaError("Bugünkü 3 puanlı tur hakkını kullandın. Antrenmanda sınırsız oynayabilirsin.",409);}
 await productEvent(db,userId,"round-start",game,now);return roundView(inserted,now);
}
export async function submitAnswer(db:D1Database,userId:string,id:string,index:number,input:unknown,now=Date.now(),interrupted=false){
 const round=await getRound(db,userId,id,now);
 if(!Number.isInteger(index)||index<0||index>=10)throw new ArenaError("Geçersiz soru.");
 const history=JSON.parse(round.answers_json) as AnswerFeedback[],recorded=history.find(a=>a.index===index);
 if(recorded)return roundView(round,now);
 if(round.status!=="active")throw new ArenaError("Bu tur sona erdi.",409);
 if(index!==round.next_index||round.question_started_at===null)throw new ArenaError("Sorunun sırası değişti. Turu yeniden aç.",409);
 const questions=JSON.parse(round.questions_json) as Question[],q=questions[index];
 if(q.kind==="memory"&&!interrupted&&now-round.question_started_at<(q.sequence?.length||0)*700+450)throw new ArenaError("Önce ışık dizisini izlemelisin.",409);
 const duration=questionSeconds(q)*1000,deadline=round.question_started_at+duration;
 const timedOut=now>=deadline,correct=!timedOut&&!interrupted&&isCorrect(q,input);
 const elapsedMs=Math.min(duration,Math.max(0,now-round.question_started_at)),nextIndex=index+1;
 const eliminated=round.mode==="final"&&!correct,complete=nextIndex===questions.length||eliminated;
 const feedback:AnswerFeedback={index,correct,timedOut,...(interrupted?{interrupted:true}:{}),correctAnswer:publicAnswer(q),explanation:q.explanation,points:correct?POINTS_PER_CORRECT:0,elapsedMs,adOpportunity:round.mode!=="final"&&(nextIndex%5===0||complete),...(round.mode==="final"?{revealAt:deadline}:{})};
 const awaiting=round.mode==="final"&&now<deadline;
 const result=await db.prepare(`UPDATE rounds SET answers_json = ?,next_index = ?,score = ?,correct = ?,elapsed_ms = ?,question_started_at = NULL,status = ?,completed_at = ?
  WHERE id = ? AND user_id = ? AND next_index = ? AND status = 'active' RETURNING *`)
  .bind(JSON.stringify([...history,feedback]),nextIndex,round.score+feedback.points,round.correct+Number(correct),round.elapsed_ms+elapsedMs,awaiting?"revealing":eliminated?"eliminated":complete?"completed":"active",!awaiting&&complete?now:null,id,userId,index).first<StoredRound>();
 if(!result){const latest=await getRound(db,userId,id,now),previous=(JSON.parse(latest.answers_json) as AnswerFeedback[]).find(a=>a.index===index);if(previous)return roundView(latest,now);throw new ArenaError("Yanıt işlenemedi. Yeniden dene.",409);}
 if(complete&&result.status==="completed")await productEvent(db,userId,"round-complete",round.game,now);
 if(feedback.adOpportunity)await db.prepare("INSERT OR IGNORE INTO demo_placements (id,user_id,round_id,week_key,created_at) VALUES (?,?,?,?,?)").bind(`${id}:${index}`,userId,id,round.week_key,now).run();
 return roundView(result,now);
}
export async function nextQuestion(db:D1Database,userId:string,id:string,now=Date.now()){
 const round=await getRound(db,userId,id,now);if(round.status!=="active")return roundView(round,now);
 if(round.question_started_at===null)await db.prepare("UPDATE rounds SET question_started_at = ? WHERE id = ? AND user_id = ? AND next_index = ? AND status = 'active' AND question_started_at IS NULL").bind(now,id,userId,round.next_index).run();
 return roundView(await getRound(db,userId,id,now),now);
}
export async function abandonRound(db:D1Database,userId:string,id:string,now=Date.now()){await getRound(db,userId,id,now);await db.prepare("UPDATE rounds SET status = 'abandoned',question_started_at = NULL WHERE id = ? AND user_id = ? AND status IN ('active','revealing')").bind(id,userId).run();return{ok:true};}
export async function renamePlayer(db:D1Database,userId:string,name:unknown){await assertPlayerActive(db,userId);if(typeof name!=="string"||name.trim().length<2||name.trim().length>24||/[<>\u0000-\u001f\u202a-\u202e\u2066-\u2069]/.test(name))throw new ArenaError("Oyuncu adı 2–24 karakter olmalı.");await db.prepare("UPDATE players SET name = ? WHERE id = ?").bind(name.trim(),userId).run();return{ok:true};}
export async function getDashboard(db:D1Database,userId:string,now=Date.now(),excludedAdmins:string[]=[]):Promise<Dashboard>{
 await assertPlayerActive(db,userId);
 const season=seasonInfo(now),today=dayKey(now);
 const waiting=await db.prepare("SELECT id FROM rounds WHERE user_id=? AND status='revealing' LIMIT 1").bind(userId).first<{id:string}>();
 if(waiting)await getRound(db,userId,waiting.id,now);
 await db.prepare("UPDATE rounds SET status = 'expired',question_started_at = NULL WHERE user_id = ? AND status IN ('active','revealing') AND (expires_at < ? OR week_key <> ? OR (mode='ranked' AND ? >= ?))").bind(userId,now,season.key,now,Date.parse(season.closesAt)).run();
 const ranked=`WITH totals AS (SELECT p.id,p.name,p.avatar,SUM(r.score) score,SUM(r.correct) correct,${REACHED_TOTAL_SQL} last_completed FROM players p JOIN rounds r ON r.user_id=p.id WHERE p.status='active' AND r.week_key=? AND r.mode='ranked' AND r.status='completed' GROUP BY p.id HAVING SUM(r.score)>0),board AS (SELECT *,ROW_NUMBER() OVER(ORDER BY score DESC,last_completed ASC,id ASC) rank FROM totals)`;
 const [player,leaders,myRank,participants,dailyCount,aggregate,dailyRows,history,pending,placements]=await Promise.all([
  db.prepare("SELECT name,avatar FROM players WHERE id=?").bind(userId).first<{name:string;avatar:string}>(),
  db.prepare(`${ranked} SELECT id,name,avatar,score,correct,rank FROM board ORDER BY rank LIMIT 200`).bind(season.key).all<{id:string;name:string;avatar:string;score:number;correct:number;rank:number}>(),
  db.prepare(`${ranked} SELECT rank,score FROM board WHERE id=?`).bind(season.key,userId).first<{rank:number;score:number}>(),
  db.prepare("SELECT COUNT(DISTINCT r.user_id) count FROM rounds r JOIN players p ON p.id=r.user_id WHERE p.status='active' AND r.week_key=? AND r.mode='ranked' AND r.status='completed'").bind(season.key).first<{count:number}>(),
  db.prepare("SELECT COUNT(*) count FROM rounds WHERE user_id=? AND day_key=? AND mode='ranked'").bind(userId,today).first<{count:number}>(),
  db.prepare("SELECT COUNT(*) completed,COALESCE(SUM(correct),0) correct,COALESCE(SUM(next_index),0) answered FROM rounds WHERE user_id=? AND week_key=? AND status='completed' AND mode<>'final'").bind(userId,season.key).first<{completed:number;correct:number;answered:number}>(),
  db.prepare("SELECT day_key day,SUM(score) score FROM rounds WHERE user_id=? AND week_key=? AND mode='ranked' AND status='completed' GROUP BY day_key").bind(userId,season.key).all<{day:string;score:number}>(),
  db.prepare("SELECT id,game,mode,score,correct,completed_at completedAt FROM rounds WHERE user_id=? AND status IN ('completed','eliminated') ORDER BY completed_at DESC LIMIT 6").bind(userId).all<Dashboard["history"][number]>(),
  db.prepare("SELECT id,game,mode FROM rounds WHERE user_id=? AND status IN ('active','revealing') ORDER BY created_at DESC LIMIT 1").bind(userId).first<{id:string;game:GameId;mode:RoundMode}>(),
  db.prepare("SELECT COUNT(*) count FROM demo_placements WHERE user_id=? AND week_key=?").bind(userId,season.key).first<{count:number}>(),
 ]);
 const excluded=excludedAdmins.length?`AND p.id NOT IN(${excludedAdmins.map(()=>'?').join(',')})`:'';
 const cashBoard=ranked.replace("GROUP BY p.id HAVING",`${excluded} GROUP BY p.id HAVING`);
 const [cashMe,cutoff,personal,days,nextFinal,cashCount]=await Promise.all([
  db.prepare(`${cashBoard} SELECT rank FROM board WHERE id=?`).bind(season.key,...excludedAdmins,userId).first<{rank:number}>(),
  db.prepare(`${cashBoard} SELECT score FROM board WHERE rank=200`).bind(season.key,...excludedAdmins).first<{score:number}>(),
  db.prepare("SELECT COALESCE(MAX(score),0) best,COALESCE(SUM(day_key=?),0) today FROM rounds WHERE user_id=? AND status='completed' AND mode='ranked'").bind(today,userId).first<{best:number;today:number}>(),
  db.prepare("SELECT DISTINCT day_key day FROM rounds WHERE user_id=? AND status='completed' AND mode='ranked' ORDER BY day_key DESC LIMIT 366").bind(userId).all<{day:string}>(),
  db.prepare("SELECT title,starts_at startsAt,checkin_at checkinAt FROM competitions WHERE status IN('published','sealed') AND starts_at>? ORDER BY starts_at LIMIT 1").bind(now).first<{title:string;startsAt:number;checkinAt:number}>(),
  db.prepare(`${cashBoard} SELECT COUNT(*) n FROM board`).bind(season.key,...excludedAdmins).first<{n:number}>(),
 ]);
 let streak=0,cursor=new Date(today+'T12:00:00Z');if(days.results[0]?.day!==today)cursor.setUTCDate(cursor.getUTCDate()-1);for(const row of days.results){if(row.day!==cursor.toISOString().slice(0,10))break;streak++;cursor.setUTCDate(cursor.getUTCDate()-1);}
 const progress={personalBest:personal?.best||0,todayCompleted:personal?.today||0,streak,cashRank:cashMe?.rank||null,cashCutoffScore:cutoff?.score??null,pointsToFinal:cashMe&&cashMe.rank<=200?0:cutoff?Math.max(0,Math.ceil((cutoff.score-(myRank?.score||0)+1)/POINTS_PER_CORRECT)*POINTS_PER_CORRECT):0,isCashEligible:!excludedAdmins.includes(userId),nextCompetition:nextFinal};
 const funds=await db.prepare("SELECT available_kurus,earned_kurus,paid_kurus FROM wallets WHERE owner_hash=?").bind(await accountHash(userId)).first<{available_kurus:number;earned_kurus:number;paid_kurus:number}>();
 const name=player?.name||"Oyuncu",labels=["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];
 const daily=labels.map((label,i)=>{const d=new Date(`${season.key}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+i);const day=d.toISOString().slice(0,10);return{day,label,score:dailyRows.results.find(v=>v.day===day)?.score||0};});
 return{progress,player:{name,avatar:player?.avatar||"mint",initials:name.split(/\s+/).slice(0,2).map(s=>s[0]).join("").toLocaleUpperCase("tr-TR")},season,weeklyScore:myRank?.score||0,rank:myRank?.rank||null,finalists:Math.min(200,cashCount?.n||0),totalPlayers:participants?.count||0,rankedRemaining:Math.max(0,DAILY_RANKED_LIMIT-(dailyCount?.count||0)-await preservedRankedStarts(db,userId,now)),accuracy:aggregate?.answered?Math.round(aggregate.correct/aggregate.answered*100):0,completed:aggregate?.completed||0,leaders:leaders.results.map(v=>({...v,id:`rank-${v.rank}`,isMe:v.id===userId})),daily,history:history.results,pending,metrics:{demoPlacements:placements?.count||0,realImpressions:0,revenue:0},wallet:{available:(funds?.available_kurus||0)/100,totalWon:(funds?.earned_kurus||0)/100,paid:(funds?.paid_kurus||0)/100,currency:"TRY",payoutsEnabled:false}};
}
