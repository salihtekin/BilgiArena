export const metadata={title:"Destek | BilgiArena"};
import "../legal.css";
import SupportPanel from "../../components/support-panel";
import {SUPPORT_EMAIL,APP_VERSION,PUBLISHER} from "../../lib/release-config";
export default function Support(){return <main className="legal-page"><div className="legal-shell"><a href="/">bilgiarena</a><h1>Yardım ve iletişim.</h1><p>BilgiArena {APP_VERSION} · {PUBLISHER}</p><div className="legal-card"><p>Oyun hatası, hesap işlemi veya sıralama itirazı için:</p><p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p><p>Sorunu, uygulama sürümünü ve yaklaşık zamanı belirt. Parola, kimlik belgesi veya banka bilgisi gönderme.</p></div><SupportPanel/><nav><a href="/privacy">Gizlilik</a><a href="/terms">Kullanım koşulları</a><a href="/account/delete">Hesabımı sil</a></nav></div></main>;}
