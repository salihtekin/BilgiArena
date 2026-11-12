# BilgiArena — 1.2.0

Yerel Java Android uygulaması, TypeScript sunucusu, D1 veri tabanı ve yönetim paneli birlikte bu depodadır. Renk #A0D3D7. Altı oyun, 10/15 saniyelik aşamalar, çevrimdışı antrenman, günlük toplam üç puanlı tur ve haftalık lig bulunur.

## Kodları bilgisayarda incele

1. Kaynak ZIP dosyasını çıkar.
2. **Android Studio → Open → bu `mobile` klasörü**. Projenin tamamını Android Studio'ya açmak yerine bu Gradle projesini seç.
3. Gradle JDK olarak **JDK 17**, SDK Manager'dan **Android SDK Platform 36**, Build Tools **35.0.0** kur. Gradle Sync tamamlanınca Run ile emülatöre veya USB hata ayıklaması açık telefona yükle.
4. Debug sürümü için özel yayın anahtarı gerekmez. İlk senkronizasyon internet bağlantısı ister. Ekranlar `mobile/app/src/main/java/com/bilgiarena/app/MainActivity.java`, tasarım `ArenaDesign.java`, ağ istemcisi `ArenaApi.java`, reklam denetimi `AdsController.java` içindedir.
5. **Sunucu ve yönetim panelini VS Code gibi bir editörde depo kökünden** incele. `lib/competitions.ts` gerçek finali, `lib/finance.ts` bakiye/IBAN/ödeme iş akışını; `app/api` uç noktaları; `app/admin` yönetimi içerir. Android Studio sunucu çalıştırmak için gerekli değildir.

```sh
cd mobile
./gradlew :app:assembleDebug :app:testDebugUnitTest
```

Sunucu bağımlılıklarını `npm run install:ci` ile kur; sonra `npm run dev`. Kimlik ve D1 yerel ortamı platform ayarlarına bağlıdır. Sunucu testleri gerçek oyuncu/para kullanmadan SQLite üzerinde çalışır:

```sh
node --experimental-strip-types --test --test-reporter=tap tests/arena.test.ts
node --experimental-strip-types --test --test-reporter=tap tests/admin-security.test.ts
node --experimental-strip-types --test --test-reporter=tap tests/api-security.test.ts
node --experimental-strip-types --test --test-reporter=tap tests/account.test.ts
node --experimental-strip-types --test --test-reporter=tap tests/competition-finance.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --test --test-concurrency=1 --test-reporter=spec tests/improvements.test.ts
node tests/ui-smoke.mjs
```

Her test paketini ayrı çalıştırmak çıktı ve toplamların doğrulanmasını kolaylaştırır.

## 1.2.0'da tamamlanan iş akışları

- **Canlı final:** gerçek kullanıcı katılımları, ilk 200'ün sabitlenmesi, ortak sunucu saati, aynı sorular, ilk cevabın kilitlenmesi, süre sonunda açıklama, eleme, eşitlik çözümü ve atomik ödül kaydı. Simülasyon içeren eski final provası ayrı ve açıkça etiketlidir. Finalde kullanılan hesaplanan soruların rastgele tohumu yalnız sunucudadır.
- **Yönetim:** nakit veya canlı prova taslağı, sabit kurallarla yayımlama, gerekçeli iptal, sonuç incelemesi ve ödülü bakiyeye serbest bırakma. Sonuç elle seçilmez, kazananlara sunucu karar verir. Nakit sıralaması yönetici hesaplarını dışlar.
- **Cüzdan:** tam kuruş cinsinden gerçek ödül, kullanılabilir/ayrılmış/kazanılan/ödenen tutarlar, ödeme talepleri ve değiştirilemeyen mali hareket defteri. Oyun puanı veya reklam olayı bakiyeye dönüştürülmez.
- **Banka:** kendi ad soyad/TR IBAN yöntemi, checksum doğrulama, sunucuda AES-GCM şifreleme, maskeli gösterim, gerekçeli yönetici görüntüleme; talep/iptal/işleme alma/reddetme/gerçek havale referansıyla tamamlanma. Aynı tutarı iki kez ayırma ve yinelenen istekler atomik işlemlerle önlenir.
- **Reklam:** Google Mobile Ads 25.5.0, UMP 4.0.0; güncel onay bilgisi kontrolü, tercih ekranı, 5. ve 10. aşama kapanışında doğal ara. Reklam gelmezse veya kapanırsa oyun sürer. Puan/katılım/ödül reklam izlemeye bağlanmaz. Soru sırasında, canlı finalde ve cüzdanda reklam gösterilmez. Yalnız güncel 18+ hesap koşulunu kabul eden bağlı hesaplarda reklam başlatılır.
- **Hesap silme:** oyun verileri ve banka yöntemi silinir; ödenmemiş mali haklar ve gerekli işlem kaydı takma adlandırılmış kimlikle korunur. Şifreli banka ayrıntılarının tamamlanmış taleplerde 90 günlük temizliği vardır. Aynı sağlayıcıyla yeniden kayıt mali hakkı geri getirir.

## Gerçek yayın için harici bağlantılar

Bu depo ve imzalı dosya **Google Play'e yüklenmiş veya onaylanmış değildir**. Özel sunucu erişimi korunmuştur. Aşağıdaki ayarlar olmadan gerçek reklam veya nakit yarışma açılmaz:

| Gerekli işlem | Yapılacağı yer |
| --- | --- |
| Play Console uygulaması, test dağıtımı ve Play Integrity Cloud bağlantısı | Senin Google Play/Cloud hesapların |
| `PLAY_CLOUD_PROJECT_NUMBER`, `PLAY_INTEGRITY_CERTIFICATES`, `PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON`, `ARENA_INTEGRITY_REQUIRED=true` | Sunucuda gizli ortam ayarları |
| `ARENA_CASH_ENABLED=true` | Play bağlantısı doğrulandıktan, bütçe ayrıldıktan ve ülke/mağaza kuralları incelendikten sonra sunucuda |
| `ARENA_PAYOUT_KEYRING` | Sunucuda kuruldu; özel şifreleme yedeği ayrı tutulur |
| `ARENA_ADMOB_APP_ID`, `ARENA_ADMOB_INTERSTITIAL_ID` | Kendi AdMob hesabından alınan açık yayıncı kimlikleriyle Android'i yeniden derle |
| AdMob UMP mesajı, gerekli reklam/veri beyanları | AdMob ve Play Console |
| Banka havalesi | Senin banka hesabından; uygulama para transferini otomatik yapmaz |
| Oyunculara ve mağaza incelemesine sunucu erişimi | Mevcut özel erişim politikası ayrıca değiştirilmelidir |

Play App Signing sertifikası ile yükleme anahtarının sertifikası farklı olabilir. Integrity'ye Play'in dağıtım sertifikasını ekle; APK'daki açık sertifika tek başına yeterli değildir. Google test kanalından kurulmuş lisanslı sürüm ve gerçek cihazla giriş, kesinti, ödeme ve reklam akışı doğrulanmalıdır. Fiziksel cihaz/banka/AdMob üretim hesabı uçtan uca doğrulaması burada yapılmadı. 200 kişinin eş zamanlı test kaydı, 200 gerçek cihazla ağ/yük testi anlamına gelmez.

Nakit yayına teknik ayar açılması hukuki, dinî veya mağaza onayı değildir. Ücretsiz katılım ve reklama bağlı olmayan ödül modeli uygulanmıştır; ülke şartları ve yayımlanacak yarışma metni işletmecinin ilgili uzmanlarla ayrıca doğrulaması gereken alanlardır.

## Reklam testi

```sh
cd mobile
./gradlew :app:assembleDebug -ParenaTestAds=true
```

Bu seçenek yalnız debug için Google'ın resmi test kimliklerini kullanır; gelir üretmez ve release derlemesine izin verilmez. Normal APK/AAB, gerçek AdMob kimlikleri verilmediğinden reklam isteği yapmaz. Kimlikler olmadan sahte gelir raporu gösterilmez. Yayıncı kimlikleri sır değildir; hizmet hesabı ve şifreleme anahtarı APK'ya asla girmez.

## İmzalı derleme ve yedekler

`ARENA_UPLOAD_KEYSTORE` ve `ARENA_UPLOAD_STORE_PASSWORD` verilerek `:app:assembleRelease :app:bundleRelease` çalıştırılır. Mevcut yayın anahtarını koru; yeni anahtar oluşturma. Özel imza yedeği ve banka şifreleme yedeği kaynak paketinden ayrıdır. Anahtar kaybı sırasıyla güncelleme yayımlamayı veya kayıtlı banka bilgisini çözmeyi engelleyebilir.

Yönetim adresi: https://bilgiarena.salihtekin.chatgpt.site/admin . Her istek sunucudaki yönetici kimliği ve e-posta listesiyle doğrulanır; mobilde görünen kısayol yetki sağlamaz. APK içinde yönetici parolası yoktur.

Güncel teslim ve doğrulama kayıtları `release/verification.json`, `reports/guvenlik-incelemesi-1.2.0.md` ve `release/play-store/` içindedir. 1.0 raporları yalnız geçmiş sürümü anlatır.

Bu belge depo kökündeki README-TR.md ile birlikte okunur. Sunucu dosya yolları depo köküne göredir.
