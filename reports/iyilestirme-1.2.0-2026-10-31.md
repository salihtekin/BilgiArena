# BilgiArena 1.2.0 — eksik giderme ve doğrulama durumu

31 Ekim 2026. Bu çalışma, önceki 26 maddelik ürün/teknik incelemenin uygulanabilir kod değişikliklerini kapsar. Sürüm 1.2.0 / Android versionCode 7. Önceki oyuncu puanları, devam eden turlar, yayımlanmış final soruları ve yarışmaların eski kural sürümü korunur. Mevcut erişim yalnız site sahibinedir. Nakit yarışma ve gerçek reklam bağlantıları etkinleştirilmemiştir.

## Önceki bulguların durumu

| No | Konu | Bu sürümde yapılan | Kalan doğrulama / iş |
|---|---|---|---|
| 01 | Eşit puan sıralaması | Oyuncu, yönetici ve finalist sorguları aynı pozitif puana ulaşma zamanını kullanıyor. Sonraki 0 puanlı tur sıralamayı düşürmüyor. | Regresyon senaryosu geçti. |
| 02 | Kolay oyundan puan toplama | Yeni puanlı turlar karma. Üç günlük turun toplamında her oyundan 5 aşama var; örnekler bağımsız hazırlanıyor. Eski turlar değiştirilmedi. | Gerçek oyuncu verisiyle zorluk ve başarı oranı kalibrasyonu gerekiyor; ortak dağılım tek başına eşit zorluğun kanıtı değildir. |
| 03 | 200 finalist / 2 katılımcı | Yeni nakit finalde asgari oda katılımı 200. Küçük nakitsiz prova korunuyor. Yarışma başına kural sürümü kaydediliyor. | 200 hak sahibi içinden yalnız 2 kişi girince başlamama testi geçti. Gerçek 200 cihaz provası yapılmadı. |
| 04 | Integrity kota ölçeği | Puan yazan her yanıt yeni, istek içeriğine bağlı doğrulama gerektiriyor. Başlangıçta verilen kullanıcı/tur/süreye bağlı yetki yalnız okuma ve sonraki aşama için geçerli. Normal puanlı turda 20 yerine 11 token isteği. | Gerçek Google kotası ve konsol bağlantısı doğrulanmadı. 5.000 günlük oyuncu için normal günde 165.000; ilk 200 kişinin finaliyle final gününde 167.200 istek, %20 payla 200.640 öngörülür. 200 günlük oyuncuda final günü 8.800, %20 payla 10.560 olur. Kesinti ve tekrarlar ek tüketir. Yönetim ekranı bu tahmini gösterir. Verilen kota ayrıca konsolda doğrulanmalıdır. |
| 05 | Bağlantı ve hız adaleti | Okuma ve puan yazma kuyrukları ayrıldı; cihaz ayarları kısa süreli önbellekte. Yeni finalde son eşitlik doğru sayısı ve dondurulmuş haftalık sırayla çözülüyor. Eski finalin süre kuralı korunuyor. | Gerçek cihaz ve zayıf ağda gecikme ölçümü gerekiyor. Ortak cevap son tarihine ulaşım hâlâ ağdan etkilenebilir. |
| 06 | Çoklu hesap / bot | Nakit ödül bakiyeye aktarılmadan hesap sahipliği, yaş ve çoklu hesap incelemesinin referansla kaydı zorunlu. İtiraz kanalı var. | İnsan kimliği otomatik doğrulanmış sayılmaz. Hafıza animasyonu için istemciye gönderilen dizi bot tarafından okunabilir; ekran koruması bunu çözmez. Gerçek operasyonel inceleme gerekir. |
| 07 | Giriş ve erişim | Webde hesap gerektirmeyen, yalnız cihazda işlenen antrenman eklendi. Sonuçlar lige yazılmaz. | Site erişimi sahibine özel kalır. Android sosyal sağlayıcı girişinin WebView kısıtı çözülmüş sayılmaz; desteklenen giriş ve gerçek cihaz testi gerekir. Genel erişim açılması ayrı karardır. |
| 08 | Yayın / hesap bağlantıları | Aynı yükleme sertifikasıyla yeni APK/AAB, güncel sürüm ve yükleme belgeleri hazırlanıyor. | Play Console yükleme/onay, Play Integrity, AdMob/UMP, banka mutabakatı ve ödül modelinin yayın uygunluğu ayrıca doğrulanmalı. |
| 09 | İçerik çeşitliliği | Ortak 60 bilgi sorusu ve 80 kelime Android çevrimdışı havuzunda da kullanılıyor. Çevrimiçi yeni turlarda son 8 turun soru kimlikleri öncelikle dışlanıyor. | 60 bilgi sorusunun her cevabı bu çalışmada bağımsız kaynaklarla yeniden doğrulanmadı. Sürekli editör incelemesi gerekir. |
| 10 | Canlı final sahnesi | Yeni final paketinde altı oyun var; ortak sahne, gerçek kalan oyuncu sayısı ve durum gösteriliyor. Dekoratif kişiler rakip seçimi gibi çizilmiyor. | Kalabalık cihaz provasında algı ve akıcılık ölçülmeli. |
| 11 | İlk oyun öğretimi | Androidde altı oyun için süresiz, puansız etkileşimli örnek; karma puanlı tur öncesi açıklama. | İlk kullanıcılarla anlaşılabilirlik testi gerekiyor. |
| 12 | Geri dönüş | Günlük hedef, kişisel rekor, seri ve gerçek ilan edilmiş finalin saati. Androidde isteğe bağlı yerel günlük/final hatırlatması. | Android pil/izin koşulları bildirimi geciktirebilir. Sunucu push hizmeti eklenmedi. |
| 13 | Sonuç ve paylaşım | Antrenman, karma tur, elenme ve gerçek kazanan ayrıldı. Erken kazanan tek doğruyla da tanınır. Güvenli sonuç kartı yalnız skor/mod içerir; korunan ekran görüntüsü açılmaz. | Gerçek cihazdaki paylaşım hedefleriyle kontrol gerekiyor. |
| 14 | Ölçüm | Başlangıçta kapalı, hesap bazında isteğe bağlı etkinlik ölçümü; oyun/tur/örnek/hata; ilk gözlenen gün D1/D7 kohortları; SDK gösterim ve gelir tahmini callbackleri. Kapatma ölçüm verilerini siler. | İstemci/SDK kayıtları doğrulanmış AdMob geliri değildir. Gerçek çökme/ANR takibi ve konsol mutabakatı ayrıca gerekir. Erken kohortlar olgunlaşmadan yorumlanmamalı. |
| 15 | Banka formu kaybı | Web ve Android yalnız başarılı kayıtta temizliyor. Android banka taslağı RAM'de; kalıcı ayara/loga yazılmıyor. | Hata ve RAM taslağı senaryoları test edildi. |
| 16 | Canlı bağlantı hatası | Uyarı, yeniden deneme ve ilerleyen ortak saat var. Aynı sorudaki yazı/hafıza durumu anketle sıfırlanmıyor. | Fiziksel uçak modu/ağ değişimi testi gerekiyor. |
| 17 | Soru editörü | Yetkili yönetici taslak, önizleme, doğruluk onayı ve değişmez yayın sürümü oluşturabilir. Soru bildirimi yalnız oyuncunun tamamladığı aşamadan alınır. | İçerik doğruluğunu editörün gerçekten kontrol etmesi gerekir. |
| 18 | Erişilebilirlik | Sesli hafıza ve uzatılmış süreli sıralamasız antrenman, renk için anlamlı sesli açıklama, azaltılmış hareket. Küçük ekranda çok satırlı seçeneklerin kesilmesi düzeltildi. | TalkBack, büyük yazı, üretici ve renk görme farklılıklarıyla kapsamlı gerçek cihaz testi yapılmadı. Sıralamalı modda eşdeğer erişilebilir görev tasarımı ayrıca çalışılmalı. |
| 19 | Ödeme / destek | Hesaba özel destek/itiraz kayıtları, yönetici yanıtı, durum ve revizyon; cüzdanda not/dekont referansı. | Gerçek banka sahibi doğrulaması ve havale mutabakatı manuel operasyon olarak kalır. |
| 20 | İşletim / yedek | Yetkili, sınırlı ve yinelenebilir bakım yazarı; süresi dolmuş token/ölçüm/banka ayrıntısı temizliği. Yerel SQLite yedek/geri yükleme bütünlük testi. | Otomatik barındırılan zamanlayıcı ve üretim sağlayıcı yedek/geri yüklemesi kurulup doğrulanmadı. İstekle final ilerletme hâlâ mevcut. |
| 21 | Kenar durumlar | Hak 0 iken puanlı düğme yok; 0 TL prova ödülü banka formu açmıyor; iki kazananlı provada asgari katılım en az 3; nakitte 200. | Otomatik testlerde doğrulandı. |
| 22 | Ana ekran | Günlük hedef ve gerçek yayımlanmış final, daha kısa afişin önüne alındı. Turkuaz kimlik korundu. | Gerçek cihazda ilk ekran yerleşimi değerlendirilir. |
| 23 | Sıralama açıklığı | Kendi sıran, yöneticiler hariç nakit final sıran, 200. sıra ve gerekli puan farkı ayrı. | Gerçek kalabalık ligle kullanıcı testi gerekiyor. |
| 24 | Profil / geçmiş | Hesaba bağlı altı oyuncu rengi ve baş harfler; sunucuda 20+1 sayfalama, Android ve web geçmiş sayfaları. | Ana dashboard son 6 özeti taşır; geçmiş sayfası önceki kayıtlara ulaşır. |
| 25 | Sürüm yönetimi | 1.2.0/versionCode 7, güncel politika onayı, doğrulanmış Google verdictindeki minimum sürüm denetimi. Sabit son-sürüm indirme bağlantısı; eski APK bağlantısı yönlendirilir. | Play uygulama içi güncelleme hizmeti ve fiziksel Android 8–16 matrisi doğrulanmadı. |
| 26 | Kullanıcı dili | Cüzdandaki teknik yapılandırma ayrıntıları kaldırıldı; final/ödeme/katılım durumları Türkçeleştirildi. Ayrıntılar yönetici ekranında. | Yeni durumlar eklenirken dil incelemesi sürmeli. |

## Doğrulama

108 sunucu/API testi ve 24 Android testi geçti. TypeScript, web ekranlarının sunucu render/CSS kontrolü, Android tam yayın lint (0 hata), imzalı APK/AAB ve bundletool doğrulaması geçti. Android yayın bağımlılıklarındaki 65 paket OSV üzerinden tarandı; bulgu yok. Kesin paket/imza özetleri `release/verification.json` içindedir. Testler gerçek HTTP işleyicilerini yerel D1 uyumlu SQLite üzerinde çalıştırır; kimlik ve platform ortamı test sağlayıcılarıyla değiştirilir. 200 kayıtlı finalistin eşzamanlı senaryosu gerçek 200 cihaz/yayın yük testi değildir. Native ekranlar Robolectric ile çizilir; fiziksel cihaz görüntüsü değildir. Tarayıcı önizleme bağlantısı kullanılamadığı için etkileşimli web testi doğrulanmadı.

Üretim npm taramasında bulgu yoktur. Geliştirme araç ağacında bir orta önem düzeyli `minimatch` kaydı sürmektedir; bu, üretim oyun paketinin taramasından ayrı kaydedilir. Android bağımlılık taraması, imza doğrulaması, tam yayın lint ve AAB doğrulamasının makine kayıtları paketle birlikte verilir.

## Sonraki gerçek doğrulama sırası

1. APK'yı mevcut imzanın korunduğu bir test cihazında güncelle; hesapsız altı oyun, uzun metin/büyük yazı, banka formu hatası, ağ kesintisi, hatırlatma ve sonuç paylaşımını dene.
2. Play kapalı test kanalında gerçek Integrity verdicti, lisans, uygulama imzalama sertifikası ve onaylı günlük kotayı doğrula. SDK ayarı bulunması başarılı doğrulama kanıtı değildir.
3. Önce küçük nakitsiz canlı prova, sonra 200 cihazla başlangıç/cevap dalgası ve sunucu gecikmesi ölçümü yap. Kimlik/yaş/çoklu hesap ve itiraz operasyonunu dene.
4. Siteye katılacak kitleyi belirleyip giriş akışını o kitleyle test et; özel erişim kendiliğinden açılmadı.
5. AdMob/UMP ve mağaza/veri güvenliği beyanlarını gerçek yapılandırmaya göre tamamla. Ödül yayını ve banka işlemi için dış hesap/uygunluk kontrolü yap.
6. Barındırılan zamanlayıcı ile sağlayıcı yedek/geri yüklemesini doğrula. Kullanım verisi geldikçe içerik zorluğunu ve geri dönüş oranlarını ölç.

## Teknik kaynaklar

- [Google Play Integrity verdict alanları](https://developer.android.com/google/play/integrity/verdicts)
- [Google Play Integrity genel bakış ve kota](https://developer.android.com/google/play/integrity/overview)
- [Android yerel hatırlatıcılar](https://developer.android.com/develop/background-work/services/alarms)
- [AdMob SDK gelir tahmini callbacki](https://developers.google.com/admob/android/impression-level-ad-revenue)
- [Google Play ödüllü oyun politikası](https://support.google.com/googleplay/android-developer/answer/9877032?hl=en)
