# BilgiArena 1.2.0 doğrulama kaydı

31 Ekim 2026. versionCode 7, minSdk 26, targetSdk 36.

- 108 sunucu/API testi geçti. Eşit puan regresyonu, üç karma tur dağılımı, 200 oda katılımı, okuma yetkisinin skor için kullanılamaması, içerik sürümü/rapor sahipliği, destek/itiraz, ölçüm rızası, geçmiş sayfalama ve yerel geri yükleme kapsanır.
- 24 Android testi geçti. Altı oyunun ekranı, gizlilik, ilk deneme, banka taslağı, 0 TL ödül, bitmiş hak, erken gerçek kazanan, paylaşım sağlayıcısı ve erişilebilir antrenman süresi kapsanır.
- Android tam yayın lint: 0 hata. API 27 öncesi gezinme çubuğu teması ayrıldı. API 33+ geri hareketi platform callbacki ile; eski onBackPressed yalnız önceki sistemler için tutulur.
- Aynı yükleme sertifikasıyla APK ve AAB imzaları doğrulandı; debug olmayan 1.2.0/versionCode 7. Bundletool validate geçti.
- Üretim npm: 0 bulgu. Android yayın ağacı 65 Maven paketi: OSV 0 bulgu. Geliştirme npm ağacı: 1 orta önem düzeyli minimatch kaydı.
- Gerçek derleme ve test kaydı `../release/verification.json`; kapsam/kalanlar `../reports/iyilestirme-1.2.0-2026-10-31.md`.

Ekranlar Robolectric native grafik modunda 320/360 dp düzenlerde çizilir; fiziksel cihaz veya emülatör kurulum testi değildir. Etkileşimli tarayıcı önizlemesine ulaşılamadı. Gerçek Play/Integrity/AdMob/banka hesabı ve 200 fiziksel cihaz yük provası tamamlanmış sayılmaz. Nakit ve canlı reklam kapalıdır. Mağaza yükleme/onay yapılmadı.
