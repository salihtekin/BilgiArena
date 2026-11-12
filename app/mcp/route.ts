import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../chatgpt-auth';
import {ArenaError} from '../../lib/arena-error';
import {readJson,exactKeys,requireAdmin,enforceRateLimit,PRIVATE_HEADERS} from '../../lib/arena-security';
import {operationsOverview,runOperation,verifyBackup} from '../../lib/operations-store';
export const dynamic='force-dynamic';
const noArgs={type:'object',properties:{},additionalProperties:false};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const tools=[
 {name:'bilgiarena_operations_status',description:'Yalnız yöneticinin bakım geçmişi ve şifreli uygulama yedeği durumunu özetler. Oyuncu kayıtlarını veya anahtarları döndürmez.',inputSchema:noArgs},
 {name:'bilgiarena_run_maintenance',description:'Yetkili, tekrar çalıştırma korumalı bakım: vadesi gelen final durumları ve süreli kayıtlar. Banka havalesi veya ödül serbest bırakma yapmaz.',inputSchema:noArgs},
 {name:'bilgiarena_create_backup',description:'Bugünün sınırlı uygulama yedeğini şifreleyip depoya yazar ve geri okuyarak doğrular. Canlı geri yükleme yapmaz.',inputSchema:noArgs},
 {name:'bilgiarena_verify_backup',description:'Kaydedilmiş şifreli yedeği yeniden okuyup bütünlüğünü doğrular; yalnız kayıt sayıları döndürür.',inputSchema:{type:'object',properties:{id:{type:'string',pattern:'^backup_[a-f0-9]{32}$'}},required:['id'],additionalProperties:false}},
];
export async function POST(request:Request){let id:unknown=null;const reply=(result:Record<string,unknown>,status=200)=>Response.json({jsonrpc:'2.0',id,result:{resultType:'complete',...result}},{status,headers:PRIVATE_HEADERS});
 try{const origin=request.headers.get('origin');if(origin&&![new URL(request.url).origin,'https://chatgpt.com'].includes(origin))throw new ArenaError('İstek kaynağı kabul edilmedi.',403);const {body}=await readJson(request);exactKeys(body,['jsonrpc','id','method','params']);id=body.id;if(body.jsonrpc!=='2.0'||!(typeof id==='string'||typeof id==='number'&&Number.isSafeInteger(id))||typeof body.method!=='string')throw new ArenaError('Geçersiz araç isteği.');
  if(body.method==='server/discover')return reply({supportedVersions:['2026-07-28'],capabilities:{tools:{}}});
  if(body.method==='tools/list')return reply({tools});
  if(body.method!=='tools/call')return Response.json({jsonrpc:'2.0',id,error:{code:-32601,message:'Yöntem bulunamadı.'}},{status:400,headers:PRIVATE_HEADERS});
  const user=await getChatGPTUser();requireAdmin(user,env);if(!env.DB)throw new ArenaError('Veritabanına ulaşılamıyor.',503);await enforceRateLimit(env.DB,user.userId,'operations-mcp',20);
  const params=body.params;if(!object(params))throw new ArenaError('Geçersiz araç parametresi.');exactKeys(params,['name','arguments','_meta']);
  // MCP request metadata is separate from tool arguments. It is untrusted and
  // never supplies identity, admin scope or a tool's business parameters.
  if(params._meta!==undefined&&!object(params._meta))throw new ArenaError('Geçersiz MCP ek bilgisi.');
  const args=params.arguments===undefined?{}:params.arguments;if(!object(args))throw new ArenaError('Araç argümanları nesne olmalı.');const c={db:env.DB,user,env};let result;
  if(params.name==='bilgiarena_operations_status'){exactKeys(args,[]);result=await operationsOverview(c);}
  else if(params.name==='bilgiarena_run_maintenance'){exactKeys(args,[]);result=await runOperation(c,'maintenance','mcp');}
  else if(params.name==='bilgiarena_create_backup'){exactKeys(args,[]);result=await runOperation(c,'backup','mcp');}
  else if(params.name==='bilgiarena_verify_backup'){exactKeys(args,['id']);if(typeof args.id!=='string')throw new ArenaError('Yedek kimliği gerekli.');result=await verifyBackup(c,args.id);}
  else throw new ArenaError('Araç bulunamadı.',404);
  return reply({content:[{type:'text',text:JSON.stringify(result)}],isError:false});
 }catch(e){return reply({content:[{type:'text',text:JSON.stringify({error:e instanceof ArenaError?e.message:'İşlem tamamlanamadı.',status:e instanceof ArenaError?e.status:500})}],isError:true},e instanceof ArenaError&&[401,403,413,415].includes(e.status)?e.status:200);}
}
