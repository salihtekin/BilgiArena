# BilgiArena 1.1.0 — teknik inceleme

Bu kayıt kaynak incelemesi, SQLite üzerinde gerçek API/domain testleri, TypeScript kontrolü, sunucu HTML/CSS işleme ve Robolectric Android testlerini anlatır. Tam güvenlik garantisi, bağımsız sızma testi veya gerçek banka/Google hesaplarıyla uçtan uca doğrulama değildir.

## Yeni uygulanan kontroller

- Yarışma planı yayımdan sonra değişmez; nakit final için 200 nitelikli oyuncu, ayrı katılım penceresi ve ilan edilen asgari katılım gerekir. Yönetici hesapları nakit sıralamasından dışlanır. Gerçek katılımcı kayıtları kullanılır; simülasyonlu prova ayrıdır.
- Sunucu ortak soru başlangıcı/son tarihi, cevap kilidi, eleme ve eşitlik çözümünü hesaplar. Gelecek sorular, cevap anahtarı ve açık sorunun toplu seçim sayıları gönderilmez. Yanıt tek kez yazılır; boş yanıt ve kesinti devam hakkı vermez. Herkes yanlışsa yalnız normal yanıt verenler devam eder.
- Aşama sonuçlandırma tekil kayıt ve işlem nonce'u, revision kontrolü ve atomik D1 batch ile korunur. Aynı aşama veya ödül iki kez işlenemez. Ödül doğrudan banka ödemesi sayılmaz; önce inceleme, sonra bakiye aktarımı vardır.
- Mali tutarlar tam kuruş, pozitif/güvenli tam sayı doğrulaması ve negatif bakiyeyi reddeden SQL CHECK ile tutulur. Para çekme talebi aynı transaction içinde tutarı ayırır. Aynı istek anahtarı tekrarlandığında iki kez ayırmaz; farklı isteklerde eş zamanlı fazla çekim engellenir. Kullanıcı işleme alınmış talebi iptal edemez.
- Havale yalnız yönetici işleme aldıktan, gerçek transfer onayı ve benzersiz dekont referansı verildikten sonra paid durumuna geçer. İşlem günlüğü başarısız olursa durum ve bakiye değişikliği de geri alınır. Bu bankanın transferi doğruladığı anlamına gelmez; otomatik banka API'si yoktur.
- Banka yöntemleri ve talep içindeki banka ayrıntıları sunucuda AES-256-GCM, rastgele IV ve hesap özetine bağlı ek doğrulama verisiyle şifrelenir. Anahtar APK'da/depo/ZIP'te bulunmaz. Anahtar kimliği sayesinde eski anahtarlar korunarak döndürme yapılabilir. Özel yedek ayrı saklanır.
- Cüzdan yalnız oturum sahibine ait kayıtları döndürür. Standart kullanıcı/diğer oyuncu tam IBAN alamaz. Yönetici banka ayrıntısını ancak ayrı gerekçeli ve kaydedilen POST ile açar. UI kapatılınca açık banka ayrıntısı kaldırılır.
- Mali hareket defteri UPDATE/DELETE SQL tetikleyicileriyle değiştirilemez; manuel bakiye atama API'si yoktur. Sunucu/veri tabanı operatörü yetkisini ele geçiren saldırgana karşı bu kontroller tek başına yeterli değildir.
- Hesap silme oyun kayıtlarını ve banka yöntemini siler; mali hak/ödeme kaydı korunur, finalist doğrudan oyuncu bağlantısı NULL olur. Bekleyen hak hesap silmeyle yok olmaz veya yeniden kayıtla çoğalmaz.
- Yeni uç noktalar güvenilir sağlayıcı kimliği, hesap koşul sürümü, yönetici kimlik+e-posta listesi, CSRF, gövde/alan doğrulaması, D1 oran sınırı ve private/no-store yanıt başlıkları uygular. Yeni final join/answer/interrupt işlemleri zorunlu modda gerçek Google Play Integrity çözümlemesinden geçer.
- Reklamın tamamlanması, başarısızlığı, tıklanması ve izin tercihi puan/ödül API'si değildir. 5/10. aşama kapanışındaki doğal arada gösterilir; aktif soru/canlı final/para çekme içinde gösterilmez. UMP onayı öncesinde reklam isteği yapılmaz. Gerçek yayıncı kimlikleri eksikse reklam isteği kapalıdır. Debug test reklamları release derlemesinde engellenir.

## Doğrulama ve sınırlar

Güncel makine sonuçları release/verification.json içindedir. Sunucu: 83 test; buna 200 ayrı nitelikli oyuncu kaydıyla ortak aşama/yanıt eş zamanlılığı, ödül/bakiye yarışları ve gerçek API handler kontrolleri dahildir. Bu test yerel SQLite adaptöründe çalışır; 200 fiziksel cihazın ağı veya Cloudflare üretim yük kapasitesi ölçülmüş değildir. Android testleri yerel native görünümler ve yaşam döngüsü davranışını kontrol eder. AdMob SDK ve test reklamlı debug derlemesinin derlenmesi gerçek reklam gösterildiğini/gelir elde edildiğini kanıtlamaz.

Gerçek cihaz giriş sağlayıcısı, Play lisansı/sertifikası/erişim riski, farklı üretici ekran kaydı koruması, düşük ağ ve son saniye yanıt gecikmesi ayrıca sınanmalıdır. Play'in standart Integrity kotası kullanıcı başına istek sayısına göre planlanmalıdır. Canlı GET yoklaması Google tokenı tüketmez; yarışmaya katılma, yanıt ve kesinti korunan işlemlerdir. Aşama ilerletme sunucu saatine göre ilk ilgili istekte yapılır; istek yokken çalışan ayrı bir zamanlayıcı yoktur. Sonradan gelen istek geçmiş son tarihleri değiştirmez ve durum kurtarılabilir.

Üretim npm bağımlılık taraması sıfır bulgu verdi. Geliştirme ağacında braces 3.0.3 için yüksek önem dereceli GHSA-vfj7-8cjw-p6xm kaydı vardır; tarama anında düzeltilmiş sürüm bildirilmedi. Bu açık yok sayılmaz; ağaca bağlı geliştirme/derleme araçlarında izlenmelidir. Reklam SDK ağacındaki Guava 31.1-android taramada iki kayıt verdi; 33.7.2-android alt sınırıyla güncellendi ve imzalı paket yeniden derlendi. Kilitli Android çalışma zamanı Maven taramasının sonucu ayrıca release/dependency-audit.json dosyasındadır. Tarama yalnız bilinen veritabanı kayıtlarını kapsar.

Nakit ödül, gerçek reklam ve genel oyuncu erişimi bu teslimde etkinleştirilmiş sayılmaz. Gerçek banka transferi yapılmadı, AdMob/Play üretim hesabı bağlanmadı, Google Play'e yükleme ve onay alınmadı. Hukuki/dinî uygunluk veya mağaza kabulü teknik testlerden çıkarılamaz. Harici kamera ve bütün AI/dış yardım yöntemlerini kesin engellemek mümkün değildir.
