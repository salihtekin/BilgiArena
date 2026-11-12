/** Browser controls for the owner console; no user-specific response is cached. */
export function protectResponse(request:Request,response:Response){
 const url=new URL(request.url),admin=url.pathname==="/admin"||url.pathname.startsWith("/admin/")||url.pathname.startsWith("/api/admin")||url.pathname.startsWith("/account/");
 const headers=new Headers(response.headers);headers.set("X-Content-Type-Options","nosniff");headers.set("Referrer-Policy","strict-origin-when-cross-origin");
 if(admin){
  headers.set("Cache-Control","no-store, private");headers.set("Referrer-Policy","no-referrer");
  headers.set("Content-Security-Policy","frame-ancestors 'self' https://chatgpt.com; base-uri 'self'; object-src 'none'");
  headers.set("Permissions-Policy","camera=(), microphone=(), geolocation=()");
 }
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
