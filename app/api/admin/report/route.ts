import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../../chatgpt-auth";
import {apiFailure,enforceRateLimit,PRIVATE_HEADERS,requireAdmin} from "../../../../lib/arena-security";
import report from "../../../../reports/duzeltme-durumu-1.2.1.md?raw";
export const dynamic="force-dynamic";
export async function GET(){try{
 const user=await getChatGPTUser();requireAdmin(user,env);
 if(env.DB)await enforceRateLimit(env.DB,user.userId,"admin-read",60);
 return new Response(report,{headers:{...PRIVATE_HEADERS,"Content-Type":"text/markdown; charset=utf-8","Content-Disposition":"attachment; filename=BilgiArena-Duzeltme-Durumu-1.2.1.md"}});
}catch(error){return apiFailure(error,"admin_report");}}
