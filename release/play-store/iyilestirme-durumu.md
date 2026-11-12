# BilgiArena 1.2.1 — düzeltme ve doğrulama durumu

1 Kasım 2026. Android sürüm kodu 8. Bu sürüm, tamamlanan 1.2.0 geliştirmelerinin üzerine bakım ve kurtarma araçlarını, isteğe bağlı çökme sayacını ve antrenman tekrar azaltmasını ekler. Uygulama sahibine özel erişim korunur.

## Tamamlanan yeni işler

- Yetkili bakım için 5 dakikalık tekrar koruması, süreli veritabanı kilidi, başarısız işi yeniden deneme ve işlem geçmişi. Aynı işin çakışan çağrıları iki başarılı işlem oluşturmaz.
- 21 ürün tablosunun tek SQL okumasıyla alınan şifreli uygulama yedeği. AES-256-GCM ve ayrı HKDF anahtarı; depoya yazma sonrası yeniden okuma, dosya/içerik özeti, şifre etiketi ve cüzdan-defter kontrolü.
- Başarı ve yönetici denetim kaydı aynı veritabanı işleminde kaydedilir. Hatalı dosya, anahtar, aktarım veya denetim kaydı başarı olarak gösterilmez.
- Yönetim ekranından yedek oluşturma, yeniden doğrulama ve yalnız şifreli dosyayı indirme. İndirmede yönetici yetkisi tekrar denetlenir.
- Yeni ve ayrı SQLite dosyasına kurtarma provası. Şema, yabancı anahtarlar ve veritabanı bütünlüğü kontrol edilir; canlı veritabanına geri yükleme uç noktası bulunmaz.
- Dört yönetici Site aracı: bakım durumu, bakım çalıştırma, günlük yedek oluşturma ve yedek doğrulama. Site görünürlüğüne ek olarak hem kimlik hem e-posta yönetici izin listesinde olmalıdır.
- Android antrenmanında son 40 bilgi/kelime sorusuna düşük öncelik; kelime ve ters kelime oyunları ortak tekrar geçmişi kullanır. Havuz dolduğunda tur oynanabilir kalır.
- Android'de kullanıcı izin vermiş ve hesap bağlıysa çökme sonrası yalnız sınırlı hata sayısı gönderilir. Hata metni, yığın izi veya kişisel ayrıntılar saklanmaz. İzin geri alındığında bekleyen sayaç ve sunucu ölçüm kayıtları kaldırılır. Bu, kapsamlı ANR veya Play Vitals bağlantısı değildir.
- Gizlilik sürümü 2026-11-01; şifreli yedek saklama ve çökme sayacı açıklandı. Mevcut yarışmaların 2026-10-31 veya önceki kural sürümleri değişmez.

## Kanıt ve sınırlar

3 Kasım 2026 kontrolünde 127 sunucu/API testi geçti. Önceki 30 Android testi 1 Kasım sürüm doğrulamasına aittir; bu sunucu düzeltmesinde yeniden çalıştırılmadı. Testler gerçek HTTP işleyicilerini yerel D1 uyumlu SQLite ile çalıştırır; platform kimliği test sağlayıcısıyla değiştirilir. Şifreli depo testleri kontrollü nesne deposuyla bozulma ve hata senaryolarını çalıştırır. İzole kurtarma testinde yalnız sentetik kayıtlar kullanılır. Bunlar canlı sağlayıcı yedeği veya üretim kurtarma tatbikatı değildir.

TypeScript, web sunucu render/CSS ve Android tam yayın denetimi geçti; Android denetiminde hata yok. Android test ekranları Robolectric ile çizilir; fiziksel cihaz veya etkileşimli tarayıcı testi yapılmış sayılmaz. Son paket/imza/bağımlılık kayıtları `release/verification.json` ve `release/dependency-audit.json` içindedir.

Yedek kapasitesi toplam 1.800.000 bayt düz metin ve tablo başına 1.000 kayıttır. Aşımda işlem durur; eksik yedek teslim edilmez. Daha büyük üretim verisi için sağlayıcı yedeği gerekir. Saklama hedefi 30 gün; eski nesneler sonraki başarılı bakımda silinir. Zamanlanmış bakım bağlanmadan bu temizliğin gözetimsiz çalıştığı iddia edilmez.

Canlı kurtarmadan önce güncel hesap silme ve ölçüm iznini geri alma tercihleri ile finansal mutabakat tekrar uygulanmalıdır. Eski yedek güncel izinleri geri açmak için kullanılamaz. Anahtar halkasındaki eski anahtar, ilgili yedeklerin süresi dolmadan kaldırılmamalıdır. Ayrıntılar: `docs/operations.md`.

## Kalan gerçek doğrulamalar

1. Kaydedilen günlük bakım/yedek takviminin ilk çalışmasını işlem geçmişinden gözle. Yetkili bakım yazarı ve canlı yedeğin ikinci geri okuması 3 Kasım tarihinde doğrulandı. Takvim kaydı tek başına zamanlanmış çalışmanın gerçekleştiğini kanıtlamaz.
2. Sağlayıcı yedeği, gerçek üretim geri yükleme/kesinti tatbikatı ve daha büyük veritabanı kapasitesi.
3. Fiziksel Android cihazda güncelleme, giriş, çevrimdışı oyun, kesinti, büyük yazı, hatırlatma ve paylaşım. WebView sosyal giriş akışı platform desteğiyle ayrıca doğrulanmalı; özel oturum sistemi eklenmedi.
4. Google Play kapalı test, gerçek Integrity/lisans/sertifika/kota ve Play Vitals. Gerçek 200 cihazla final başlangıç/yanıt yükü ve sunucu gecikmesi ölçümü.
5. AdMob/UMP yayıncı bağlantıları, mağaza/veri güvenliği beyanları, banka ve ödül operasyonunun dış hesap kontrolleri.

Nakit yarışma, gerçek reklam ve Play Integrity bağlantısı açılmamıştır; otomatik banka havalesi veya mağaza onayı vaat edilmez. Üretim npm taramasında açık yoktur; geliştirme araç ağacındaki bir orta önem düzeyli minimatch kaydı ayrıca sürmektedir. Önceki güvenlik incelemesi `reports/guvenlik-incelemesi-1.1.0.md` içinde geçmiş rapor olarak saklanır.

## 3 Kasım 2026 sunucu düzeltmesi ve canlı doğrulama

Standart MCP istek ek bilgisi (_meta) nedeniyle reddedilen yönetici bağlantısı düzeltildi. Bu ek bilgi yetki kaynağı sayılmaz. Sağlık kontrolü operasyon tablosunun varlığını da sınar. Canlı yedek denemesinde görülen birleşik SELECT sınırı, sorguyu skaler ölçümlere dönüştürerek giderildi; tüm ürün verileri yine tek SQL okumasında alınır. Gerçek yerel workerd/D1/R2 testi sentetik kayıtlarla şifreleme, nesne yazma, yeniden okuma ve tekrar çağrıyı doğrular.

Yetkili Site bağlantısı ile canlı bakım başarılı oldu. 3 Kasım yedeği 21 tabloyu kapsadı, 29.436 bayt şifreli dosya depoya yazıldı ve geri okunarak doğrulandı. Ardından ayrı bir çağrı dosyayı yeniden okuyup bütünlüğünü tekrar doğruladı. Başarısız ilk deneme başarı sayılmadı; ikinci deneme işlem geçmişinde başarılıdır. Bu, canlı veritabanının geri yüklenmesi veya sağlayıcı düzeyindeki kesinti tatbikatı değildir.

Günlük bakım ve şifreli yedek görevi Europe/Istanbul saat diliminde 03.30 için etkin kaydedildi. İlk zamanlanmış çalışma henüz gözlenmedi. Kamuya açık erişim açılmadı; nakit, gerçek reklam ve Google Play bağlantıları kapalı kalıyor. Mevcut Android 1.2.1 / sürüm kodu 8 için yeni APK derlemesi gerekmedi; kaynak parmak izi ve imzalı APK/AAB özetleri aynı.

Play hazırlık kılavuzundaki eski sürüm/dosya adı düzeltildi. Test mağaza açıklamasından etkin olmayan nakit ödül ve para çekme vaatleri çıkarıldı. Üretim yayını, testçi/inceleyici erişimi, gizlilik bağlantılarının dışarıdan erişimi, gerçek cihaz ve Play Console testleri tamamlandıktan sonra değerlendirilmeli.
