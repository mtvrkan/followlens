# Chrome Web Store Listing — FollowLens

Everything that has to be typed or uploaded into the developer dashboard, in
the order the dashboard asks for it. Copy from here rather than rewriting: the
descriptions below are the claims the review is checked against, and each one
is true of the build in this repository.

- [Basics](#basics)
- [Descriptions, per language](#descriptions-per-language) — en · tr · de · es · fr · pt-BR · ru · ja · zh-CN · ar
- [Privacy practices form](#privacy-practices-form)
- [Permission justifications](#permission-justifications)
- [Assets](#assets)
- [Screenshots — capture list](#screenshots--capture-list)
- [Submission checklist](#submission-checklist)

---

## Basics

| Field | Value |
| --- | --- |
| Name | FollowLens |
| Category | Social & Communication |
| Default language | English |
| Additional languages | Türkçe, Deutsch, Español, Français, Português (Brasil), Русский, 日本語, 简体中文, العربية |
| Version | 1.0.0 |
| Privacy policy URL | `https://followlens.mtvrkan.com/privacy.html` |
| Homepage / support URL | `https://followlens.mtvrkan.com/` · `https://github.com/mtvrkan/followlens/issues` |
| Pricing | Free, no in-app purchases |
| Contains ads | No |

**Name and short description are not entered in the dashboard.** They come from
`public/_locales/<locale>/messages.json` (`appName`, `appDesc`) via the
manifest's `__MSG_` references, so the store shows each user the one matching
their browser language. The detailed description, screenshots and tiles below
*are* entered per language in the dashboard.

### Single purpose

> Read the follower and following lists the user opens on Instagram and GitHub,
> store them in the browser's own local database, and show what changed between
> one saved scan and the next — who unfollowed, who is new, and who does not
> follow back.

The extension scans whatever profile is open in the user's own signed-in
session. That is usually their own account, but a profile whose list already
opens for them — a public one, or a private one they follow — works the same
way. It cannot read anything the user could not read by scrolling the page
themselves.

### Keywords

unfollowers · followers tracker · who unfollowed me · follow back · not
following back · instagram followers · instagram unfollowers · github
followers · follower analytics · local-only

---

## Descriptions, per language

Each block is the **detailed description** field. Formatting is plain text with
blank lines; the store strips most markup, so nothing below relies on it.

### English

**See who doesn't follow you back — and who quietly unfollowed you.**

Instagram tells you the number. FollowLens tells you the names. It reads the follower and following lists you open, keeps them in your own browser, and from the second scan on shows you exactly what changed.

How it works
1. Open a profile — your own, or any whose lists already open for you.
2. Click FollowLens and press Start. The list is opened and walked for you, with a badge on the page showing progress and a Stop button that always works.
3. Save the scan. It becomes your baseline; every scan after it answers the question the platform will not.

What you get
• Not following back, Unfollowed you, New followers, Mutuals — one click each, every row opens the profile
• Follower history chart, per-scan changes, and a date range you can narrow
• Compare any two scans side by side, in both directions
• Export to CSV, JSON, a printable HTML report, or a full backup that restores on another machine
• Several accounts tracked separately, on either platform, each with its own history
• An ignore list, for the accounts you would rather stop seeing
• 10 languages, light and dark themes, right-to-left support

It tells you when a scan is incomplete
A platform's own header count can include accounts its list endpoint never returns. A tracker that rounds up produces a wrong "not following back" list and never admits it. FollowLens shows what it collected against what was expected, and will not call a list complete when it knows it is not.

Privacy
There is no server to send anything to. No account, no sign-in, no analytics, no telemetry. Your scans live in your browser's own database and are deleted when you delete them. FollowLens never posts, follows, unfollows or messages anyone on your behalf — it only reads, and only what you can already see.

Free and open source, MIT licensed. Every line is on GitHub.

### Türkçe

**Sizi geri takip etmeyenleri — ve sessizce takipten çıkanları görün.**

Instagram size sayıyı verir, FollowLens isimleri. Açtığınız takipçi ve takip listelerini okur, tarayıcınızda saklar ve ikinci taramadan itibaren tam olarak neyin değiştiğini gösterir.

Nasıl çalışır
1. Bir profil açın — kendinizinki ya da listeleri size zaten açılan herhangi biri.
2. FollowLens'e tıklayıp Başlat'a basın. Listeyi sizin yerinize açıp sonuna kadar gezer; sayfadaki rozet ilerlemeyi gösterir, Durdur her an çalışır.
3. Taramayı kaydedin. İlk tarama referansınız olur; sonraki her tarama, platformun cevaplamadığı soruyu cevaplar.

Neler görürsünüz
• Geri takip etmeyenler, Takipten çıkanlar, Yeni takipçiler, Karşılıklı — her biri tek tık, her satır profili açar
• Takipçi geçmişi grafiği, tarama başına değişim ve daraltabildiğiniz bir tarih aralığı
• Herhangi iki taramayı yan yana, iki yönde de karşılaştırın
• CSV, JSON, yazdırılabilir HTML rapor ya da başka bir makinede geri yüklenen tam yedek olarak dışa aktarın
• Her iki platformda da birden fazla hesabı ayrı ayrı, kendi geçmişleriyle izleyin
• Görmek istemediğiniz hesaplar için yok sayma listesi
• 10 dil, açık ve koyu tema, sağdan sola yazım desteği

Tarama eksik kaldığında size söyler
Platformun başlıktaki sayısı, liste ucunun hiç döndürmediği hesapları içerebilir. Yukarı yuvarlayan bir uygulama yanlış bir "geri takip etmiyor" listesi üretir ve bunu asla kabul etmez. FollowLens topladığını beklenene karşı gösterir ve eksik olduğunu bildiği bir listeyi tam saymaz.

Gizlilik
Gönderecek bir sunucu yok. Hesap yok, giriş yok, analitik yok, telemetri yok. Taramalarınız tarayıcınızın kendi veritabanında durur ve siz sildiğinizde silinir. FollowLens sizin adınıza asla paylaşım yapmaz, kimseyi takip etmez, takipten çıkmaz, mesaj göndermez — yalnızca okur, üstelik yalnızca sizin zaten görebildiğinizi.

Ücretsiz ve açık kaynak, MIT lisanslı. Her satırı GitHub'da.

### Deutsch

**Sieh, wer dir nicht zurückfolgt — und wer dir still entfolgt ist.**

Instagram nennt dir die Zahl. FollowLens nennt dir die Namen. Es liest die Follower- und Following-Listen, die du öffnest, behält sie in deinem eigenen Browser und zeigt dir ab dem zweiten Scan genau, was sich geändert hat.

So funktioniert es
1. Öffne ein Profil — dein eigenes oder jedes, dessen Listen sich für dich bereits öffnen.
2. Klicke auf FollowLens und drücke Starten. Die Liste wird für dich geöffnet und durchlaufen; ein Hinweis auf der Seite zeigt den Fortschritt, und Stopp funktioniert jederzeit.
3. Speichere den Scan. Er wird deine Ausgangsbasis; jeder weitere Scan beantwortet die Frage, die die Plattform nicht beantwortet.

Was du bekommst
• Folgt nicht zurück, Hat dir entfolgt, Neue Follower, Gegenseitig — je ein Klick, jede Zeile öffnet das Profil
• Verlaufsdiagramm der Follower, Änderungen pro Scan und ein eingrenzbarer Zeitraum
• Zwei beliebige Scans nebeneinander vergleichen, in beide Richtungen
• Export als CSV, JSON, druckbarer HTML-Bericht oder vollständiges Backup, das sich auf einem anderen Rechner wiederherstellen lässt
• Mehrere Konten getrennt verfolgt, auf beiden Plattformen, jedes mit eigenem Verlauf
• Eine Ignorierliste für Konten, die du nicht mehr sehen möchtest
• 10 Sprachen, helles und dunkles Design, Unterstützung für Rechts-nach-links

Es sagt dir, wenn ein Scan unvollständig ist
Die Zahl im Kopfbereich einer Plattform kann Konten enthalten, die ihre Listen-Schnittstelle nie zurückgibt. Ein Tracker, der aufrundet, erzeugt eine falsche „Folgt nicht zurück"-Liste und gibt es nie zu. FollowLens stellt das Gesammelte dem Erwarteten gegenüber und nennt eine Liste nicht vollständig, wenn es weiß, dass sie es nicht ist.

Datenschutz
Es gibt keinen Server, an den etwas gehen könnte. Kein Konto, keine Anmeldung, keine Analyse, keine Telemetrie. Deine Scans liegen in der Datenbank deines Browsers und sind gelöscht, sobald du sie löschst. FollowLens postet, folgt, entfolgt und schreibt niemals in deinem Namen — es liest nur, und nur das, was du ohnehin sehen kannst.

Kostenlos und quelloffen, MIT-Lizenz. Jede Zeile liegt auf GitHub.

### Español

**Descubre quién no te sigue de vuelta — y quién dejó de seguirte sin decir nada.**

Instagram te da el número. FollowLens te da los nombres. Lee las listas de seguidores y seguidos que abres, las guarda en tu propio navegador y, a partir del segundo escaneo, te muestra exactamente qué cambió.

Cómo funciona
1. Abre un perfil: el tuyo, o cualquiera cuyas listas ya se abran para ti.
2. Haz clic en FollowLens y pulsa Iniciar. La lista se abre y se recorre sola; un distintivo en la página muestra el progreso y Detener funciona en cualquier momento.
3. Guarda el escaneo. Se convierte en tu referencia; cada escaneo posterior responde la pregunta que la plataforma no responde.

Qué obtienes
• No te siguen de vuelta, Dejaron de seguirte, Nuevos seguidores, Mutuos: un clic cada uno, y cada fila abre el perfil
• Gráfico del historial de seguidores, cambios por escaneo y un rango de fechas que puedes acotar
• Compara dos escaneos cualesquiera lado a lado, en ambas direcciones
• Exporta a CSV, JSON, un informe HTML imprimible o una copia de seguridad completa que se restaura en otro equipo
• Varias cuentas seguidas por separado, en ambas plataformas, cada una con su propio historial
• Una lista de ignorados, para las cuentas que prefieres dejar de ver
• 10 idiomas, temas claro y oscuro, compatibilidad con escritura de derecha a izquierda

Te avisa cuando un escaneo queda incompleto
El número que muestra la plataforma puede incluir cuentas que su propio extremo de lista nunca devuelve. Una herramienta que redondea hacia arriba produce una lista de "no te siguen de vuelta" equivocada y nunca lo admite. FollowLens muestra lo recopilado frente a lo esperado, y no llama completa a una lista cuando sabe que no lo está.

Privacidad
No hay servidor al que enviar nada. Sin cuenta, sin inicio de sesión, sin analítica, sin telemetría. Tus escaneos viven en la base de datos de tu navegador y desaparecen cuando los borras. FollowLens nunca publica, sigue, deja de seguir ni envía mensajes en tu nombre: solo lee, y solo lo que ya puedes ver.

Gratis y de código abierto, con licencia MIT. Cada línea está en GitHub.

### Français

**Découvrez qui ne vous suit pas en retour — et qui s'est désabonné sans rien dire.**

Instagram vous donne le nombre. FollowLens vous donne les noms. Il lit les listes d'abonnés et d'abonnements que vous ouvrez, les conserve dans votre propre navigateur et, dès le deuxième scan, vous montre exactement ce qui a changé.

Comment ça marche
1. Ouvrez un profil : le vôtre, ou n'importe lequel dont les listes s'ouvrent déjà pour vous.
2. Cliquez sur FollowLens et appuyez sur Démarrer. La liste est ouverte et parcourue pour vous ; un badge sur la page indique la progression, et Arrêter fonctionne à tout moment.
3. Enregistrez le scan. Il devient votre référence ; chaque scan suivant répond à la question que la plateforme laisse sans réponse.

Ce que vous obtenez
• Ne vous suivent pas en retour, Vous ont désabonné, Nouveaux abonnés, Mutuels : un clic chacun, chaque ligne ouvre le profil
• Graphique de l'historique des abonnés, variations par scan et plage de dates réglable
• Comparez deux scans côte à côte, dans les deux sens
• Export en CSV, JSON, rapport HTML imprimable, ou sauvegarde complète restaurable sur une autre machine
• Plusieurs comptes suivis séparément, sur les deux plateformes, chacun avec son historique
• Une liste d'exclusion, pour les comptes que vous préférez ne plus voir
• 10 langues, thèmes clair et sombre, prise en charge de l'écriture de droite à gauche

Il vous dit quand un scan est incomplet
Le compteur affiché par une plateforme peut inclure des comptes que son propre point de terminaison ne renvoie jamais. Un outil qui arrondit produit une liste « ne vous suit pas en retour » fausse et ne l'avoue jamais. FollowLens affiche ce qu'il a collecté face à ce qui était attendu, et ne déclare pas complète une liste dont il sait qu'elle ne l'est pas.

Confidentialité
Il n'y a aucun serveur où envoyer quoi que ce soit. Pas de compte, pas de connexion, pas d'analytique, pas de télémétrie. Vos scans vivent dans la base de données de votre navigateur et disparaissent quand vous les supprimez. FollowLens ne publie, ne suit, ne se désabonne et n'écrit jamais en votre nom : il ne fait que lire, et seulement ce que vous voyez déjà.

Gratuit et open source, sous licence MIT. Chaque ligne est sur GitHub.

### Português (Brasil)

**Veja quem não segue você de volta — e quem deixou de seguir sem avisar.**

O Instagram te dá o número. O FollowLens te dá os nomes. Ele lê as listas de seguidores e de quem você segue que você abrir, guarda tudo no seu próprio navegador e, a partir da segunda varredura, mostra exatamente o que mudou.

Como funciona
1. Abra um perfil — o seu, ou qualquer um cujas listas já abram para você.
2. Clique no FollowLens e aperte Iniciar. A lista é aberta e percorrida por você; um selo na página mostra o progresso, e Parar funciona a qualquer momento.
3. Salve a varredura. Ela vira sua referência; cada varredura seguinte responde à pergunta que a plataforma não responde.

O que você recebe
• Não seguem de volta, Deixaram de seguir, Novos seguidores, Mútuos — um clique cada, e cada linha abre o perfil
• Gráfico do histórico de seguidores, mudanças por varredura e um intervalo de datas ajustável
• Compare duas varreduras lado a lado, nos dois sentidos
• Exporte em CSV, JSON, relatório HTML para impressão, ou um backup completo que restaura em outra máquina
• Várias contas acompanhadas separadamente, nas duas plataformas, cada uma com seu histórico
• Uma lista de ignorados, para as contas que você prefere não ver mais
• 10 idiomas, temas claro e escuro, suporte a escrita da direita para a esquerda

Ele avisa quando uma varredura fica incompleta
O número que a plataforma exibe pode incluir contas que o próprio endpoint de lista nunca devolve. Uma ferramenta que arredonda para cima produz uma lista de "não segue de volta" errada e nunca admite. O FollowLens mostra o que coletou diante do que era esperado, e não chama de completa uma lista que sabe estar incompleta.

Privacidade
Não existe servidor para onde mandar nada. Sem conta, sem login, sem analytics, sem telemetria. Suas varreduras ficam no banco de dados do seu navegador e somem quando você as apaga. O FollowLens nunca publica, segue, deixa de seguir nem manda mensagem em seu nome — ele só lê, e só o que você já consegue ver.

Gratuito e de código aberto, com licença MIT. Cada linha está no GitHub.

### Русский

**Узнайте, кто не подписан на вас в ответ — и кто тихо отписался.**

Instagram называет число. FollowLens называет имена. Он читает списки подписчиков и подписок, которые вы открываете, хранит их в вашем собственном браузере и со второго скана показывает, что именно изменилось.

Как это работает
1. Откройте профиль — свой или любой, чьи списки для вас уже открываются.
2. Нажмите на FollowLens и на «Начать». Список откроется и будет пройден за вас; значок на странице показывает ход работы, а «Стоп» срабатывает в любой момент.
3. Сохраните скан. Он станет точкой отсчёта; каждый следующий отвечает на вопрос, на который платформа отвечать не станет.

Что вы получаете
• Не подписаны в ответ, Отписались, Новые подписчики, Взаимные — по одному клику, и каждая строка открывает профиль
• График истории подписчиков, изменения по каждому скану и настраиваемый диапазон дат
• Сравнение любых двух сканов рядом, в обе стороны
• Экспорт в CSV, JSON, HTML-отчёт для печати или полная резервная копия, которая восстанавливается на другой машине
• Несколько аккаунтов отслеживаются раздельно, на обеих платформах, у каждого своя история
• Список игнорируемых — для аккаунтов, которые вы не хотите больше видеть
• 10 языков, светлая и тёмная темы, поддержка письма справа налево

Он сообщает, когда скан неполный
Число в шапке платформы может включать аккаунты, которые её же список никогда не возвращает. Инструмент, округляющий вверх, выдаёт неверный список «не подписаны в ответ» и никогда в этом не признаётся. FollowLens показывает собранное против ожидаемого и не называет список полным, если знает, что это не так.

Конфиденциальность
Нет сервера, куда что-либо могло бы уйти. Ни аккаунта, ни входа, ни аналитики, ни телеметрии. Ваши сканы лежат в базе данных вашего браузера и исчезают, когда вы их удаляете. FollowLens никогда не публикует, не подписывается, не отписывается и не пишет от вашего имени — он только читает, и только то, что вы и так видите.

Бесплатно и с открытым исходным кодом, лицензия MIT. Каждая строка — на GitHub.

### 日本語

**フォローバックしていない人と、黙ってフォローを外した人がわかります。**

Instagram が教えてくれるのは数字だけです。FollowLens は名前を教えます。あなたが開いたフォロワー・フォロー中リストを読み取り、あなた自身のブラウザーに保存し、2 回目のスキャンからは何が変わったかを正確に表示します。

使い方
1. プロフィールを開きます — 自分のものでも、すでにリストが開ける相手のものでも構いません。
2. FollowLens をクリックして「開始」を押します。リストは自動で開かれ、最後までたどられます。ページ上のバッジが進捗を示し、「停止」はいつでも効きます。
3. スキャンを保存します。これが基準になり、以降のスキャンがプラットフォームの答えない問いに答えます。

できること
• フォローバックしていない／フォロー解除した／新しいフォロワー／相互 — それぞれ 1 クリック、各行からプロフィールを開けます
• フォロワー履歴のグラフ、スキャンごとの増減、絞り込める期間指定
• 任意の 2 つのスキャンを並べて、双方向に比較
• CSV、JSON、印刷用 HTML レポート、別のマシンで復元できる完全バックアップとして書き出し
• 両プラットフォームで複数アカウントを別々に、それぞれの履歴とともに追跡
• もう見たくないアカウントのための除外リスト
• 10 言語、ライト／ダークテーマ、右から左に書く言語にも対応

スキャンが不完全なときは、そう伝えます
プラットフォームがヘッダーに出す数には、リスト API が一度も返さないアカウントが含まれることがあります。切り上げるツールは誤った「フォローバックしていない」一覧をつくり、それを認めません。FollowLens は取得できた数を期待値と並べて示し、不完全だとわかっているリストを完全とは呼びません。

プライバシー
送る先のサーバーがそもそもありません。アカウントもログインも解析もテレメトリーもなし。スキャンはブラウザー自身のデータベースに保存され、あなたが消せば消えます。FollowLens はあなたの代わりに投稿・フォロー・フォロー解除・メッセージ送信を一切しません。読むだけで、しかもあなたがすでに見られるものだけです。

無料・オープンソース、MIT ライセンス。すべてのコードが GitHub にあります。

### 简体中文

**看清谁没有回关你，以及谁悄悄取关了你。**

Instagram 只给你数字，FollowLens 给你名字。它读取你打开的粉丝与关注列表，保存在你自己的浏览器里，从第二次扫描开始，准确显示发生了什么变化。

使用方法
1. 打开一个主页 —— 你自己的，或任何一个对你已经能打开列表的主页。
2. 点击 FollowLens 并按「开始」。列表会自动打开并被完整浏览，页面上的角标显示进度，「停止」随时可用。
3. 保存这次扫描。它成为你的基准，之后每一次扫描都会回答平台不肯回答的问题。

你会得到
• 未回关你、取关了你、新粉丝、互相关注 —— 各一次点击，每一行都能打开主页
• 粉丝历史曲线、每次扫描的增减，以及可收窄的日期范围
• 任意两次扫描并排对比，双向都可以
• 导出为 CSV、JSON、可打印的 HTML 报告，或可在另一台机器上还原的完整备份
• 在两个平台上分别追踪多个账号，各自拥有独立历史
• 忽略列表，用于你不想再看到的账号
• 10 种语言，浅色与深色主题，支持从右到左的文字

扫描不完整时，它会告诉你
平台页头显示的数字，可能包含它自己的列表接口从不返回的账号。向上取整的工具会生成错误的「未回关」名单，并且从不承认。FollowLens 会把已收集数与预期数并列显示，明知不完整的列表绝不称为完整。

隐私
根本没有可以上传数据的服务器。没有账号、没有登录、没有统计分析、没有遥测。扫描结果保存在你浏览器自己的数据库中，你删除它就消失。FollowLens 绝不会以你的名义发布内容、关注、取关或发送消息 —— 它只读取，而且只读取你本来就能看到的内容。

免费开源，MIT 许可证。每一行代码都在 GitHub 上。

### العربية

**اعرف مَن لا يتابعك بالمقابل — ومَن ألغى متابعتك بهدوء.**

يعطيك Instagram الرقم، ويعطيك FollowLens الأسماء. يقرأ قوائم المتابِعين والمتابَعين التي تفتحها، ويحفظها في متصفحك أنت، ومن الفحص الثاني فصاعدًا يعرض لك بالضبط ما الذي تغيّر.

كيف يعمل
1. افتح ملفًا شخصيًا — ملفك أنت، أو أي ملف تُفتح لك قوائمه بالفعل.
2. اضغط على FollowLens ثم على «ابدأ». تُفتح القائمة ويُمرّ عليها بالكامل نيابة عنك، وشارة على الصفحة تُظهر التقدّم، وزر الإيقاف يعمل في أي لحظة.
3. احفظ الفحص. يصبح هو المرجع، وكل فحص بعده يجيب عن السؤال الذي لا تجيب عنه المنصة.

ما الذي تحصل عليه
• لا يتابعونك بالمقابل، ألغوا متابعتك، متابِعون جدد، متابعة متبادلة — نقرة واحدة لكل منها، وكل صف يفتح الملف الشخصي
• رسم بياني لتاريخ المتابِعين، والتغيّر في كل فحص، ونطاق زمني يمكنك تضييقه
• قارن أي فحصين جنبًا إلى جنب، في الاتجاهين
• تصدير إلى CSV أو JSON أو تقرير HTML قابل للطباعة، أو نسخة احتياطية كاملة تُستعاد على جهاز آخر
• تتبّع عدة حسابات كلٌّ على حدة، على المنصتين، ولكل منها تاريخه الخاص
• قائمة تجاهل للحسابات التي تفضّل ألا تراها بعد الآن
• 10 لغات، مظهر فاتح وداكن، ودعم الكتابة من اليمين إلى اليسار

يخبرك عندما يكون الفحص ناقصًا
قد يتضمّن العدد الظاهر في ترويسة المنصة حسابات لا تعيدها واجهة القوائم أبدًا. الأداة التي تقرّب للأعلى تنتج قائمة «لا يتابعك بالمقابل» خاطئة ولا تعترف بذلك أبدًا. يعرض FollowLens ما جمعه مقابل ما كان متوقعًا، ولا يصف قائمة بأنها كاملة وهو يعلم أنها ليست كذلك.

الخصوصية
لا يوجد خادم تُرسَل إليه أي بيانات أصلًا. لا حساب، ولا تسجيل دخول، ولا تحليلات، ولا قياس عن بُعد. تبقى عمليات الفحص في قاعدة بيانات متصفحك وتختفي عندما تحذفها. لا ينشر FollowLens ولا يتابع ولا يلغي متابعة ولا يرسل رسائل نيابة عنك — إنه يقرأ فقط، ويقرأ فقط ما يمكنك رؤيته أصلًا.

مجاني ومفتوح المصدر، برخصة MIT. كل سطر منه على GitHub.

---

## Privacy practices form

| Question | Answer |
| --- | --- |
| Single purpose | See [above](#single-purpose) |
| Are you collecting personally identifiable information? | **No** |
| Health information? | **No** |
| Financial and payment information? | **No** |
| Authentication information? | **No** |
| Personal communications? | **No** |
| Location? | **No** |
| Web history? | **No** |
| User activity (clicks, mouse position, scroll)? | **No** |
| Website content (text, images, sounds, files)? | **No** — see the note below |
| Selling to third parties | **No** |
| Using or transferring for a purpose unrelated to the single purpose | **No** |
| Using or transferring to determine creditworthiness or for lending | **No** |

The three certification checkboxes at the bottom of the form can all be
checked truthfully.

**Note on "website content".** The extension reads follower and following lists
from the page, which *is* website content — but the store's question is about
data the **developer collects**, and none of it is collected: it is written to
the user's own `IndexedDB` and never transmitted anywhere. There is no backend
in this project to receive it. If the reviewer reads the question the other way,
the honest expansion is: *reads follower/following list entries (username,
display name, avatar URL, verified and private markers) from the page the user
opens, stores them locally on the user's device, and transmits them nowhere.*

---

## Permission justifications

Paste each into the matching box in the review form.

**`storage`**
Stores the user's saved scans, account labels, ignore list and preferences on
their own device. `chrome.storage.sync` is not used, so nothing is uploaded to
the browser's sync service either. No data leaves the device.

**`scripting`**
Injects this extension's own content script into the already-open platform tab
when it is not present. After a browser or extension update the tab is still
open but no longer connected, and without this the user would have to reload
the page manually before a scan could start. Only the script bundled in this
package is injected, only into the hosts declared below, and only in response
to the user opening the popup. No remote code is fetched or executed.

**`activeTab`**
Lets the popup read the current tab's URL, so it can tell the user whether they
are on a supported platform and which account's list is open. Granted only for
the tab the user is on, and only after they click the extension's icon. This is
the fallback path for users who set this extension's site access to "on click";
nothing is read from tabs the user has not opened the popup on.

**Host permission — `https://instagram.com/*`, `https://www.instagram.com/*`**
Core functionality. Reads the followers/following dialog on the profile the
user opens, in their own signed-in session.

**Host permission — `https://github.com/*`, `https://www.github.com/*`**
Core functionality. Reads the server-rendered followers/following tabs on the
profile the user opens.

### Notes for the reviewer

- **No backend.** This extension sends no data to any server — not the
  developer's, and not a third party's. There is no developer server in the
  project at all. All storage is the browser's own `IndexedDB`.
- **Network activity, in full.** (a) Reading the follower-list responses the
  platform's own page already requests as the user scrolls. (b) Loading avatar
  images from the platform's own CDN, from the page the user already has open.
  (c) With the "Faster, more complete scans" setting on (the default), paging
  through the list directly from that same page — on Instagram, the site's own
  list endpoint using the session the user is already signed in with; on GitHub,
  the public REST API at `api.github.com`, which needs no session. (c) exists
  because reading only what scrolling renders was measured to miss real
  followers, which produces a wrong "not following back" list. It is switchable
  in Settings; with it off, only (a) and (b) occur.
- **Nothing runs on its own.** Auto-Collect starts only after an explicit click,
  shows a badge on the page for its entire duration, and has an always-available
  Stop control. No scan is ever triggered in the background or on page load.
- **It only reads.** The extension never posts, follows, unfollows, likes or
  messages. There is no code path that issues a write to either platform.
- **Whose lists.** It scans whatever profile the user has open in their own
  session. It cannot read a list that would not open for that user — a private
  account they do not follow is as unreadable to the extension as it is to them.
- **No remote code.** Everything ships in the package. The MV3 default CSP is
  unchanged, and there is no `eval`, no `new Function`, and no remotely hosted
  script or stylesheet.
- **Source.** MIT licensed, at `https://github.com/mtvrkan/followlens`. The
  build is reproducible with `npm ci && npm run build`.

---

## Assets

| Asset | Size | Status | Path |
| --- | --- | --- | --- |
| Icon | 128 × 128 | ready | `public/icon128.png` (also 48 and 16) |
| Small promo tile | 440 × 280 | ready | `brand-sources/promo/promo-small-440x280.png` |
| Marquee promo tile | 1400 × 560 | ready | `brand-sources/promo/promo-marquee-1400x560.png` |
| Screenshots | 1280 × 800 | ready | `store-screenshots/` |
| Social card (site, not the store) | 1200 × 630 | ready | `docs/assets/img/og-image.png` |

`brand-sources/` and `store-screenshots/` are **not committed** — they are
git-ignored working directories on the maintainer's machine. The tiles are
rasterised from one HTML source in `brand-sources/promo/`, at two viewport
sizes, so the 440 × 280 and the 1400 × 560 cannot drift apart; the regeneration
commands are in the README beside it. Only the rendered social card ships in
`docs/`, because the site has to serve it.

---

## Screenshots — capture list

**These have to be taken from the running extension.** The store requires
screenshots that show the actual product, and a mocked-up image would be both a
policy violation and a lie to the person deciding whether to install. Five, at
1280 × 800, in the order they should appear:

1. **The popup mid-scan.** The badge counting, both stat cards filled, Stop
   visible. This is the one that shows what the extension actually does.
2. **Follower List in the dashboard.** The five counts across the top with the
   "Not following back" list open beneath them.
3. **Detailed Analysis.** The growth chart with several scans in it, over a
   narrowed date range.
4. **Compare.** Two scans side by side, with added and lost rows both visible.
5. **Settings.** Export options and the local-storage figure — the screen that
   shows the data is the user's to take and to delete.

Before capturing:

- Use a throwaway or well-populated account and **blur or replace real
  handles** — a screenshot is public forever, and third-party usernames in it
  are other people's data.
- Set the browser window so the captured area is exactly 1280 × 800. A HiDPI
  display will produce 2560 × 1600 unless the capture is scaled back down.
- Take one set in dark theme and one in light, then pick per screenshot —
  mixing them across the five reads as inconsistency rather than as a feature.
- The same five, recaptured with the UI language switched, can be uploaded per
  language. Optional: the store falls back to the default-language set.

---

## Submission checklist

- [x] Icons at 16 / 48 / 128
- [x] Ten languages in `public/_locales`, each with `appName` and `appDesc`
- [x] Short description under 132 characters in every language
- [x] Detailed description written in all ten languages (above)
- [x] Single purpose written, and matching what the build does
- [x] Permission justifications written
- [x] Privacy practices answers decided
- [x] Promo tiles, 440 × 280 and 1400 × 560
- [x] `npm run verify` green — lint, types, 351 tests, site checks, build
- [x] `npm audit` clean
- [x] **Publish the site**, so the privacy policy URL resolves — GitHub Pages,
      `main` branch, `/docs` folder, plus a DNS CNAME for `followlens` →
      `mtvrkan.github.io`. The listing cannot be submitted without a reachable
      privacy policy.
- [x] **Capture the five screenshots** (above)
- [x] Build the upload package: `npm ci && npm run build`, then zip the
      **contents** of `dist/` — not the folder itself, or the manifest ends up
      one level down and the upload is rejected
- [x] Store id wired into `docs/index.html` — `jpejnlkciiphkcnlncljikpgekbcglfl`,
      in the install button's `href` and in the JSON-LD `downloadUrl`. The "Or
      install from source" note beneath the button stays regardless: the project
      is open source, and building it yourself is a supported way in.
- [x] Submit for review
- [x] **Approved and live.** The "in review" lines are gone from `README.md`,
      `README.tr.md`, `INSTALL.md`, `INSTALL.tr.md` and the comment above the
      install button in `docs/index.html`.
