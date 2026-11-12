import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../chatgpt-auth";
import {ArenaError} from "../../../lib/arena-error";
import {requireAppAccount} from "../../../lib/account-store";
import {apiResponse,apiFailure,assertWriteOrigin,enforceRateLimit,readJson,requireAdmin} from "../../../lib/arena-security";
import type {FinanceContext} from "../../../lib/finance";
export const dynamic="force-dynamic";
async function context(bucket:string,admin=false):Promise<FinanceContext>{const user=await getChatGPTUser();if(!user)throw new ArenaError("Önce giriş yap.",401);if(admin)requireAdmin(user,env);if(!env.DB)throw new ArenaError("Veritabanına ulaşılamıyor.",503);if(!admin)await requireAppAccount(env.DB,user);await enforceRateLimit(env.DB,user.userId,bucket,bucket.endsWith("read")?90:30);return{db:env.DB,user,env};}
import {competitions,competitionView,competitionMutation} from "../../../lib/competitions";
import {verifyRequest} from "../../../lib/play-integrity";
export async function GET(request:Request){try{const c=await context("competition-read"),p=new URL(request.url).searchParams;if([...p.keys()].some(k=>k!=="round")||p.getAll("round").length>1)throw new ArenaError("Geçersiz sorgu.");return apiResponse(p.has("round")?await competitionView(c,p.get("round")!):await competitions(c));}catch(e){return apiFailure(e,"competition");}}
export async function POST(request:Request){try{assertWriteOrigin(request);const{body,raw}=await readJson(request,4096);const c=await context("competition-write");if(!["contest-join","contest-answer","contest-interrupt"].includes(String(body.action)))throw new ArenaError("Geçersiz final işlemi.");await verifyRequest(c.db,c.user.userId,raw,request,c.env);return apiResponse(await competitionMutation(c,body));}catch(e){return apiFailure(e,"competition");}}
