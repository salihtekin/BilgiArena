import { TRIVIA, WORDS } from "./question-content.ts";
import type { GameId, Question } from "./game-types.ts";
export const ROUND_SIZE=10, QUESTION_SECONDS=15, DAILY_RANKED_LIMIT=3, POINTS_PER_CORRECT=10;
export const GAME_IDS:GameId[]=["reverse","word","memory","math","colors","trivia"];
export function questionSeconds(q:Question):10|15{return q.seconds||(q.prompt.length>65?15:10);}
export const FINAL_SURVIVORS=[200,130,85,55,36,23,15,10,6,3,1];
export function seededRandom(seed:string) {
 let value=2166136261;
 for(const char of seed) value=Math.imul(value^char.charCodeAt(0),16777619);
 return ()=>{value+=0x6d2b79f5;let n=Math.imul(value^(value>>>15),1|value);n^=n+Math.imul(n^(n>>>7),61|n);return ((n^(n>>>14))>>>0)/4294967296;};
}
export function shuffle<T>(values:T[],random:()=>number):T[]{const result=[...values];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
export function normalizeAnswer(input:string){return input.trim().toLocaleLowerCase("tr-TR").normalize("NFC");}
export function makeQuestions(game:GameId,seed:string,seen:string[]=[]):Question[]{
 const random=seededRandom(seed);
 if(game==="trivia")return shuffle(TRIVIA,random).sort((a,b)=>Number(seen.includes(a.id))-Number(seen.includes(b.id))).slice(0,ROUND_SIZE).map(q=>{
  const options=shuffle(q.choices.map((text,i)=>({text,correct:i===q.answer})),random);
  return {id:q.id,kind:"choice",category:q.category,prompt:q.prompt,seconds:q.prompt.length>65?15:10,options:options.map(o=>o.text),answer:options.findIndex(o=>o.correct),explanation:q.explanation};
 });
 if(game==="word"||game==="reverse")return shuffle(WORDS,random).sort((a,b)=>Number(seen.includes(a.id))-Number(seen.includes(b.id))).slice(0,ROUND_SIZE).map(q=>{
  const chars=[...q.word.toLocaleUpperCase("tr-TR")];let scrambled=shuffle(chars,random).join("");
  if(scrambled===chars.join(""))scrambled=chars.slice(1).concat(chars[0]).join("");
  return{id:q.id,kind:"word",category:game==="reverse"?"Ters Köşe":"Harf Harmanı",prompt:game==="reverse"?"Tersten yazılan kelimeyi bul.":q.hint,seconds:chars.length>7?15:10,scrambled:game==="reverse"?chars.reverse().join(""):scrambled,answer:normalizeAnswer(q.word),explanation:`Aranan kelime: ${q.word.toLocaleUpperCase("tr-TR")}.`};
 });
 if(game==="memory")return Array.from({length:ROUND_SIZE},(_,i)=>{
  const sequence=shuffle(Array.from({length:9},(_,j)=>j),random).slice(0,3+Math.floor(i/4));
  return{id:`memory-${i}-${Math.floor(random()*0x7fffffff).toString(36)}`,kind:"memory",category:"Hafıza İzi",prompt:"Işıkları izle, aynı sırayla dokun.",sequence,seconds:sequence.length>3?15:10,answer:sequence,explanation:`Sıra: ${sequence.map(n=>n+1).join(" → ")}.`};
 });
 if(game==="colors")return Array.from({length:ROUND_SIZE},(_,i)=>{
  const options=["Mavi","Kırmızı","Yeşil","Turuncu"],tones=["blue","red","green","orange"],answer=Math.floor(random()*4);
  const word=(answer+1+Math.floor(random()*3))%4;
  return{id:`colors-${i}-${Math.floor(random()*0x7fffffff).toString(36)}`,kind:"colors",category:"Renk Avı",prompt:options[word].toLocaleUpperCase("tr-TR"),ink:tones[answer],seconds:10,options,answer,explanation:`Yazının rengi: ${options[answer]}.`};
 });
 if(game!=="math")throw new Error("Geçersiz oyun.");
 return Array.from({length:ROUND_SIZE},(_,i)=>{
  const a=3+Math.floor(random()*19),b=2+Math.floor(random()*12),operation=i%4;
  let answer=0,prompt="",explanation="";
  if(operation===0){answer=b;prompt=`${a} + ? = ${a+b}`;explanation=`${a} + ${b} = ${a+b}.`;}
  if(operation===1){answer=b;prompt=`${a} × ? = ${a*b}`;explanation=`${a} × ${b} = ${a*b}.`;}
  if(operation===2){answer=a;prompt=`? ÷ ${b} = ${a}`;answer=a*b;explanation=`${answer} ÷ ${b} = ${a}.`;}
  if(operation===3){answer=a*2+b;prompt=`(${a} × 2) + ${b} = ?`;explanation=`Önce çarpma: ${a*2}. Sonra toplama: ${a*2} + ${b} = ${answer}.`;}
  return{id:`m-${i}-${Math.floor(random()*0x7fffffff).toString(36)}`,kind:"number",category:"Eksik Sayı",prompt,seconds:operation===0?10:15,answer:String(answer),explanation};
 });
}
export function isCorrect(q:Question,input:unknown){
 if(q.kind==="word")return typeof input==="string"&&normalizeAnswer(input)===q.answer;
 if(q.kind==="number")return (typeof input==="string"&&/^\d{1,4}$/.test(input.trim())||typeof input==="number"&&Number.isInteger(input))&&Number(input)===Number(q.answer);
 if(q.kind==="memory")return Array.isArray(input)&&Array.isArray(q.answer)&&input.length===q.answer.length&&input.every((v,i)=>Number.isInteger(v)&&v===(q.answer as number[])[i]);
 return typeof input==="number"&&Number.isInteger(input)&&input===q.answer;
}
export function publicAnswer(q:Question){return q.kind==="word"?String(q.answer).toLocaleUpperCase("tr-TR"):q.kind==="number"?String(q.answer):q.kind==="memory"?(q.answer as number[]).map(n=>n+1).join(" → "):q.options![Number(q.answer)];}
export function dayKey(now=Date.now()){return new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);}
export function seasonInfo(now=Date.now()){
 const day=new Date(`${dayKey(now)}T00:00:00Z`);day.setUTCDate(day.getUTCDate()-(day.getUTCDay()+6)%7);
 const key=day.toISOString().slice(0,10),sunday=new Date(day);sunday.setUTCDate(day.getUTCDate()+6);
 const formatter=new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"long",timeZone:"UTC"});
 return{key,label:`${day.getUTCDate()} – ${formatter.format(sunday)}`,finalAt:`${sunday.toISOString().slice(0,10)}T21:00:00+03:00`,closesAt:`${sunday.toISOString().slice(0,10)}T18:00:00+03:00`,timezone:"Europe/Istanbul"};
}

export const CONTENT_VERSION="2026-10-31";
/** The three daily rounds contain five stages of each game in total. Every player
 * has the same game/difficulty distribution for a slot, with independent variants. */
export function makeRankedQuestions(seed:string,slot:number,seen:string[]=[]):Question[]{
 return Array.from({length:10},(_,i)=>{const game=GAME_IDS[(Math.max(0,slot)%3*10+i)%6],q=makeQuestions(game,seed+":"+game,seen)[i];
 return {...q,game,contentVersion:CONTENT_VERSION,difficulty:1+Math.floor(i/4)};});
}
