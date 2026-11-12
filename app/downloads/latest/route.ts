import {APP_VERSION} from "../../../lib/release-config";
export async function GET(request:Request){return Response.redirect(new URL(`/downloads/BilgiArena-${APP_VERSION}.apk`,request.url),307);}
