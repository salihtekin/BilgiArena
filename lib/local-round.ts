import {makeQuestions,isCorrect,publicAnswer,questionSeconds} from './game-engine.ts';
import type {GameId,Question,RoundView,AnswerFeedback} from './game-types.ts';
/** Guest exercises remain on this device and never enter the ranked API. */
export class LocalRound {
 readonly id='local:'+crypto.randomUUID();readonly mode='practice';private questions:Question[];private index=0;private score=0;private correct=0;private started:number|null;private feedback?:AnswerFeedback;private abandoned=false;
 readonly game:GameId;
 constructor(game:GameId,now=Date.now()){this.game=game;this.questions=makeQuestions(game,crypto.randomUUID());this.started=now;}
 view(now=Date.now()):RoundView{const q=this.started!==null&&!this.abandoned?this.questions[this.index]:null;let publicQ=null;if(q){const{answer:_,explanation:__,...rest}=q;publicQ={...rest,index:this.index,deadline:this.started!+questionSeconds(q)*1000,durationMs:questionSeconds(q)*1000};}return{id:this.id,game:this.game,mode:this.mode,total:10,nextIndex:this.index,score:this.score,correct:this.correct,status:this.abandoned?'abandoned':this.index>=10?'completed':'active',serverNow:now,survivors:0,question:publicQ,...(this.feedback?{feedback:this.feedback}:{})};}
 mutate(body:Record<string,unknown>,now=Date.now()){
 if(body.roundId!==this.id)throw new Error('Bu antrenman artık açık değil.');if(body.action==='abandon'){this.abandoned=true;this.started=null;return this.view(now);}if(body.action==='resume')return this.view(now);
 if(body.action==='next'){if(this.feedback){this.feedback=undefined;if(this.index<10)this.started=now;}return this.view(now);}
 if(!['answer','interrupt'].includes(String(body.action))||this.started===null||body.index!==this.index||this.index>=10)return this.view(now);
 const q=this.questions[this.index],elapsed=Math.max(0,now-this.started),interrupted=body.action==='interrupt';if(q.kind==='memory'&&!interrupted&&elapsed<(q.sequence?.length||0)*700+450)throw new Error('Önce ışıkları izle.');const timedOut=elapsed>=questionSeconds(q)*1000,correct=!interrupted&&!timedOut&&isCorrect(q,body.answer);this.feedback={index:this.index,correct,timedOut,interrupted,correctAnswer:publicAnswer(q),explanation:q.explanation,points:correct?10:0,elapsedMs:Math.min(elapsed,questionSeconds(q)*1000),adOpportunity:false};this.score+=this.feedback.points;this.correct+=Number(correct);this.index++;this.started=null;return this.view(now);
 }
}
