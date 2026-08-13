/* FollowLens — site translations (English / Türkçe).
 *
 * The markup ships English so crawlers and social unfurlers get real text
 * without running scripts; Turkish is swapped in at runtime. A Turkish browser
 * lands on Turkish automatically, and the choice is remembered after that.
 *
 * Keys live on elements as data-i18n (written with textContent) and
 * data-i18n-html (written with innerHTML, used only for the few strings that
 * carry markup the sentence would lose otherwise). An HTML entity inside a
 * data-i18n string renders as its literal characters — write the character.
 *
 * The footer credit deliberately has no key. It is a signature, and a
 * signature reads the same in every language.
 */
(function () {
  'use strict';

  var TR = {
    // ── Page metadata ────────────────────────────────────────────────────
    // The tab title, mainly: a Turkish reader should not be looking at an
    // English tab. Kept keyword-bearing rather than clever, since this is the
    // one string that also has to work in a search result.
    'meta.title': 'FollowLens — Instagram ve GitHub’da Sizi Takipten Çıkanları Görün',
    // Held to the same ~160-character budget as the English above, for the
    // same reason: past that a search result just cuts the sentence off.
    'meta.desc': 'Instagram size sayıyı verir, FollowLens isimleri: kim takipten çıktı, kim yeni geldi, kim geri takip etmiyor. Kendi hesabınız ya da açabildiğiniz her hesap.',
    'pp.metaTitle': 'Gizlilik Politikası — FollowLens',
    'pp.metaDesc': 'FollowLens’in sunucusu yoktur. Topladığı hiçbir veri cihazınızdan çıkmaz. Bu politika, o iki cümlenin ayrıntısıdır.',
    'nf.metaTitle': 'Sayfa bulunamadı — FollowLens',

    'a.skip': 'İçeriğe geç',

    // ── Nav ──────────────────────────────────────────────────────────────
    'nav.plat': 'Platformlar',
    // Short on purpose: the header island has a fixed width and the full
    // phrase ("Kim kimi takip ediyor") wrapped to two lines there.
    'nav.stalk': 'Başkaları',
    'nav.how': 'Nasıl çalışır',
    'nav.dash': 'Uygulama',
    'nav.privacy': 'Gizlilik',

    // ── Hero ─────────────────────────────────────────────────────────────
    'hero.h1a': 'Biri seni takipten çıktı.',
    'hero.h1b': 'Peki kim?',
    'hero.lede': 'Bir kez tara. Sonraki her tarama sana isimleri verir: kim gitti, kim geldi, kim geri takip etmiyor. Instagram ve GitHub’da, tamamen kendi cihazında.',
    'hero.cta1': 'Ücretsiz kur',
    'hero.cta2': 'Kodu incele',
    'hero.n1': 'Açık kaynak',
    'hero.n2': 'Hesap yok',
    'hero.n3': 'Hiçbir veri cihazından çıkmıyor',
    'hero.cPosts': 'gönderi',
    'hero.cFollowers': 'takipçi',
    'hero.cFollowing': 'takip',
    'hero.verdict': 'kişi seni takipten çıktı',
    'hero.vsubA': 'FollowLens',
    'hero.vsubB': ' taramasıyla karşılaştırdı',

    // ── 01 · Sorun ───────────────────────────────────────────────────────
    'why.label': 'SORUN',
    'why.h2': 'Sayı değişir, isimler gizli kalır',
    'why.p': 'Instagram önce 1.284 gösterir, sonra 1.281. Üç kişi ayrılmıştır ve platform kimlerin ayrıldığını kaydetmez. FollowLens bu kaydı sizin için tutar.',
    'why.before': 'Platformun gösterdiği',
    'why.mystery': 'Üç kişi ayrıldı. İsim yok.',
    'why.after': 'FollowLens’in gösterdiği',

    // ── 02 · Platformlar ─────────────────────────────────────────────────
    'plat.label': 'İKİ PLATFORM',
    'plat.h2': 'Instagram ve GitHub’da eksiksiz çalışır',
    'plat.p': 'İki platform da ürünün tamamını alır: taramalar, karşılaştırmalar, analiz ve dışa aktarma. Yalnızca listelerin okunma biçimi değişir.',
    'plat.k1': 'Kaynak',
    'plat.k2': 'Sayfalama',
    'plat.k3': 'Not',
    'plat.igP': 'Instagram listelerini siz kaydırdıkça yükler; henüz ulaşmadığınız satırlar mevcut değildir. FollowLens listeyi açar, sonuna kadar yürür ve bir tur profilin kendi sayısının altında biterse baştan başlar.',
    'plat.igF1': 'Takipçi ve takip penceresi ile sitenin kendi liste yanıtları',
    'plat.igF2': 'Otomatik kaydırma; daha hızlı yol olarak sitenin kendi liste ucu',
    'plat.igF3': 'Sayfalama deterministik değildir. Tek tur gerçek takipçileri atlayabilir, bu yüzden liste yeniden yürünür.',
    'plat.ghP': 'GitHub listelerini sunucuda üretir ve “Sonraki” bağlantısıyla sayfalar. FollowLens bu bağlantıyı sayfa sayfa izler, mümkün olduğunda GitHub’ın açık REST API’sini kullanır.',
    'plat.ghF1': 'Sayfadaki takipçi ve takip sekmeleri, yalnızca listenin kendisiyle sınırlı',
    'plat.ghF2': 'Listenin kendi “Sonraki” bağlantısı ya da api.github.com. Oturum gerekmez.',
    'plat.ghF3': 'Başlık ve alt bilgideki profil bağlantıları da tıpkı liste satırları gibi bir avatarın yanında durur. Bunlar dışarıda bırakılır.',

    // ── 03 · Kim kimi takip ediyor ───────────────────────────────────────
    'stalk.label': 'SADECE KENDİ HESABIN DEĞİL',
    // The visible headline is a rotating word on its own line and a static
    // second line. Neither half is read aloud on its own — this names all five
    // in one sentence instead.
    'stalk.srLine': 'Eski sevgiliniz, hoşlandığınız kişi, o arkadaşınız, patronunuz ya da iş rakibiniz bu hafta yeni birini takip etti mi?',
    // Kept close in length on purpose: the rotator reserves its widest word so
    // the headline cannot reflow, which means a short word sits in a visibly
    // wide gap. These run 10–18 characters instead of 7–13. "hoşlandığınız
    // kişi" is the widest and sets that reserved width single-handedly — it is
    // also the one the whole section is really about, so it earns the space.
    // Capitalised: with "Peki" gone each of these now opens the sentence.
    // "İş", with the dotted capital — Turkish, not "Is".
    'stalk.w1': 'Eski sevgiliniz',
    'stalk.w2': 'Hoşlandığınız kişi',
    'stalk.w3': 'O arkadaşınız',
    'stalk.w4': 'Patronunuz',
    'stalk.w5': 'İş rakibiniz',
    'stalk.post': 'bu hafta yeni birini takip etti mi?',
    'stalk.sub': 'FollowLens hangi profil açıksa onu tarar; hesabın size ait olması gerekmez. Size zaten açılan herhangi bir profile yöneltin — herkese açık ya da takip ettiğiniz gizli bir hesap — o hesabı da kendinizinki gibi izler: kimi takibe almış, kimi bırakmış, kim onu terk etmiş.',
    // The three cards sit side by side, so they are written to roughly the
    // same length in both languages — a two-line card next to a five-line one
    // leaves a hole in the row that reads as a layout fault.
    'stalk.c1t': 'Açabildiğiniz her hesap',
    'stalk.c1p': 'Profil size açılıyorsa taranır: herkese açık her hesap ya da takip ettiğiniz gizli bir hesap. Başlat’a basın, kendi geçmişi olan bir hesaba dönüşsün.',
    'stalk.c2t': 'Kimi eklemiş',
    'stalk.c2p': 'İki tarama arasında farkı alınan takip listesi. Geçen sefer orada olmayan isimler, o tarihten bu yana takibe aldıklarının tam kendisidir; sırasıyla.',
    'stalk.c3t': 'Kim onu bırakmış',
    'stalk.c3p': 'Aynı matematik ters yönde, takipçilerinde: geçen sefer orada olan, şimdi olmayan isimler. Yani o tarihten bu yana onu bırakanların tamamı.',
    'stalk.scan1': 'İlk tarama',
    'stalk.scan2': 'Bugün',
    'stalk.following': 'takip',
    'stalk.followers': 'takipçi',
    'stalk.added': 'ekledi',
    'stalk.dropped': 'bıraktı',
    'stalk.baseline': 'Henüz karşılaştırılacak bir şey yok. Bu tarama referans olarak alınır.',
    'stalk.note': 'Sekiz gün arayla iki tarama. Aradaki fark, özelliğin tamamıdır.',
    'stalk.fine': 'Eklenti tam olarak sizin oturumunuzun gördüğünü görür: herkese açık bir liste ya da zaten erişiminiz olan gizli bir hesabınki. Size açılmayan bir liste ona da açılmaz. Hiçbir veri hiçbir yere gönderilmez ve taradığınız profile bildirim gitmez, çünkü bildirimi gönderecek bir sunucu yoktur.',

    // ── 04 · Nasıl çalışır ───────────────────────────────────────────────
    'how.label': 'NASIL ÇALIŞIR',
    'how.h2': 'İlk taramanız için üç adım',
    'how.p': 'Hiçbir şey kendiliğinden çalışmaz. Profili siz açarsınız, taramayı siz başlatırsınız, siz kaydedersiniz.',
    // The extension opens the list itself — instagramAdapter.openList clicks
    // the stat control, githubAdapter.openList navigates to ?tab=. Telling
    // people to find the list first described a step they never take.
    'how.s1t': 'Bir profil açın',
    'how.s1p': 'Kendinizinki ya da size zaten açılan herhangi biri; giriş yapmış olduğunuz oturumda. Listeyi aramanıza gerek yok — takipçi ya da takip listesini Otomatik Toplama kendisi açar.',
    'how.s2t': 'Başlat’a basın',
    'how.s2p': 'Otomatik Toplama listeyi sizin yerinize gezer. Sayfadaki rozet ilerlemeyi gösterir ve istediğiniz an durdurursunuz.',
    'how.s3t': 'Taramayı kaydedin',
    'how.s3p': 'İlk tarama referansınız olur. Sonraki her tarama, platformun cevaplamadığı soruyu cevaplar.',
    'how.scanning': 'Toplanıyor',
    'how.stop': 'Durdur',

    // ── 05 · Ne görürsün ─────────────────────────────────────────────────
    'res.label': 'NE GÖRÜRSÜN',
    'res.h2': 'Dört cevap, her biri tek tık',
    'res.p': 'Her kategori tek tık uzakta, her satır profili açar.',
    'res.t1': 'Geri takip etmiyor',
    'res.t2': 'Takipten çıktı',
    'res.t3': 'Yeni takipçi',
    'res.t4': 'Karşılıklı',
    'res.pillNew': 'Yeni takipçi',
    'res.pillLeft': 'Takipten çıktı',

    // ── 06 · Uygulama ────────────────────────────────────────────────────
    'dash.label': 'UYGULAMA',
    'dash.h2': 'Açılır pencere değil, tam bir panel',
    'dash.p': 'Açılır pencere taramayı başlatır ve ana sayıları gösterir. Gerisi kendi kenar çubuğu olan tam bir sayfada yaşar: taramalar, karşılaştırma ve analiz.',
    'dash.t1': 'Takipçi listesi',
    'dash.p1': 'Bu taramaya ait beş sayı ve her birinin arkasındaki liste.',
    'dash.t2': 'Detaylı analiz',
    'dash.p2': 'Tüm taramalar boyunca büyüme grafiği, daraltabildiğiniz bir tarih aralığında.',
    'dash.t3': 'Karşılaştır',
    'dash.p3': 'Herhangi iki tarama yan yana, iki yönde de.',
    'dash.t4': 'Tarama geçmişi',
    'dash.p4': 'Kaydettiğiniz her tarama, hangi kalitede toplandığıyla birlikte.',
    // Taken verbatim from the extension's own src/locales/tr.json, so the
    // mock window is labelled exactly the way the product is.
    // The mock window's own title bar. "followlens" is the product, so it
    // stays; only the word for what is open in it is translated.
    'dash.win': 'followlens · panel',
    'dash.sPlatform': 'Platform seçin',
    'dash.sAccount': 'Hesap seçin',
    'dash.sScans': 'Taramalar',
    'dash.tabList': 'Takipçi Listesi',
    'dash.tabAnalysis': 'Detaylı Analiz',
    'dash.tabOverview': 'Genel Bakış',
    'dash.tabCompare': 'Karşılaştır',
    'dash.kFollowers': 'Toplanan Takipçi',
    'dash.kNfb': 'Geri Takip Etmeyenler',
    'dash.kLost': 'Takipten Çıkanlar',
    'dash.chartTitle': 'Takipçi geçmişi',

    // ── 07 · Tarama kalitesi ─────────────────────────────────────────────
    'q.label': 'DÜRÜSTLÜK',
    'q.h2': 'Tarama eksik kaldığında size söyler',
    'q.p': 'Platformun başlıktaki sayısı, liste ucunun hiç döndürmediği hesapları da içerebilir; kısıtlanmış ya da kapatılmış olanları. Yukarı yuvarlayan bir takipçi uygulaması yanlış bir “geri takip etmiyor” listesi üretir ve bunu asla kabul etmez.',
    'q.p2': 'FollowLens topladığını beklenene karşı gösterir ve eksik olduğunu bildiği bir listeyi tam saymaz.',
    'q.panel': 'Tarama kalitesi',
    'q.verdict': 'İyi, eksiği var',
    'q.collected': 'toplandı',
    'q.expected': 'beklenen',
    'q.note': 'Bu profilin bildirdiği 1.284 kişiden 1.281’i toplandı. Liste tam yüklenmiş görünmüyor: API’nin hiç döndürmediği üç hesap var.',

    // ── 08 · Analiz ──────────────────────────────────────────────────────
    'ana.label': 'ANALİZ',
    'ana.h2': 'Her tarama geçmişinizi büyütür',
    'ana.p': 'Büyüme grafiği, her taramadaki değişim, daraltabildiğiniz bir tarih aralığı ve aldığınız herhangi iki taramanın yan yana karşılaştırması.',
    'ana.f1t': 'Herhangi ikisini karşılaştır',
    'ana.f1p': 'İki tarih seçin, aralarında tam olarak neyin değiştiğini iki yönde de görün.',
    'ana.f2t': 'Birden fazla hesap',
    'ana.f2p': 'Her biri ayrı izlenir; her iki platformda da kendi geçmişi ve etiketleriyle.',
    'ana.f3t': 'Yok sayma listesi',
    'ana.f3p': 'Görmek istemediğiniz hesapları taramayı silmeden gizleyin.',
    'ana.chart': 'Takipçi geçmişi',

    // ── 09 · Dışa aktarma ────────────────────────────────────────────────
    'exp.label': 'DIŞA AKTARMA',
    'exp.h2': 'Verilerinizi dört biçimde dışa aktarın',
    'exp.p': 'Dört biçim, seçtiğiniz sütunlar, kendi dilinizde. Büyüme grafiğini içeren yazdırılabilir bir rapor ve tüm geçmişi başka bir makinede geri yükleyen tam JSON yedeği de dâhil.',
    'exp.p2': 'Dışa aktarma aynı zamanda buradan çıkış yolu. Kalmanız için tutulan hiçbir şey yok: JSON yedeği geçmişinizin tamamıdır, başka bir makinede geri yüklenir ve eklentiyi sildiğiniz gün de okunabilir kalır. Verinizin sahibi olan bir uygulama onu bu kadar kolay teslim etmez.',
    'exp.csv': 'Excel’de düzgün açılır',
    'exp.json': 'Her şey, düzleştirilmeden',
    'exp.html': 'Grafiğiyle birlikte rapor',
    'exp.pdf': 'Doğrudan yazdırmaya',

    // ── 10 · Gizlilik ────────────────────────────────────────────────────
    'priv.label': 'GİZLİLİK',
    'priv.h2': 'Gönderecek bir sunucu yok',
    'priv.p': 'FollowLens’in arka ucu, analitiği ve hesap sistemi yoktur. Taramalarınız tarayıcınızın kendi veritabanında durur ve yaptığı tek istek, zaten açık olduğunuz platforma gider.',
    'priv.c1b': 'Asla parola istemez.',
    'priv.c1': 'Zaten giriş yapmış olduğunuz oturumda, yalnızca sizin açtığınız profilin listelerini okur.',
    'priv.c2b': 'Sadece okur.',
    'priv.c2': 'Sizin adınıza asla paylaşım yapmaz, takip etmez, takipten çıkmaz, mesaj göndermez.',
    'priv.c3b': 'Siz başlatırsınız.',
    'priv.c3': 'Toplama bir tıkla başlar, çalışırken rozet gösterir ve siz dediğiniz an durur.',
    'priv.c4b': 'Siz bitirirsiniz.',
    'priv.c4': 'Tek bir hesabın geçmişini silin ya da her şeyi temizleyin. Başka hiçbir yerde kopyası kalmaz.',
    'priv.linkPre': 'Yaptığı her istek yazılı, o istekleri yapan kod herkese açık.',
    'priv.link': 'Gizlilik politikasını okuyun',
    'priv.device': 'Senin cihazın',
    'priv.blocked': 'bayt dışarı',

    // ── 11 · Neden diğerleri değil ───────────────────────────────────────
    'cmp.label': 'ALTERNATİF',
    'cmp.h2': 'FollowLens’i ayıran ne',
    'cmp.p': 'Ücretsiz takipçi uygulamalarının çoğu parolanızı ister, listenizi göremediğiniz bir sunucuya yükler ve cevabın bulanıklığını kaldırmak için ücret alır. O iş modelinin verinize ihtiyacı vardır. FollowLens’in bir iş modeli yoktur.',
    'cmp.cap': 'Belirli bir ürünle değil, o uygulamaların ortak kalıbıyla karşılaştırma.',
    'cmp.them': 'Alışıldık takipçi uygulaması',
    'cmp.r1': 'Parola ister mi',
    'cmp.r1a': 'Asla. Giriş diye bir şey yok.',
    'cmp.r1b': 'Genelde ister, ya da OAuth anahtarı',
    'cmp.r2': 'Listeniz nereye gider',
    'cmp.r2a': 'Tarayıcınızın kendi veritabanına',
    'cmp.r2b': 'Onların sunucusuna, süresiz saklanır',
    'cmp.r3': 'Cevabın bedeli',
    'cmp.r3a': 'Tamamı ücretsiz',
    'cmp.r3b': 'Abone olana kadar bulanık',
    'cmp.r4': 'Tarama eksik kalınca',
    'cmp.r4a': 'Söyler, ne kadar eksik olduğuyla',
    'cmp.r4b': 'Listeyi yine de gösterir',
    'cmp.r5': 'Denetlenebilir mi',
    'cmp.r5a': 'MIT, her satırı GitHub’da',
    'cmp.r5b': 'Kapalı ve küçültülmüş',



    // ── 14 · SSS ─────────────────────────────────────────────────────────
    'faq.label': 'SSS',
    'faq.h2': 'Sık sorulan sorular',
    'faq.q1': 'Parolam gerekiyor mu?',
    'faq.a1': 'Hayır, girecek bir yer de yok. FollowLens’in hesap sistemi yoktur. Kendi giriş yapmış tarayıcı oturumunuzda açtığınız profillerin listelerini okur; bu yüzden yalnızca sizin görebildiğinizi görebilir.',
    'faq.q2': 'Bana ait olmayan bir hesabı izleyebilir miyim?',
    'faq.a2': 'Size açılıyorsa evet. FollowLens hangi profil açıksa onu tarar ve takipçi ya da takip listesini kendisi bulur; herkese açık bir profil ya da zaten takip ettiğiniz gizli bir hesap, kendi geçmişi, karşılaştırmaları ve dışa aktarmalarıyla izlenen bir hesaba dönüşür. Size açılmayan bir hesabı ise eklenti de okuyamaz.',
    'faq.q3': 'GitHub’da da çalışıyor mu?',
    'faq.a3': 'Evet, üstelik sonradan eklenmiş bir özellik olarak değil. GitHub, Instagram’la aynı taramaları, karşılaştırmaları, analizi ve dışa aktarmayı alır. FollowLens sunucuda üretilen takipçi ve takip sekmelerini okur ve oturum gerektirmeyen açık REST API’yi tercih eder.',
    'faq.q4': 'Platform kullandığımı anlar mı?',
    'faq.a4': 'Otomatik Toplama, sizin kaydırmanızın ürettiği isteklerin aynısını üretir; sabit bir tempoyla değil, düzensiz aralıklarla. Yine de otomatik toplama bir platformun kullanım koşullarıyla çelişebilir; bu yüzden FollowLens onu isteğe bağlı, görünür ve durdurulabilir tutar. Karar sizindir.',
    'faq.q5': 'Tarama neden bazen birkaç hesap eksik çıkıyor?',
    'faq.a5': 'Platformun başlıktaki sayısı, liste ucunun hiç döndürmediği hesapları içerebilir; kısıtlanmış ya da kapatılmış olanları. FollowLens yukarı yuvarlamak yerine topladığını beklenene karşı gösterir ve listenin tam yüklenmediğini söyler.',
    'faq.q6': 'Verilerim tam olarak nerede duruyor?',
    'faq.a6': 'Taramayı yaptığınız makinede, tarayıcınızın IndexedDB’sinde. Sunucu, eşitleme ve hesap yoktur; bu da şu demek: dizüstünüzde aldığınız bir tarama, siz dışa aktarıp taşımadıkça telefonunuzda görünmez.',
    'faq.q7': 'Gerçekten ücretsiz mi?',
    'faq.a7': 'Evet, üstelik MIT lisanslı. Ücretli sürüm, üst paket satışı ve satılacak telemetri yoktur. İşinize yaradıysa GitHub’da bir yıldız, iş modelinin tamamıdır.',

    // ── Kapanış ──────────────────────────────────────────────────────────
    'end.h2': 'Kimin ayrıldığını öğrenin.',
    'end.p': 'Kurun, bir kez tarayın; sonraki tarama cevabı versin.',
    'end.ctaStore': 'Chrome’a ekle — ücretsiz',
    'end.cta2': 'GitHub’da yıldızla',
    'end.noteA': 'Chrome ve Brave. Hesap yok; okuduğu iki sitenin dışında izin de yok.',
    'end.noteB': 'Ya da kaynaktan kurun',


    // ── Gizlilik politikası sayfası ──────────────────────────────────────
    'pp.back': 'Ana sayfaya dön',
    'pp.title': 'Gizlilik Politikası',
    'pp.updated': 'Son güncelleme: 13 Ağustos 2026',
    'pp.lead': 'FollowLens’in sunucusu yok. Toplanan hiçbir veri cihazından çıkmaz. Bu politikanın tamamı, bu iki cümlenin ayrıntısıdır.',
    'pp.h1': 'Ne topluyoruz',
    'pp.p1': 'Hiçbir şey — bizim tarafımızda. FollowLens’in arka ucu, analitiği, çökme raporlaması ve hesap sistemi yok. Bir tarama başlattığında toplanan takipçi ve takip listeleri, tarayıcının kendi IndexedDB veritabanına, senin cihazına yazılır ve orada kalır.',
    'pp.h2': 'Cihazında ne saklanıyor',
    'pp.i1b': 'Takipçi ve takip listeleri',
    'pp.i1': '— taradığın hesaplar için kullanıcı adı, görünen ad, avatar bağlantısı ve onaylı/gizli işaretleri.',
    'pp.i2b': 'Tarama geçmişi',
    'pp.i2': '— her taramanın zamanı, sayıları ve toplandığı kalite.',
    'pp.i3b': 'Tercihlerin',
    'pp.i3': '— dil, tema, yok sayma listesi ve dışa aktarma seçenekleri.',
    'pp.h3': 'İzinler ve neden gerekli',
    'pp.i4b': 'instagram.com ve github.com erişimi',
    'pp.i4': '— bu sitelerde açtığın takipçi ve takip listelerini okumak için gerekli. FollowLens yalnızca bu iki platformda çalışır, başka hiçbir yerde.',
    'pp.i5b': 'storage',
    'pp.i5': '— taramaları ve ayarları cihazında saklamak için. Tarayıcı eşitlemesi kullanılmaz.',
    'pp.i6b': 'scripting ve activeTab',
    'pp.i6': '— sen Başlat’a bastığında toplama betiğini açık olan sekmeye enjekte etmek için. Arka planda hiçbir sekmeye kendiliğinden enjekte edilmez.',
    'pp.h4': 'Ağ istekleri',
    'pp.p4': 'FollowLens yalnızca zaten açık olduğun platforma istek yapar; senin kaydırmanın yapacağı isteklerin aynısını. Başka hiçbir adrese bağlanmaz. Üçüncü taraf betik, izleyici, piksel ya da yazı tipi CDN’i yoktur — ne eklentide ne de bu sitede; okuduğun yazı tipleri Google’dan değil, bu alan adından geliyor.',
    'pp.h5': 'Verini silmek',
    'pp.p5': 'Ayarlar’dan tek bir hesabın geçmişini silebilir ya da her şeyi temizleyebilirsin. Eklentiyi kaldırmak da tarayıcının bu eklentiye ait tüm depolamasını siler. Başka bir yerde kopyası olmadığı için silme işlemi kesindir.',
    'pp.h6': 'Çocuklar',
    'pp.p6': 'FollowLens 13 yaşın altındaki kullanıcılara yönelik değildir ve yaş bilgisi dâhil hiçbir kişisel veri toplamaz.',
    'pp.h7': 'Bu politikadaki değişiklikler',
    'pp.p7': 'Bu sayfa değişirse yukarıdaki tarih güncellenir. Politikanın geçmişi, sitenin geri kalanı gibi depoda açık şekilde durur.',
    'pp.h8': 'İletişim',
    'pp.p8': 'Sorularınız ya da gizlilikle ilgili bildirmek istedikleriniz için yazabileceğiniz adres:',

    // ── 404 ──────────────────────────────────────────────────────────────
    'nf.h1': 'Bu sayfa sizi takipten çıkmış.',
    'nf.p': 'Aradığınız adres burada değil. Geri kalan her şey tek tık uzakta.',
    'nf.cta': 'Ana sayfaya dön',
    'nf.cta2': 'SSS’yi okuyun'
  };

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ── The mock screenshots' dates and figures ──────────────────────────────
     Neither can be literal text. A month name written into the markup stays
     English beside Turkish prose, and a grouped figure written as 1,284 stays
     comma-grouped where the paragraph beside it already says 1.284.

     So both are declared as data and formatted in the language now on screen:

       data-date="-8"            days from today, 0 being today
       data-date-pad             two-digit day (04 rather than 4)
       data-date-time="14:20"    appended after a middot
       data-date-range="-8,0"    two offsets, joined with an arrow
       data-date-range-tight     print the month once when both share one
       data-num="1284"           a figure, grouped for the locale

     Offsets rather than fixed dates for the same reason the hero's "yesterday"
     is computed: a landing page still dated last August reads as abandoned.

     Case is left to CSS. .mono carries text-transform: uppercase, and because
     <html lang> is set below before this runs, the browser casts Turkish with
     Turkish rules — "Eki" becomes "EKİ", not "EKI", which no toUpperCase()
     without an explicit locale would get right. */

  function shiftDays(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return d;
  }

  function dayMonth(d, locale, padded) {
    try {
      return new Intl.DateTimeFormat(locale, {
        day: padded ? '2-digit' : 'numeric', month: 'short'
      }).format(d);
    } catch (e) {
      return (padded ? pad(d.getDate()) : d.getDate()) + '.' + pad(d.getMonth() + 1);
    }
  }

  function each(sel, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), fn);
  }

  function applyMockData(locale) {
    var num;
    try { num = new Intl.NumberFormat(locale); } catch (e) { num = null; }

    each('[data-date]', function (el) {
      var text = dayMonth(shiftDays(Number(el.dataset.date) || 0), locale,
        el.dataset.datePad != null);
      if (el.dataset.dateTime) text += ' · ' + el.dataset.dateTime;
      el.textContent = text;
    });

    each('[data-date-range]', function (el) {
      var parts = String(el.dataset.dateRange).split(',');
      var from = shiftDays(Number(parts[0]) || 0);
      var to = shiftDays(Number(parts[1]) || 0);
      var padded = el.dataset.datePad != null;
      // Both dates inside one month print the month once, the way a real date
      // range is written. Across a month boundary that would be ambiguous, so
      // the tight form quietly falls back to the full one.
      var left = el.dataset.dateRangeTight != null && from.getMonth() === to.getMonth()
        ? (padded ? pad(from.getDate()) : String(from.getDate()))
        : dayMonth(from, locale, padded);
      el.textContent = left + ' → ' + dayMonth(to, locale, padded);
    });

    if (!num) return;
    each('[data-num]', function (el) {
      el.textContent = num.format(Number(el.dataset.num) || 0);
    });
  }

  var STORAGE = 'fl-lang';
  var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-lang-btn]'));

  function collect() {
    return Array.prototype.slice.call(
      document.querySelectorAll('[data-i18n], [data-i18n-html], [data-i18n-content]'));
  }

  // Three ways to carry a key, because three things need translating and they
  // are not written the same way:
  //   data-i18n         → textContent. The default, and <title> works with it,
  //                       since document.title is that element's text.
  //   data-i18n-html    → innerHTML. Only for strings that carry markup.
  //   data-i18n-content → the content attribute, for <meta>. A description or
  //                       an og:title has no text node to write to.
  function keyOf(el) {
    if (el.dataset.i18nHtml != null) return ['html', el.dataset.i18nHtml];
    if (el.dataset.i18nContent != null) return ['content', el.dataset.i18nContent];
    return ['text', el.dataset.i18n];
  }

  // English lives in the markup, so it is captured once as the fallback rather
  // than duplicated into a second dictionary that could drift from the page.
  //
  // Except on /tr/, where the markup is already Turkish and the English
  // original was written into data-en by scripts/build-tr.mjs. Capturing there
  // would record Turkish as the English fallback and the toggle would have
  // nothing to switch back to — so an existing data-en is left alone. That one
  // guard is the whole reason this file runs unmodified on both pages.
  collect().forEach(function (el) {
    if (el.dataset.en != null) return;
    var mode = keyOf(el)[0];
    el.dataset.en = mode === 'html' ? el.innerHTML
      : mode === 'content' ? el.getAttribute('content')
      : el.textContent;
  });

  function apply(lang) {
    collect().forEach(function (el) {
      var kind = keyOf(el), mode = kind[0], key = kind[1];
      var value = lang === 'tr' ? TR[key] : el.dataset.en;
      if (value == null) return;
      // Only keys explicitly marked as markup go through innerHTML; everything
      // else is written as text or as an attribute, so a stray < in a
      // translation is inert.
      if (mode === 'html') el.innerHTML = value;
      else if (mode === 'content') el.setAttribute('content', value);
      else el.textContent = value;
    });

    // The hero card claims the previous scan was yesterday's, so the date has
    // to actually be yesterday's — a hardcoded one is wrong from the day after
    // it ships. Formatted in the language now on screen, so this re-runs on
    // every switch rather than once at load.
    var locale = lang === 'tr' ? 'tr-TR' : 'en-GB';
    var d = shiftDays(-1);
    Array.prototype.forEach.call(document.querySelectorAll('[data-yesterday]'), function (el) {
      el.dateTime = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      try {
        el.textContent = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(d);
      } catch (e) {
        el.textContent = el.dateTime;
      }
    });

    // Every other date and figure in the mocks, on the same terms.
    applyMockData(locale);

    document.documentElement.lang = lang;
    buttons.forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.langBtn === lang ? 'true' : 'false');
    });
    // Set pieces measure their own text, so they need to know it changed.
    document.dispatchEvent(new CustomEvent('fl:langchange', { detail: { lang: lang } }));
  }

  function pick() {
    // A page that declares its own language wins outright. /tr/ exists so that
    // an unfurler and a crawler get Turkish out of the raw HTML; if a stored
    // preference or a browser locale could then flip it to English on load, the
    // URL, the canonical, the hreflang and the card would all be saying one
    // thing and the page another.
    var baked = document.documentElement.getAttribute('data-lang');
    if (baked === 'tr' || baked === 'en') return baked;

    var saved = null;
    try { saved = localStorage.getItem(STORAGE); } catch (e) { /* private mode */ }
    if (saved === 'tr' || saved === 'en') return saved;
    return (navigator.language || 'en').toLowerCase().indexOf('tr') === 0 ? 'tr' : 'en';
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      var lang = b.dataset.langBtn;
      try { localStorage.setItem(STORAGE, lang); } catch (e) { /* private mode */ }
      apply(lang);
    });
  });

  apply(pick());
})();
