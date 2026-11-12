import {env} from "cloudflare:workers";
import {getChatGPTUser,chatGPTSignInPath} from "../chatgpt-auth";
import {isAdmin} from "../../lib/arena-security";
import AdminPanel from "./panel";
import "./admin.css";
export const dynamic="force-dynamic";
export const metadata={title:"BilgiArena · Yönetim",robots:{index:false,follow:false}};
export default async function AdminPage(){
 const user=await getChatGPTUser();
 if(!user)return <main className="adm-gate"><img src="/app-icon.png" alt=""/><h1>Yönetim paneli.</h1><p>Devam etmek için yönetici hesabınla giriş yap.</p><a href={chatGPTSignInPath("/admin")} target="_top">Yönetici hesabımla giriş yap</a></main>;
 if(!isAdmin(user,env))return <main className="adm-gate"><h1>Erişim yetkin yok.</h1><p>Bu alan yalnızca uygulama yöneticisine açık.</p><a href="/">Oyuna dön</a></main>;
 return <AdminPanel name={user.fullName||"Salih"}/>;
}
