<div align="center">

<img src="docs/assets/img/og-image.png" alt="FollowLens — biri sizi takipten çıktı. Ama kim?" width="820">

# FollowLens

**Sizi geri takip etmeyenleri — ve sessizce takipten çıkanları görün.**
Instagram ve GitHub. Tamamen kendi cihazınızda: sunucu yok, hesap yok, analitik yok.

[![CI](https://github.com/mtvrkan/followlens/actions/workflows/ci.yml/badge.svg)](https://github.com/mtvrkan/followlens/actions/workflows/ci.yml)
[![Lisans: MIT](https://img.shields.io/badge/Lisans-MIT-8b5cf6.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4f46e5.svg)](src/manifest.ts)
[![Testler](https://img.shields.io/badge/testler-351%20ge%C3%A7iyor-16a34a.svg)](https://github.com/mtvrkan/followlens/actions/workflows/ci.yml)

[**Web sitesi**](https://followlens.mtvrkan.com) · [**Kurulum**](INSTALL.tr.md) · [**Gizlilik politikası**](PRIVACY.md) · [**Değişiklikler**](CHANGELOG.md) · **[English](README.md)**

</div>

---

Instagram size sayıyı verir. FollowLens isimleri.

Açtığınız takipçi ve takip listelerini okur, tarayıcınızda saklar ve ikinci taramadan itibaren tam olarak neyin değiştiğini gösterir. Gönderecek bir sunucu yok — bu projede hiçbir arka uç bulunmuyor.

## Neler elde edersiniz

**Kim takipten çıktı** — bir tarama kaydedin; sonraki her tarama platformun cevaplamadığı soruyu cevaplar: kim ayrıldı, kim yeni, kim hiç geri takip etmedi, kim karşılıklı.

**Otomatik toplama** — tek tıkla listeyi sizin yerinize gezer. Sayfadaki rozet süre boyunca ilerlemeyi gösterir, Durdur her an çalışır. Hiçbir şey kendiliğinden başlamaz.

**Açabildiğiniz her profil** — kendi hesabınız ya da listeleri size zaten açılan herhangi bir profil. Sizin okuyamayacağınız bir listeyi o da okuyamaz.

**Eksikler konusunda dürüst** — platformun başlıktaki sayısı, liste ucunun hiç döndürmediği hesapları içerebilir. FollowLens topladığını beklenene karşı gösterir ve eksik olduğunu bildiği bir listeyi tam saymaz.

**Geçmiş ve karşılaştırma** — büyüme grafiği, tarama başına değişim, daraltılabilir tarih aralığı ve herhangi iki taramayı iki yönde yan yana.

**Dışa aktarma** — CSV, JSON, yazdırılabilir HTML rapor, PDF veya başka bir makinede geri yüklenen tam yedek.

**Çoklu hesap** — Instagram ve GitHub, istediğiniz kadar hesap, her biri kendi ayrı geçmişiyle.

**On dil** — en · tr · de · es · fr · pt-BR · ru · ja · zh-CN · ar, sağdan sola yazım dahil. Açık, koyu ve sistem teması.

## Nasıl çalışır

1. **Bir profil açın** — kendinizinki ya da listeleri size zaten açılan herhangi biri.
2. **FollowLens'e tıklayıp Başlat'a basın.** Liste sizin yerinize açılır ve sonuna kadar gezilir. Sayfadaki rozet ilerlemeyi gösterir, Durdur her an çalışır.
3. **Taramayı kaydedin.** İlk tarama referansınız olur. Sonraki her tarama, platformun cevaplamadığı soruyu cevaplar.

## Gizlilik

Her şey tarayıcınızda kalır — IndexedDB ve `chrome.storage.local`. Hesap yok, giriş yok, analitik yok, telemetri yok. Taramalarınız siz sildiğinizde silinir, eklentiyi kaldırmak da onları beraberinde götürür.

FollowLens'in yaptığı tek istekler zaten açık olduğunuz platforma gider. [PRIVACY.md](PRIVACY.md) bunların her birini ve neden var olduklarını listeliyor (İngilizce).

Yalnızca okur. Sizin adınıza paylaşım yapan, takip eden, takipten çıkan, beğenen veya mesaj gönderen hiçbir kod yolu yoktur.

## Kurulum

FollowLens **[Chrome Web Mağazası'nda](https://chromewebstore.google.com/detail/jpejnlkciiphkcnlncljikpgekbcglfl)**. Bunun yerine kaynaktan derlemek yaklaşık bir dakika sürüyor — **[INSTALL.tr.md](INSTALL.tr.md)** dosyasına bakın.

Chrome ve Brave üzerinde test edildi.

## Neden TikTok ve X yok

İkisi de destekleniyordu, ikisi de kaldırıldı. X, kısa takipçi listelerini algoritmik "kimi takip etmeli" önerileriyle dolduruyordu ve yanıt içinde bunları gerçek kayıtlardan güvenilir biçimde ayıran hiçbir şey yoktu. TikTok'un işleyen tek yolu, her isteğini karmaşıklaştırılmış ve sık değişen bir şemayla imzalayan bir API'yi dinlemekti.

İkisi de güvenilecek takipçi verisi üretemiyordu ve yanlış bir "geri takip etmiyor" cevabı, hiç cevap vermemekten kötüdür.

## Daha fazlası

- [INSTALL.tr.md](INSTALL.tr.md) — kurulum, güncelleme, kaldırma ve geliştirme ortamı
- [CONTRIBUTING.md](CONTRIBUTING.md) — mimari, ev kuralları, yeni platform ekleme (İngilizce)
- [PRIVACY.md](PRIVACY.md) — neyin saklandığı ve eklentinin yaptığı her istek (İngilizce)
- [DECISIONS.md](DECISIONS.md) — bariz olmayan kararlar ve neden öyle verildikleri (İngilizce)
- [CHANGELOG.md](CHANGELOG.md) — neyin yayınlandığı (İngilizce)
- [docs/](docs/README.md) — açılış sayfası
- [SITE-NOTES.md](SITE-NOTES.md) — açılış sayfası neden böyle kurulu (İngilizce)

## Lisans

[MIT](LICENSE) © Mehmet Türkan ([mtvrkan](https://mtvrkan.com))
