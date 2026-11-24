# Saha112 / Saha — Yeni arayüz 1.0.0

Mobil öncelikli, çevrimdışı çalışabilen eğitim ve hızlı hatırlatma rehberi.

- Kaynak: https://github.com/mehmetyildiz03/gith/commit/3dd70de767aeb9d55dd64cd30cc6d215b975358b (V0.59.10)
- Klinik veri: kaynakla aynı Git blob SHA `ed6f8af231e4faa434006c26ee05fcf15eb1089b`; dozlar, kaynaklar, klinik kapsam ve yetki mantığı değiştirilmedi.
- Arayüz: bağımsız 1.0.0 tasarım katmanı, CSS Grid, responsive layout, dokunma hedefleri, açık/koyu tema ve azaltılmış hareket.
- Kaynak uygulama motoru ve klinik QA korunmuştur. Çocuk/doğum-yenidoğan kaynakta QA beklediği için erişime kapalıdır.
- GitHub Pages: Actions üzerinden veya main/root statik yayın; PWA cache ve ayarlar eski uygulamadan izoledir.
- Resmî uygulama değildir; saha talimatı veya bağımsız klinik karar aracı olarak kullanılmamalıdır.

## Kontrol
```sh
python3 scripts/build_icons.py
node --check cases-data.js
node --check app-core.js
node --check sw.js
node scripts/validate.mjs
node scripts/ui-audit.mjs
node scripts/design-audit.mjs
```

Kaynak geçmişi: [SOURCE-HISTORY.md](SOURCE-HISTORY.md).

## Tarayıcı testi ve yayın
GitHub Pages ayarındaki **Source → GitHub Actions** seçimi, doğrulama başarılı olmadan yayın yapılmamasını sağlar. Main/root ile de statik dosyalar açılır ancak o modda test kapısı yayın için zorunlu değildir.

Node.js 24 ve Playwright 1.65.1 yalnız geliştirme/QA ortamında kullanılır. Ürün çalışırken npm veya CDN bağımlılığı yoktur. Tarayıcı testi mobil ve masaüstü arama, vaka detayı, favori, tema, Hızlı Saha, kaynak penceresi ve çevrimdışı yeniden yükleme davranışını doğrular; ekran görüntülerini Actions artifact olarak kaydeder.

```sh
npm install --no-save --no-package-lock playwright@1.65.1
npx playwright install chromium
node scripts/browser-smoke.mjs
```
