import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {requireAppAccount} from '../../../lib/account-store';
import {ArenaError} from '../../../lib/arena-error';
import {apiResponse,apiFailure,assertWriteOrigin,assertPlayerActive,enforceRateLimit,readJson} from '../../../lib/arena-security';
import {playerServices,playerMutation} from '../../../lib/player-services';
export const dynamic='force-dynamic';
async function context(write=false){const user=await getChatGPTUser();if(!user)throw new ArenaError('Önce hesabını bağla.',401);if(!env.DB)throw new ArenaError('Bağlantı kurulamadı.',503);await requireAppAccount(env.DB,user);await assertPlayerActive(env.DB,user.userId);await enforceRateLimit(env.DB,user.userId,write?'player-write':'player-read',write?30:60);return{db:env.DB,user,env};}
export async function GET(request:Request){try{const c=await context(),p=new URL(request.url).searchParams;if([...p.keys()].some(k=>k!=='page')||p.getAll('page').length>1||!/^\d{1,3}$/.test(p.get('page')||'0'))throw new ArenaError('Geçersiz sayfa.');return apiResponse(await playerServices(c,Number(p.get('page')||0)));}catch(e){return apiFailure(e);}}
export async function POST(request:Request){try{assertWriteOrigin(request);const {body}=await readJson(request,4096);return apiResponse(await playerMutation(await context(true),body));}catch(e){return apiFailure(e);}}
