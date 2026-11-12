export const metadata={title:"Kullanım koşulları | BilgiArena"};
import "../legal.css";
import LegalDocumentPage from "../../components/legal-document";
import {TERMS} from "../../lib/legal-content";
export default function Terms(){return <LegalDocumentPage document={TERMS}/>;}
