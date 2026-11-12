# 1.2.1 Play Console — önce dahili test

Paket com.bilgiarena.app, versionCode 8, hedef SDK 36, minimum 26. Yükleme dosyası BilgiArena-1.2.1.aab; aynı özel yükleme anahtarı korunmuştur. Google Play yükleme/inceleme işlemi yapılmadı.

1. Önce BilgiArena-1.2.1.apk dosyasını kendi Android cihazına kur; altı oyunu ve giriş/ağ kesintisini dene. Play Console'da uygulamayı oluştur, Test et ve yayınla → Test → Dahili test bölümünde yeni sürüm aç. Play-Upload ZIP'ini çıkarıp içindeki BilgiArena-1.2.1.aab dosyasını yükle; ZIP veya kaynak kodu yükleme. Play App Signing'i yapılandır. Şimdilik üretim kanalına gönderme.
2. Play Integrity/Cloud bağlantısını kur; dağıtım sertifikasını, Cloud proje numarasını ve yetkili hizmet hesabını yalnız sunucuda yapılandır. App access risk yanıtını etkinleştir. Gerçek test kanalı kurulumu ve lisans ile doğrula.
3. Reklam için kendi AdMob uygulama ve geçiş reklamı kimliklerini Android derleme ortamına ver, UMP Privacy & messaging mesajını oluştur. Test cihazında yalnız test reklamları kullan. Kimlik değişikliği yeni imzalı derleme gerektirir.
4. Veri Güvenliği formunu gerçek veri işleyişine göre doldur: sağlayıcı kimliği/oyuncu adı, oyun etkinliği/yanıt/süre, hata-güvenlik kayıtları, kazananlarda ad soyad/TR IBAN ve ödeme kayıtları. Google Mobile Ads/UMP için SDK'nın güncel veri açıklamalarını ayrıca incele; IP, cihaz/uygulama bilgisi, reklam etkileşimi ve tanılama olasılığını dikkate al. AD_ID izni kaldırılmıştır; bu diğer SDK verilerinin işlenmediği anlamına gelmez. Sunucu/barındırma ve reklam sağlayıcıları yurt dışında veri işleyebilir. Hiç veri toplanmıyor beyanı verme.
5. Reklam içeriyor yanıtını gerçek yapılandırmaya göre ver. Mevcut teslimde reklam kimlikleri bağlı olmadığı için canlı reklam isteği yoktur; SDK kodu pakette bulunur. Gerçek kimlikli sürümde reklam ve ilgili veri beyanlarını yeniden doğrula. Hedef kitle 18+; içerik derecelendirme ve ülke dağıtımını doğru cevapla.
6. Gizlilik, kullanım koşulları, destek ve hesap silme sayfalarını oturumsuz erişilebilir kıl. Mevcut owner-private erişimi bu teslimde değiştirilmedi; kamuya açılmış kabul etme. İncelemecinin uygulamaya girebildiğini gerçek cihazda doğrula.
7. Ücretsiz nakit yarışma modelinin ülke, mağaza ve vergi/ödeme gerekliliklerini ayrıca doğrula. Bilgi yarışması veya ücretsiz katılım tek başına mağaza/hukuk onayı sayılmaz. Önce nakit olmayan canlı provayı gerçek cihazlarla test et; gerekli incelemeler ve bütçe ayırma tamamlandıktan sonra nakit ayarını aç ve yarışmayı yayımla.
8. Banka akışı manuel havaledir. Gerçek havaleyi kendi bankandan yap, dekont referansıyla panelde onayla. Banka tarafından doğrulanmış otomatik API statüsü yoktur. Teknik testler bankadan para gönderildiğini kanıtlamaz.
9. Kapalı test zorunluluğu ve üretim erişimi hesabının Play Console'da gösterilen güncel koşullarına bağlıdır. İç test, gerekiyorsa kapalı test, ön lansman raporu, Android Vitals ve inceleme sonucunu tamamla. Bu işlemler otomatik yapılmış değildir.

Ekran görüntüleri native Android görünümlerinin Robolectric çıktılarıdır; fiziksel cihaz kanıtı değildir. Son kontrol release/verification.json içindedir. Reklam, giriş, Play Integrity, arka plan/bölünmüş ekran, düşük ağ ve eş zamanlı katılımı gerçek cihazlarla ayrıca sınamak gerekir.

## 3 Kasım 2026 canlı kontrolü

Bakım aracı, canlı şifreli yedek oluşturma ve ikinci geri okuma geçti. Günlük bakım/yedek takvimi Europe/Istanbul 03.30 için etkin kaydedildi; ilk zamanlanmış çalışma henüz gözlenmedi. 127 sunucu/API testi ve gerçek yerel workerd/D1/R2 yedek testi geçti. Önceki 30 Android testi bu sunucu düzeltmesinde yeniden çalıştırılmadı; Android kaynak parmak izi ve imzalı APK/AAB özetleri korunuyor.

Dahili testten önce hesap türünü ve geliştirici hesabının doğrulamasını Play Console üzerinden kontrol et. Testçilerin sunucuya ve inceleyicinin giriş akışına erişimi henüz hazırlanmadı. Gizlilik ve hesap silme bağlantılarının oturum dışından erişimi kontrol edilmeden mağaza incelemesine gönderme. Kişisel hesabına uygulanıyorsa kapalı test koşullarını konsolda tamamla.
