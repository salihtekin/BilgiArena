declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ARENA_CASH_ENABLED?: string;
    ARENA_PAYOUT_KEYRING?: string;
    BUCKET?: R2Bucket;
    ARENA_INTEGRITY_REQUIRED?: string;
    PLAY_CLOUD_PROJECT_NUMBER?: string;
    PLAY_INTEGRITY_CERTIFICATES?: string;
    PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON?: string;
    ARENA_ADMIN_USER_IDS?: string;
    ARENA_ADMIN_EMAILS?: string;
  }
}
declare module "*.md?raw" {const value:string;export default value;}
