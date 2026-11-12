import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../chatgpt-auth";
import {ArenaError} from "../../../lib/arena-error";
import {accountStatus,registerAccount,deleteAccount} from "../../../lib/account-store";
import {apiFailure,apiResponse,assertWriteOrigin,enforceRateLimit,isAdmin,readJson} from "../../../lib/arena-security";
export const dynamic="force-dynamic";
async function context(){const user=await getChatGPTUser();if(!user)throw new ArenaError("Devam etmek için giriş yapmalısın.",401);if(!env.DB)throw new ArenaError("Veritabanı kullanılamıyor.",503);await env.DB.prepare("DELETE FROM account_guardrails WHERE expires_at<=?").bind(Date.now()).run();return{db:env.DB,user};}
export async function GET(){try{const{db,user}=await context();await enforceRateLimit(db,user.userId,"account-read",60);return apiResponse({...await accountStatus(db,user),canManage:isAdmin(user,env)});}catch(e){return apiFailure(e);}}
export async function POST(request:Request){try{assertWriteOrigin(request);const{body}=await readJson(request);const{db,user}=await context();await enforceRateLimit(db,user.userId,"account-write",6);if(body.action==="register")return apiResponse(await registerAccount(db,user,body));if(body.action==="delete")return apiResponse(await deleteAccount(db,user,body));throw new ArenaError("Geçersiz hesap işlemi.");}catch(e){return apiFailure(e);}}
