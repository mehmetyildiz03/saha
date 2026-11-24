# Saha112 / Saha — Yeni arayüz 3.1.0

Mobil öncelikli, çevrimdışı çalışabilen eğitim ve hızlı hatırlatma rehberi.

- Kaynak: https://github.com/mehmetyildiz03/gith/commit/3dd70de767aeb9d55dd64cd30cc6d215b975358b (V0.59.10)
- Klinik veri: kaynakla aynı Git blob SHA `ed6f8af231e4faa434006c26ee05fcf15eb1089b`; dozlar, kaynaklar, klinik kapsam ve yetki mantığı değiştirilmedi.
- Arayüz: bağımsız 3.1.0 ekran mimarisi, CSS Grid, responsive layout, dokunma hedefleri, açık/koyu tema ve azaltılmış hareket.
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

## Saha 2.0
Keşfet, Kütüphane ve Kaydedilenler ayrı ekranlar; kategori kutuları, masaüstü sol navigasyon, mobil yüzen menü, yeni vaka ızgarası, vektör simgeleri ve zaman çizgisi tarzında kritik adımlar. Klinik veri ve algoritma/yetki gösterim mantığı korunmuştur.

### V3.1.0
390px mobil taşma için başlık ve ızgara intrinsic sizing düzeltmesi; sürüm üst marka alanında görünür. Tarayıcı overflow kontrolü korunmuş, hata tanısı genişletilmiştir.

## V3.1.0 — full clinical workspace
The legacy stylesheet remains in git as a historical reference but is not loaded, cached or published. The new standalone design covers every screen, case and protocol, nested branches, medication/dose panels, source and permission semantics, light/dark and field mode. Existing clinical source bytes and clinical rendering logic retained. Browser acceptance covers every case and both protocols in mobile and desktop, both themes, and checks overflow in standard/field modes. Old exact CSS snapshot assertions were replaced with current design contracts; clinical and runtime assertions retained.

### V3.1.0
Field mode section order is now explicitly synchronized in DOM and CSS; screen reader and visual order agree. Real browser test retains computed-style assertions and adds DOM and geometry checks.

## V3.1.0 — interactive clinical flow explorer
Source branches are selectable, nested navigation supports back/reset/full-map and preserves selected ancestors. Binary case and protocol decisions support Evet/Hayır, back and full view. Common steps, warnings, medications and source references remain available independently. No clinical eligibility, treatment or branching rules are synthesized. State is transient per history entry and restored on returning from nested protocol. The source blob remains unchanged.
