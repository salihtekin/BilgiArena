import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../chatgpt-auth";
import {ArenaError} from "../../../lib/arena-error";
import {getAdminAudit,getAdminOverview,getAdminPlayers,getAdminRounds,mutateAdmin} from "../../../lib/arena-admin";
import {apiFailure,apiResponse,assertWriteOrigin,enforceRateLimit,readJson,requireAdmin} from "../../../lib/arena-security";
export const dynamic="force-dynamic";
async function context(bucket:string){
 const user=await getChatGPTUser();requireAdmin(user,env);
 if(!env.DB)throw new ArenaError("Yönetim veritabanına ulaşılamıyor.",503);
 await enforceRateLimit(env.DB,user.userId,bucket,bucket==="admin-read"?60:20);
 return{db:env.DB,user,env};
}
export async function GET(request:Request){try{
 const ctx=await context("admin-read"),params=new URL(request.url).searchParams;
 switch(params.get("section")||"overview"){
  case "overview":return apiResponse(await getAdminOverview(ctx));
  case "players":return apiResponse(await getAdminPlayers(ctx,params));
  case "rounds":return apiResponse(await getAdminRounds(ctx,params));
  case "audit":return apiResponse(await getAdminAudit(ctx,params));
  default:throw new ArenaError("Geçersiz yönetim bölümü.");
 }
}catch(error){return apiFailure(error,"admin");}}
export async function POST(request:Request){try{
 assertWriteOrigin(request,true);const ctx=await context("admin-write"),{body}=await readJson(request,4096);
 return apiResponse(await mutateAdmin(ctx,body));
}catch(error){return apiFailure(error,"admin");}}
