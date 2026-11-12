# BilgiArena 1.0.0 — yayın ve güvenlik incelemesi

21 Ekim 2026. Kaynak kodu, gerçek API işleyicileri, SQLite/D1 uyum katmanı, Android görünümleri ve dağıtım dosyaları incelendi. Ayrıntılı son sonuçlar `release/verification.json` içinde tutulur. Bu çalışma bağımsız sızma testi veya tüm açıkların kapandığına dair garanti değildir.

## Tamamlanan kontroller

- Kullanıcı ve yönetici kimliği platformun doğruladığı oturumdan alınır. Yönetici için hem kullanıcı kimliği hem e-posta sunucu izin listesinde olmalıdır; ikisinden biri eksikse erişim reddedilir. İstemci rol, kullanıcı kimliği veya puan yazamaz. Her yönetim API'sinde yetki tekrar denetlenir.
- Oyuncu kartı, mevcut koşullar ve gizlilik metni ayrı onaylarla oluşturulur. Hesap okuma/giriş otomatik oyuncu oluşturmaz. Oyun API'si kart ve güncel onay ister. Askı ve silinme, açık oturumla da uygulanır.
- Kalıcı hesap silme doğrulanmış oturum ve açık onay ister. Profil, turlar, yanıtlar, yerleşim kayıtları, doğrulama challenge'ları ve sıklık kayıtları atomik D1 batch içinde silinir. Yönetim günlüklerindeki oyuncu/tur kimlikleri ve kişisel ayrıntılar kaldırılır. Başarısız adımda bütün silme geri alınır. Tekrarlanan silme idempotenttir.
- En çok 90 günlük özet kimlikli güvenlik kaydı, silme/yeniden oluşturma yoluyla günlük tur sınırının veya askının aşılmasını önler. SHA-256 özetinin anonim veri olduğu iddia edilmez. Süre dolunca kayıt sonraki hesap isteğinde temizlenir. Aynı gün yeniden kayıt, önceki puanlı başlangıçları tüketilmiş sayar; geçmiş skorları geri getirmez.
- Kayıt ve silme gövdelerinde bilinmeyen alanlar reddedilir. CSRF, JSON türü, akış boyutu, kullanıcı başına istek sınırı ve parametreli SQL kontrolleri uygulanır. Oyun/hesap/yönetim yanıtları önbelleğe alınmaz. Kimliğe bağlı hesap sayfaları da private/no-store olarak korunur.
- Sunucu, tur sahipliğini, günlük sınırı, süreyi ve puanı hesaplar. Tekrar yanıt çift puan oluşturmaz. Başka oyuncunun turu okunamaz, yanıtlanamaz veya iptal edilemez. Yalnız tamamlanan puanlı turlar sıralanır. Final provasında doğru yanıt/puan/elenme ortak süre dolana kadar açılmaz. Hafıza gösterimi atlanamaz.
- Yönetici askı, tur geçersiz kılma ve erişim ayarı işlemleri gerekçeli ve günlüklüdür. Ayar revizyonu eski ekranın yeni ayarı ezmesini önler. Değişiklik ile günlüğü birlikte geri alınabilir atomik işlemdir.
- Android ana pencere, giriş penceresi ve diyaloglarda FLAG_SECURE kullanır; overlay dokunuşları reddedilir, üstteki pencereler gizlenir. Arka planda perde gösterilir ve açık aşama kapatılır; başarısız kesinti isteği yeniden denenir. Çoklu pencere kısıtı uygulanır. Bütün erişilebilirlik servislerini veya yüklü uygulamaları tarayan bir mekanizma yoktur.
- Android ağında HTTPS, kapalı cleartext ve yedekleme, sistem CA'ları, sınırlı giriş alan adı listesi vardır. WebView dosya/içerik erişimi ve hata ayıklama kapalıdır; JS köprüsü eklenmemiştir, TLS hataları geçilmez. APK yalnız INTERNET ve HIDE_OVERLAY_WINDOWS izinleri ister.
- Yayın derlemesi özel PKCS12 olmadan durur. APK ve AAB yükleme anahtarıyla imzalanır; sertifika özeti herkese açık dosyayla eşleştirilir. Debuggable kapalıdır; hedef API 36, minimum API 26'dır. AAB yapısı Google bundletool ile doğrulanır. Kaynak ve mağaza arşivleri özel anahtar/parola içermez.

## Doğrulamanın kapsamı

Sunucu/API paketi 64 test içerir: oyun/Integrity, yönetim ve erişim, gerçek rota işleyicileri, kayıt ve silme. Android paketi 14 test içerir: antrenman motoru, pencere/giriş/kesinti kontrolleri, altı oyunun native kontrol yolu, yönetim kısayolu, onay kutuları/çevrimdışı metin, silme iptali ve mağaza ekranlarının gerçek Android görünümlerinden çıkarılması. Son geçme/kalma sayıları dağıtımdaki `verification.json` dosyasında verilir.

API testlerinde yalnız platform kimlik ve ortam sağlayıcıları kontrollü test verisiyle değiştirilir; uygulamanın gerçek rota kodu ve SQL'i çalışır. Bunlar canlı kenar katmanında kimlik doğrulama, gerçek Google/ChatGPT girişi veya fiziksel cihaz testi değildir. Robolectric ekranları gerçek native görünümleri kullanır; fiziksel telefondan alınmış ekran görüntüsü olarak sunulmaz.

TypeScript, React sunucu render ve CSS ayrıştırma kontrolü ayrıca çalıştırılır. Android temel yayın lint görevi ve imzalı yayın derlemesi kontrol edilir. Etkileşimli tarayıcı QA ortamda mevcut değildi.

## Bağımlılık taraması

21 Ekim 2026 `pnpm audit --prod`: üretim JavaScript bağımlılıklarında 0 bilinen açık eşleşmesi. Vite geliştirme aracı 8.1.6 sürümüne yükseltilerek üç launch-editor uyarısının düzeltmesi alındı. Tüm geliştirme ağacında 1 yüksek uyarı sürüyor: `braces@3.0.3`, GHSA-vfj7-8cjw-p6xm / CVE-2026-93687. GitHub bildiriminde düzeltilmiş sürüm yok. Paket derleme/lint glob zincirindedir; oyuncu API'si glob kalıbı kabul etmez. Uyarı bastırılmamıştır. Bu, bütün sistemde açık olmadığı anlamına gelmez. Android yayın lint modelindeki 21 Maven bağımlılığı ayrıca OSV querybatch API ile sorgulandı; 0 bilinen açık eşleşmesi döndü. Koordinatlar ve sonuç `release/android-dependency-audit.json` içindedir. Bu ikinci tarama derleme/test araçlarını ve desugar araç zincirini kapsamaz. Npm sonucu Android bağımlılıklarının yerine kullanılmamıştır.

Kaynak: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm

## Kalan doğrulamalar ve sınırlar

- Play Console hesabı, kimlik/cihaz doğrulaması, çalışan sıradan inceleme hesabı ve gerçek Android cihazda sağlayıcı girişinin tamamlanması yayıncıya bağlıdır. Harici sağlayıcı WebView girişini reddedebilir; bu ihtimal fiziksel cihazda doğrulanmadan kapanmış sayılmaz. Kullanıcı aracısı değiştirilerek kısıt aşılmaz, gizli oturum aktarımı veya ikinci bir OAuth sistemi kurulmamıştır.
- Play Integrity kodu vardır ama sunucu yapılandırmasında kapalıdır. Gerçek Google Play lisans/cihaz kontrolü, Cloud proje/hizmet hesabı ve Play App Signing sertifikasıyla ayrıca doğrulanmalıdır. Eksik ayarla zorunlu yapılırsa korunan oyun açılmaz.
- Nakil ve kullanıcı erişimi Site/ChatGPT kimlik altyapısına dayanır. Sağlayıcı MFA'sı, dış başlıkların temizlenmesi, barındırma günlükleri, yedeklerin fiziksel yaşam döngüsü ve felaket kurtarma tatbikatı bağımsız incelenmedi. İşletmeci veri beyanı ve sağlayıcı aktarım şartlarını doğrulamalıdır.
- Android ekran koruması, değiştirilmiş istemciyi, ikinci telefon kamerasını, harici yapay zekâ yardımını veya bir insanın dış yardımını kesin engellemez. Yerel yaşam döngüsü sinyali tek başına kalıcı hile hükmü değildir.
- Küresel/IP düzeyinde DDoS, çoklu hesap, altyapı maliyet/kota saldırıları ve 200 gerçek insanla canlı yük testi yapılmadı. Kullanıcı sıklık sayacı sabit dakikalık pencere kullanır. Yönetim günlüğü altyapı yöneticisine karşı kriptografik değişmezlik iddiası taşımaz.
- Gerçek reklam ağı, nakit ödül/ödeme altyapısı ve canlı insan final odası bu sürümde yoktur. Bunların güvenliği veya hukuki/dini uygunluğu doğrulanmış değildir. Yayın menülerinden para kazanma/çekme vaatleri çıkarılmıştır; puanlar nakde çevrilemez.
- Site erişim politikası uygulama yetkisinden ayrıdır. Gizlilik/hesap silme URL'leri ve gerçek oyuncu erişimi mağaza gönderimi öncesinde oturumsuz olarak doğrulanmalıdır. Yönetim API'si herkese açık Site üzerinde de yönetici oturumu ister.

Google Play'e yükleme, üretim erişimi ve mağaza onayı tamamlanmış işlem olarak gösterilmez. Hesaba uygulanıyorsa kapalı test koşulu ve mağaza formları gerçek bilgiyle tamamlanmalıdır. İlgili aktarım dosyaları `release/play-store/` içindedir.

360 × 640 dp yerleşiminde dört bilgi seçeneğinin ve matematik yanıt düğmesinin kaydırmadan görünmesi native görünüm testinde denetlenir. Görseller gerçek cihaz ekran görüntüsü değildir.
