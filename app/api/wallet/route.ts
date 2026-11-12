import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../chatgpt-auth";
import {ArenaError} from "../../../lib/arena-error";
import {requireAppAccount} from "../../../lib/account-store";
import {apiResponse,apiFailure,assertWriteOrigin,enforceRateLimit,readJson,requireAdmin} from "../../../lib/arena-security";
import type {FinanceContext} from "../../../lib/finance";
export const dynamic="force-dynamic";
async function context(bucket:string,admin=false):Promise<FinanceContext>{const user=await getChatGPTUser();if(!user)throw new ArenaError("Önce giriş yap.",401);if(admin)requireAdmin(user,env);if(!env.DB)throw new ArenaError("Veritabanına ulaşılamıyor.",503);if(!admin)await requireAppAccount(env.DB,user);await enforceRateLimit(env.DB,user.userId,bucket,bucket.endsWith("read")?90:30);return{db:env.DB,user,env};}
import {wallet,walletMutation} from "../../../lib/finance";
export async function GET(request:Request){try{if(new URL(request.url).search)throw new ArenaError("Geçersiz sorgu.");return apiResponse(await wallet(await context("wallet-read")));}catch(e){return apiFailure(e,"wallet");}}
export async function POST(request:Request){try{assertWriteOrigin(request);const{body}=await readJson(request,4096);return apiResponse(await walletMutation(await context("wallet-write"),body));}catch(e){return apiFailure(e,"wallet");}}
