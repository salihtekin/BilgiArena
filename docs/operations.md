# BilgiArena bakım ve kurtarma

Yönetici ekranı: Destek ve ölçüm → Bakım ve şifreli uygulama yedeği. İşlemler hem doğrulanmış kullanıcı kimliğinin hem e-posta adresinin yönetici izin listesinde olmasını gerektirir. Site görünürlüğü tek başına yönetici yetkisi vermez.

Bağlı Site araçları:
- `bilgiarena_operations_status`: son 40 işlem ve son başarılı yedek; kişisel satırlar içermez.
- `bilgiarena_run_maintenance`: vadesi gelen final aşamaları, süreli kayıtlar ve eski yedeklerin temizliği. Banka havalesi yapmaz, ödül incelemesini atlamaz.
- `bilgiarena_create_backup`: UTC günü başına en fazla bir başarılı şifreli yedek. Aynı gün yeniden çağrı önceki sonucu döndürür.
- `bilgiarena_verify_backup`: belirtilen başarılı yedeği yeniden okuyup doğrular.

Bakım beş dakikalık dilim başına tek başarılı işlem olarak kaydedilir. 2 dakikalık veritabanı kilidi çakışmayı engeller; başarısız veya süresi dolmuş işler yeniden denenebilir. Finalin saniyelik ortak saati hâlâ sunucu zamanıyla değerlendirilir. Günlük bakım veya bulut görevi, saniyesi saniyesine final zamanlayıcısı değildir; oda açıkken istekler de aşamaları ilerletir.

## Şifreleme ve kapsam

Yedek 21 ürün tablosunu tek SQL okumasında alır. Süreli oturum/doğrulama yetkileri, istek sayaçları ve operasyon kilitleri aktarılmaz. Sınır tablo başına 1.000 kayıt ve toplam 1.800.000 bayt düz metindir. Sınır aşılırsa işlem başarısız olur; kesilmiş veri başarılı yedek olarak sunulmaz. Bu ölçek sınırı üretim büyüdükçe sağlayıcı düzeyindeki yedekleme ile tamamlanmalıdır.

AES-256-GCM; mevcut anahtar halkasından HKDF-SHA256 ile ayrı `bilgiarena:recovery:v1` anahtarı türetilir. Origin, tarih, dosya kimliği ve içerik özeti doğrulamaya bağlanır. Anahtarlar dosyada veya günlükte bulunmaz. Eski yedeği açmak için o tarihin anahtarını güvenli biçimde saklamak gerekir. Anahtar döndürmede eski anahtarı tüm ilgili yedekler süre sonuna ulaşmadan kaldırma.

Depoya yazma ardından dosya yeniden okunur; şifreli dosyanın SHA-256 özeti, AES-GCM etiketi, düz metin özeti, satır yapısı ve cüzdan/defter tutarlılığı kontrol edilir. Başarı ile yönetici denetim kaydı aynı D1 işleminde kaydedilir. İndirme yalnız şifreli dosyadır ve yeniden doğrulamadan geçer. Önceki başarılı kayıt son kontroldeki durumu gösterir; sağlayıcı kesintisinin şu an yokluğunu kanıtlamaz.

Saklama hedefi 30 gündür. UTC tarihine göre eski dosyalar sonraki başarılı bakım/yedek çalışmasında silinir; 30 günden eski dosyaların indirilmesi engellenir. Temizlik çağrısı en fazla 1.000 eski nesne işler, sınır dolarsa yeniden çalışma gerekir. Takvim kurulmamışsa otomatik temizlik çalışmış kabul edilmez.

## İzole geri yükleme provası

`node scripts/recover-backup.ts --rehearsal-only --input backup.json.enc --output new.rehearsal.sqlite`

Anahtar halkası yalnız süreç ortamındaki `ARENA_PAYOUT_KEYRING` üzerinden alınır; komut satırına anahtar yazma. Araç mevcut dosyanın üzerine yazmaz. Kendi depodaki migration dosyalarını uygular, şemayı karşılaştırır, bağlanmış parametrelerle veri ekler ve yabancı anahtar/SQLite bütünlük kontrollerini çalıştırır. Başarısız yeni prova dosyası silinir. Özet yalnız tablo/satır sayısı içerir. Çıktı hassas veri içerir; erişimi sınırla ve prova sonunda güvenle kaldır.

Bu araç canlı geri yükleme yapmaz. Canlı kurtarma öncesinde güncel hesap silme kayıtları, ölçüm izni geri almaları ve son finansal mutabakat tekrar uygulanmalı; bu tercihler eski yedekten yeniden etkinleştirilmemelidir. Sağlayıcı düzeyinde geri dönüş, gerçek üretim verisiyle kurtarma ve kesinti tatbikatı ayrıca doğrulanmalıdır.

## Gözetimsiz çalıştırma

Site yayımlandıktan sonra kendi Site eklentisinin dört aracı bağlanır. Önce durum aracı, sonra bakım yazarı ve kaydedilen işlem geçmişi kontrol edilmelidir. Kaynağı okumak veya takvim kaydetmek, yazarı çalıştırmak değildir. Aynı yetkili Site bağlantısını kullanarak günlük bakım + yedek ve haftalık final sonrası bakım kurulabilir. Kimlik veya anahtarları görev metnine ekleme. Sonraki kontrol, bir zamanlanmış çalışmanın gerçekten kaydedildiğini ve yedeğin geri okunabildiğini doğrulamalıdır. Panel bu bağımsız gözlem olmadan `schedulerVerified` değerini doğruya çevirmez.

## 3 Kasım 2026 bağlantı düzeltmesi

MCP çağrılarında standart `params._meta` desteklenir; bu alan kimlik/yetki kaynağı değildir. Boş argümanlar protokole uygun olarak atlanabilir. Yedek sorgusu workerd birleşik SELECT sınırına takılmadan, skaler ölçümlerle yine tek SQL okumasında çalışır. `node tests/worker-recovery.mjs` gerçek yerel workerd/D1/R2 ve sentetik kayıtlarla şifreleme, geri okuma ve tekrar çalıştırmayı denetler. Üretim verileri bu teste kopyalanmaz.

## Kaydedilen takvim

3 Kasım 2026 itibarıyla günlük bakım ve şifreli yedek görevi Europe/Istanbul saat diliminde 03.30 için etkin olarak kaydedildi. Yetkili bakım yazarı, canlı yedek oluşturma ve ikinci geri okuma aynı Site bağlantısıyla doğrulandı. İlk zamanlanmış çalışmanın gerçekleşmesi ayrıca gözlenmelidir; görev kaydı bunu kanıtlamaz. Bu görev, saniyelik final zamanlayıcısı değildir.
