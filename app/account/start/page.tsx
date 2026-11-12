export const metadata={title:"Hesap oluştur | BilgiArena"};
import "../../legal.css";
import {getChatGPTUser} from "../../chatgpt-auth";
import AccountForm from "../../../components/account-form";
export const dynamic="force-dynamic";
export default async function Start(){return <AccountForm signedIn={!!await getChatGPTUser()} mode="register"/>;}
