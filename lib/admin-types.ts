import type {GameId} from "./game-types";
export type AdminSettings={maintenance:boolean;disabledGames:GameId[];revision:number;updatedAt:number};
export type AdminOverview={
 season:{key:string;label:string;finalAt:string;closesAt:string;timezone:string};settings:AdminSettings;
 totals:{players:number;suspended:number;weeklyPlayers:number;completed:number;active:number;voided:number;demoPlacements:number};
 days:{day:string;players:number;rounds:number}[];games:{game:GameId;rounds:number;score:number}[];
 leaders:{id:string;name:string;score:number;rank:number}[];
 security:{integrityRequired:boolean;integrityConfigured:boolean;realPrizeEnabled:boolean;rateLimitsEnabled:boolean};
 content:{trivia:number;words:number};finance:{revenue:number;paid:number;balance:number;connected:false};
};
export type AdminPlayer={id:string;name:string;status:string;createdAt:number;reason:string|null;rounds:number;weeklyScore:number};
export type AdminRound={id:string;userId:string;name:string;game:GameId;mode:string;status:string;score:number;correct:number;createdAt:number;completedAt:number|null;elapsedMs:number};
export type AdminAudit={id:string;actorId:string;action:string;targetId:string;reason:string;before:string;after:string;createdAt:number};
export type AdminPage<T>={rows:T[];page:number;hasMore:boolean};
