# BilgiArena 0.3.1 — Yönetim ve güvenlik incelemesi

20 Ekim 2026. Bu belge uygulama kaynakları, yerel API testleri ve bağımlılık taraması kapsamındadır. Bağımsız sızma testi veya tüm açıkların bulunmuş olduğuna dair garanti değildir.

## Yönetim erişimi

`/admin`, yalnızca mevcut Site hesabı üzerinden yöneticiye açıktır. Sunucu, platformdan gelen kararlı kullanıcı kimliğini ve e-postayı iki ayrı izin listesiyle eşleştirir. Ortam ayarı eksikse erişim reddedilir. İlk kayıt olan kişi yönetici yapılmaz. Kullanıcı adı, istemci alanı, yerel depolama veya bir URL parametresi yetki vermez. Liste değerleri kaynak kodunda ve APK'de bulunmaz.

Yönetici oyuncuları/turları/sıralamayı inceler, hesap askıya alır/açar, tamamlanmış puanlı turu gerekçeyle geçersiz kılar ve yeni çevrimiçi turların erişimini değiştirir. Nakit dağıtma, bakiye yazma veya cevap anahtarı düzenleme işlemi sunulmaz. Bakım modu devam eden turları ve cihazdaki çevrimdışı antrenmanı durdurmaz.

## Düzeltilen bulgular

| Alan | Önceki durum | Değişiklik |
|---|---|---|
| Yönetici ayrımı | Ayrı panel ve uygulama düzeyinde yönetici yetkisi yoktu | Sayfa ve her yönetim API işlemi sunucuda yetkilendiriliyor |
| İstek hızı | Genel oyun API'sinde kalıcı hız sayacı yoktu | D1 atomik sayaçları: oyuncu başına okuma 120/dk, yazma 90/dk, başlangıç 6/dk, profil 6/dk; yönetici okuma 60/dk ve yazma 20/dk |
| İstek boyutu | 8 KB sınırı tüm gövde belleğe alındıktan sonra kontrol ediliyordu | Akış okunurken bayt sınırı, Content-Length ön kontrolü, geçersiz UTF-8 ve yanlış içerik türü reddi |
| İstek alanları | Bilinmeyen alanlar sessizce göz ardı ediliyordu | Her işlem için izin verilen alanlar, yanıt türü ve uzunluğu denetleniyor; sahte puan/kimlik/rol alanları reddediliyor |
| CSRF | Origin varsa denetleniyordu | Origin ve Fetch Metadata kontrolü; yönetici yazmalarında aynı kaynak ve özel başlık zorunlu |
| Cihaz doğrulaması | Kesinti bildirme yolu puanlı turda Integrity denetimini atlayabiliyordu | `interrupt` yolu ve Android istemcisi doğrulama akışına alındı |
| Hesap askısı | İşlev yoktu | Mevcut oturum dahil çevrimiçi işlemler reddedilir, açık turlar kapatılır, hesap ligden çıkarılır |
| Puan düzeltme | Gerekçeli geçersiz kılma işlevi yoktu | Eski tur kaydı silinmeden ligden çıkarılır; yönetim değişikliği ve günlük kaydı D1 batch içinde atomik uygulanır |
| Eşzamanlı ayar yazma | Ayar yönetimi yoktu | Sürüm denetimi eski bir oturumun daha yeni ayarı ezmesini önler |
| Kimlik gizliliği | Lig listesinde platform kullanıcı kimlikleri dönüyordu | Oyuncu istemcisine sıralama temelli liste anahtarı gönderilir; tam kimlikler yalnızca yetkili yöneticiye açıktır |
| Tarayıcı başlıkları | Yönetim alanına özel koruma yoktu | Özel/no-store yanıtlar, nosniff, referrer kısıtı, frame-ancestors ve kamera/mikrofon/konum kısıtı |
| İç hata bilgisi | Hata metni günlükte bulunabiliyordu | İstek gövdesi, SQL, anahtar, token ve kişisel veri içermeyen genel hata kaydı |

## JavaScript bağımlılık incelemesi

Başlangıç taramasında 62 eşleşme (1 kritik, 30 yüksek, 23 orta, 8 düşük) vardı. Bunlar 62 ayrı sömürülebilir uygulama açığı anlamına gelmez; bazıları geliştirme araçlarına veya kullanılmayan özelliklere aittir. Örneğin Next.js ImageResponse uyarısındaki Node.js SVG görüntü üretme yolu bu uygulamada kullanılmıyordu.

Next.js 16.3.8, React/React DOM/RSC 19.2.8 ve Vite 8.0.16 sürümlerine geçildi. Esbuild, ws, undici, js-yaml, brace-expansion, browserslist, fflate, baseline-browser-mapping, image-size, fast-uri, source-map-js, Babel ve sharp için ilgili güvenlik düzeltmeleri kilit dosyasında uygulandı.

Son JavaScript taraması: üretim bağımlılıklarında **0** bilinen açık eşleşmesi; bütün ağaçta **1 yüksek** uyarı kaldı. Kalan paket `braces@3.0.3` (GHSA-vfj7-8cjw-p6xm / CVE-2026-93687); denetim veritabanında düzeltilmiş sürüm yok. Paket, eslint-config-next ve Vinext'in derleme eklentisinin fast-glob/micromatch zincirinde bir geliştirme bağımlılığıdır. Derleme glob girdileri proje kodundan gelir; kullanıcı API'si glob kalıbı kabul etmez. Uyarı gizlenmedi veya `audit` istisnasıyla bastırılmadı. Bu, bağımsız doğrulama tamamlanmış veya tüm sistem açıkları sıfır demek değildir.

## Doğrulama sonuçları

- **50 sunucu/API testi geçti:** 23 oyun/Integrity, 16 yönetim/güvenlik, 11 gerçek rota işleyicisi testi.
- **11 Android testi geçti:** 4 antrenman motoru, 3 ekran/giriş/kesinti, 4 native UI testi. Yeni yönetim kısayolunun yalnızca sunucu izni göstergesiyle görünmesi ve sabit yönetim URL'sini açması kontrol edildi. Bu gösterge sunucu yetkisinin yerine geçmez.
- **TypeScript noEmit, oyun ve panelin React sunucu render kontrolü, her iki CSS dosyasının ayrıştırması geçti.**
- **Android assembleDebug, testDebugUnitTest ve bundleRelease geçti; temel yayın lint görevi geçti.** APK test imzalı, AAB imzasızdır.
- Yönetim değişikliği öncesi/sonrası kayıtları, işlem başarısızlığında geri alma, askıya alınmış mevcut oturum, eski ayar sürümü, yanlış rol, sahte kimlik başlığı, farklı hesaba erişim, CSRF, istek boyutu/hızı ve kilitli final yanıtları kontrol edildi.
- API testleri gerçek rota işleyicilerini ve SQLite üzerindeki D1 uyum katmanını kullanır; yalnızca platform kimlik/ortam sağlayıcısı testte değiştirilir. Bunlar canlı Site kenar katmanı, fiziksel cihaz, gerçek Google oturumu veya bağımsız sızma testi değildir.
- Etkileşimli tarayıcı kontrolü ortamda bulunmadığı için tarayıcı uçtan uca testi yapılmadı.

## Tamamlanmamış veya kapsam dışında kalanlar

- Yönetim oturumu mevcut Site/ChatGPT kimlik sağlayıcısına dayanır. Sağlayıcıdaki MFA, oturum süreleri, kimlik başlıklarının dış isteklerden temizlenmesi ve barındırma altyapısı bağımsız olarak denetlenmedi. Uygulama bu platform sınırına güvenir.
- Play Integrity bağlantısı ve gerçek Google Play cihaz/lisans doğrulaması henüz yapılandırılmadı. Kod testleri Google yanıtını kontrollü test verisiyle doğrular; gerçek cihaz testi değildir.
- Uygulamanın hafıza dizisi/renk/metin gibi oynanabilir verileri istemciye iletilir. Değiştirilmiş istemci, otomasyon, harici kamera veya ikinci cihazdan yapay zekâ yardımı tamamen engellenemez. Android ekran koruması tek başına adil yarışma kanıtı değildir. Çevrimdışı soru havuzu gerçek ödüllü yarışma için gizli içerik sayılmaz.
- Gerçek nakit ödül, ödeme sağlayıcısı, banka verisi ve reklam ağı bağlı değildir; bunların güvenliği test edilmiş değildir. Canlı 200 insanın ortak finali henüz yoktur.
- D1 istek sayacı kimliği doğrulanmış hesap içindir; küresel/IP bazlı DDoS, çoklu hesap/sahte hesap ve altyapı kota saldırıları için platform korumaları ayrıca değerlendirilmelidir. Sayaç sabit dakikalık pencere kullanır; pencere sınırında kısa süreli çift kapasite mümkündür.
- Uygulama içindeki işlem günlüğü kullanıcı API'leriyle değiştirilemez; veritabanı/altyapı yöneticisine karşı kriptografik değişmezlik iddiası yoktur. Küresel yedekleme ve geri yükleme tatbikatı yapılmadı.
- Fiziksel Android cihazı, etkileşimli tarayıcı, bağımsız sızma testi ve canlı yarışma yük testi bu incelemenin dışında kaldı. Bu ortamda tarayıcı kontrolü kullanılamadığı için tarayıcı QA yapılmadı.
- Android kaynaklarında cleartext ağ trafiğinin ve yedeklemenin kapalı olduğu, WebView dosya/içerik erişiminin kapalı olduğu, SSL hatalarının iptal edildiği ve HTTPS alan adı listesinin sınırlı olduğu incelendi. Maven/Gradle bağımlılıkları için otomatik CVE taraması yapılmadı; JavaScript audit sonucu bu paketleri kapsamaz.
- Android paketi test imzalıdır; Google Play yayın imzası değildir. Gizlilik, hesap silme ve mağaza yayın hazırlığındaki önceki eksikler bu çalışmanın tamamlandığı anlamına gelmez.

## Başvuru kaynakları

- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP CSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- Next.js ImageResponse bildirimi: https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j
- React Server Functions bildirimi: https://github.com/react/react/security/advisories/GHSA-wx67-qw84-cm4g
- Kalan braces bildirimi: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- Yerel bağımlılık taraması: pnpm audit, 20 Ekim 2026; npm güvenlik bildirimleri.
