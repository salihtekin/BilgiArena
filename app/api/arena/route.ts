import {issueRoundAccess,canReadRound} from "../../../lib/round-access";
import {env} from "cloudflare:workers";
import {requireAppAccount} from "../../../lib/account-store";
import {getChatGPTUser} from "../../chatgpt-auth";
import {ArenaError,abandonRound,ensurePlayer,getDashboard,getRound,nextQuestion,renamePlayer,roundView,startRound,submitAnswer} from "../../../lib/arena-store";
import type {GameId,RoundMode} from "../../../lib/game-types";
import {createChallenge,integrityStatus,verifyRequest} from "../../../lib/play-integrity";
import {adminIds,apiFailure,apiResponse,assertPlayerActive,assertWriteOrigin,enforceRateLimit,isAdmin,readJson,validateArenaBody} from "../../../lib/arena-security";
export const dynamic="force-dynamic";
async function context(bucket:string){
 const user=await getChatGPTUser();if(!user)throw new ArenaError("Devam etmek için giriş yapmalısın.",401);
 if(!env.DB)throw new ArenaError("Oyun veritabanı şu anda kullanılamıyor.",503);
 await enforceRateLimit(env.DB,user.userId,bucket,bucket==="read"?120:90);
 await requireAppAccount(env.DB,user);await assertPlayerActive(env.DB,user.userId);
 return{db:env.DB,userId:user.userId,user};
}
export async function GET(request:Request){try{
 const{db,userId,user}=await context("read"),params=new URL(request.url).searchParams,id=params.get("round");
 if([...params.keys()].some(k=>!["round","security"].includes(k)))throw new ArenaError("Geçersiz sorgu.");
 if(params.get("security")==="1")return apiResponse(integrityStatus(env));
 if(id){if(id.length>100)throw new ArenaError("Geçersiz tur.");const round=await getRound(db,userId,id);if(round.mode!=="practice"&&integrityStatus(env).integrityRequired)throw new ArenaError("Tura doğrulanmış Android uygulamasından devam etmelisin.",428);return apiResponse(roundView(round));}
 return apiResponse({...await getDashboard(db,userId,Date.now(),[...adminIds(env)]),canManage:isAdmin(user,env)});
}catch(error){return apiFailure(error);}}
export async function POST(request:Request){try{
 assertWriteOrigin(request);const{raw,body}=await readJson(request);validateArenaBody(body);
 const{db,userId}=await context("write");
 if(body.action==="integrity-challenge")return apiResponse(await createChallenge(db,userId,body.payload,env));
 if(body.action==="start"){await enforceRateLimit(db,userId,"start",6);if(body.mode!=="practice")await verifyRequest(db,userId,raw,request,env);const view=await startRound(db,userId,body.game as GameId,body.mode as RoundMode);return apiResponse({...view,...(body.mode!=="practice"&&integrityStatus(env).integrityRequired?{accessToken:await issueRoundAccess(db,userId,view.id)}:{})});}
 if(body.action==="profile"){await enforceRateLimit(db,userId,"profile",6);return apiResponse(await renamePlayer(db,userId,body.name));}
 const id=body.roundId as string;let access:string|undefined;
 if(["answer","next","resume","interrupt"].includes(String(body.action))){const round=await getRound(db,userId,id);if(round.mode!=="practice"){if(await canReadRound(db,userId,id,body.action,request.headers.get("x-arena-round-access")))access=request.headers.get("x-arena-round-access")!;else{await verifyRequest(db,userId,raw,request,env);if(["next","resume"].includes(String(body.action))&&integrityStatus(env).integrityRequired)access=await issueRoundAccess(db,userId,id);}}}
 if(body.action==="resume")return apiResponse({...roundView(await getRound(db,userId,id)),...(access?{accessToken:access}:{})});
 if(body.action==="interrupt"){const view=await submitAnswer(db,userId,id,body.index as number,null,Date.now(),true);return apiResponse({...view,question:null});}
 if(body.action==="answer")return apiResponse(await submitAnswer(db,userId,id,body.index as number,body.answer));
 if(body.action==="next")return apiResponse({...await nextQuestion(db,userId,id),...(access?{accessToken:access}:{})});
 if(body.action==="abandon")return apiResponse(await abandonRound(db,userId,id));
 throw new ArenaError("Geçersiz işlem.");
}catch(error){return apiFailure(error);}}
