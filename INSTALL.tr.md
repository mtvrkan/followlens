# FollowLens kurulumu

[English](INSTALL.md) · [Türkçe]

## Chrome Web Mağazası'ndan

**[chromewebstore.google.com/detail/jpejnlkciiphkcnlncljikpgekbcglfl](https://chromewebstore.google.com/detail/jpejnlkciiphkcnlncljikpgekbcglfl)**

**Chrome** ve **Brave** üzerinde test edildi. Chromium'un geri kalanı büyük ihtimalle çalıştıracaktır; her tarayıcı "büyük ihtimalle" ile değil, gerçekten denendikten sonra bu listeye ekleniyor.

## Kaynaktan

Yaklaşık bir dakika sürüyor. [Node.js](https://nodejs.org) 20 veya üzeri gerekiyor.

```bash
git clone https://github.com/mtvrkan/followlens.git
cd followlens
npm ci
npm run build
```

Bu komut eklentiyi `dist/` klasörüne yazar. Ardından Chrome'da:

1. `chrome://extensions` adresini açın
2. Sağ üstten **Geliştirici modu**'nu açın
3. **Paketlenmemiş öğe yükle**'ye tıklayın
4. **`dist`** klasörünü seçin — depo kök dizinini değil

FollowLens simgesi araç çubuğunda belirir. Görünür kalmasını isterseniz sabitleyin.

**Eklenti `__MSG_appName__` olarak görünüyorsa** `dist` yerine depo kök dizinini seçmişsinizdir.

### Kaynaktan kurulumu güncelleme

```bash
git pull
npm ci
npm run build
```

Sonra `chrome://extensions` sayfasındaki FollowLens kartında yenileme okuna basın. Kayıtlı taramalarınıza yeniden derleme dokunmaz — onlar derleme çıktısında değil, tarayıcının kendi veritabanında, eklentiye bağlı olarak durur.

## Kaldırma ve verileriniz

Eklentiyi Chrome'dan kaldırmak sakladığı her şeyi siler: sunucuda bir kopya yoktur, çünkü sunucu yoktur. Kaldırmadan taramalarınızı temizlemek isterseniz **Ayarlar → Tüm verileri sil** aynı işi görür.

Önce geçmişinizi saklamak için **Ayarlar → Yedeği dışa aktar**'ı kullanın. Yedek, bu makinede ya da başka birinde, temiz bir kuruluma geri yüklenir.

## Geliştirme

```bash
npm run dev
```

CRXJS geliştirme sunucusunu anlık yenilemeyle başlatır. `dist/`'i yukarıdaki gibi yükleyin; siz düzenledikçe kendini yeniler.

| Komut | Ne yapar |
|---|---|
| `npm run verify` | Aşağıdakilerin hepsini, CI'ın çalıştırdığı sırayla. PR açmadan önce bunu kullanın. |
| `npm run build` | Tip kontrolü (`tsc -b`) + üretim derlemesi (Vite + CRXJS) |
| `npm test` | Vitest birim testleri — 351 test |
| `npm run lint` | ESLint (flat config, typescript-eslint + react-hooks) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check:site` | Üç açılış sayfasını da yükler, betiklerini çalıştırır, çevirileri ve dışarı giden istekleri denetler |
| `npm run dev` | Eklenti anlık yenilemeli geliştirme sunucusu |

Mimari, platform adaptörü katmanı ve değişiklikler için ev kuralları [CONTRIBUTING.md](CONTRIBUTING.md) dosyasında (İngilizce).

## Mağaza paketini oluşturma

```bash
npm ci && npm run build
```

Sonra `dist/` klasörünün **içeriğini** zipleyin — klasörün kendisini değil, yoksa `manifest.json` bir seviye aşağıda kalır ve yükleme reddedilir. Windows'ta PowerShell'in `Compress-Archive`'ini kullanmayın: arşiv içine `\` yol ayracı yazıyor ve ZIP biçimi buna izin vermiyor.
