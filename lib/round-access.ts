import {hash} from './play-integrity.ts';
/** A fresh attestation grants only owned round reads/next. Scoring always requires
 * a new payload-bound verdict. The opaque capability is never stored on disk. */
export async function issueRoundAccess(db:D1Database,userId:string,roundId:string,now=Date.now()){
 const round=await db.prepare('SELECT expires_at FROM rounds WHERE id=? AND user_id=?').bind(roundId,userId).first<{expires_at:number}>();if(!round||round.expires_at<=now)return undefined;
 const bytes=crypto.getRandomValues(new Uint8Array(32)),token=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
 await db.prepare('INSERT INTO round_access VALUES(?,?,?,?) ON CONFLICT(round_id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at').bind(roundId,userId,await hash(token),round.expires_at).run();return token;
}
export async function canReadRound(db:D1Database,userId:string,roundId:string,action:unknown,token:string|null,now=Date.now()){
 if(!['next','resume'].includes(String(action))||!token||!/^[a-f0-9]{64}$/.test(token))return false;
 return !!await db.prepare('SELECT round_id FROM round_access WHERE round_id=? AND user_id=? AND token_hash=? AND expires_at>?').bind(roundId,userId,await hash(token),now).first();
}
