import {env} from 'cloudflare:workers';
import {APP_VERSION} from '../../../lib/release-config';
export const dynamic='force-dynamic';
/** Schema readiness only; no player rows, identity, secrets or account configuration. */
export async function GET(){
 try{if(!env.DB)throw new Error('unavailable');await env.DB.prepare(`SELECT p.avatar,p.analytics_consent,c.rules_version,r.token_hash,e.version,s.reply,a.micros,v.decision,q.content_version,o.summary_json
 FROM players p LEFT JOIN competitions c ON 0 LEFT JOIN round_access r ON 0 LEFT JOIN content_editions e ON 0 LEFT JOIN support_tickets s ON 0 LEFT JOIN ad_events a ON 0 LEFT JOIN prize_reviews v ON 0 LEFT JOIN question_reports q ON 0 LEFT JOIN operation_runs o ON 0 WHERE 0`).all();return Response.json({version:APP_VERSION,ready:true},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({version:APP_VERSION,ready:false},{status:503,headers:{'Cache-Control':'no-store'}});}
}
