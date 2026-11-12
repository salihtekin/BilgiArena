export type GameId = "trivia" | "word" | "math" | "reverse" | "memory" | "colors" | "mixed";
export type RoundMode = "ranked" | "practice" | "final";
export type Question = { id:string; game?:GameId; contentVersion?:string; difficulty?:number; kind:"choice"|"word"|"number"|"memory"|"colors"; category:string; prompt:string; options?:string[]; scrambled?:string; sequence?:number[]; ink?:string; seconds?:10|15; answer:string|number|number[]; explanation:string };
export type PublicQuestion = Omit<Question,"answer"|"explanation"> & {index:number;deadline:number;durationMs:number};
export type AnswerFeedback = {index:number;correct:boolean;timedOut:boolean;interrupted?:boolean;correctAnswer:string;explanation:string;points:number;elapsedMs:number;adOpportunity:boolean;revealAt?:number};
export type RoundView = {id:string;game:GameId;mode:RoundMode;status:string;total:number;nextIndex:number;score:number;correct:number;serverNow:number;survivors:number;question:PublicQuestion|null;feedback?:AnswerFeedback;locked?:boolean;revealAt?:number};
export type Leader = {avatar?:string;id:string;name:string;score:number;correct:number;rank:number;isMe:boolean};
export type Dashboard = {
 canManage?:boolean;
 progress:{personalBest:number;todayCompleted:number;streak:number;cashRank:number|null;cashCutoffScore:number|null;pointsToFinal:number;isCashEligible:boolean;nextCompetition:{title:string;startsAt:number;checkinAt:number}|null};
 player:{name:string;initials:string;avatar?:string}; season:{key:string;label:string;finalAt:string;closesAt:string;timezone:string};
 weeklyScore:number;rank:number|null;finalists:number;totalPlayers:number;rankedRemaining:number;accuracy:number;completed:number;
 leaders:Leader[];daily:{day:string;label:string;score:number}[];
 history:{id:string;game:GameId;mode:RoundMode;score:number;correct:number;completedAt:number}[];
 pending:{id:string;game:GameId;mode:RoundMode}|null;
 metrics:{demoPlacements:number;realImpressions:number;revenue:number};
 wallet:{available:number;totalWon:number;paid:number;currency:"TRY";payoutsEnabled:false};
};
