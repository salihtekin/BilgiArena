export const metadata={title:"Hesabını sil | BilgiArena"};
import "../../legal.css";
import {getChatGPTUser} from "../../chatgpt-auth";
import AccountForm from "../../../components/account-form";
export const dynamic="force-dynamic";
export default async function Delete(){return <AccountForm signedIn={!!await getChatGPTUser()} mode="delete"/>;}
