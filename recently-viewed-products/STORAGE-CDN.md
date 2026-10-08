# ONe – tárolás és jsDelivr-kiadás

A tényleges felállás: nyilvános `lenartlevente/oneplugins` GitHub-repó, jsDelivr kódkiszolgálás, a webshop saját munkamenetsütije és az ONe natív API-/kosárkliense. Az 1.2.0 kiadás vevői árat, készletet, kosárgombot és külön, központi CSS-ből kezelt megjelenést biztosít.

## Mi hol van?

| Tartalom | Hely | Élettartam |
| --- | --- | --- |
| Forrás, tesztek, leírások | `oneplugins/recently-viewed-products/` | Git-verziókövetés |
| Kiadott JavaScript | `release/`, GitHubról jsDelivr-en keresztül | Konkrét verzió és tartalmi ellenőrzőösszeg |
| Ajánló stílusa | `one-recent-products.css`, kézzel a webshop központi CSS-ébe másolva; verziózott másolata a `release/` mappában | A központi CSS szerinti verzió |
| Utolsó 6 termék azonosítói | `__Host-one_recent_products` első félhez tartozó süti | Böngésző-munkamenet |
| Termékadat, vevői ár, készlet, kosárvisszajelzés | Futó modul és megjelenített DOM | Csak futás közben |
| Token és kosár | Az ONe meglévő munkamenete és kosárkezelése | Az ONe saját működése szerint |

A modul nem ír localStorage-ba, sessionStorage-ba, IndexedDB-be vagy saját szerveroldali előzménytárba. A termékelőzmény nem kerül a CDN-kérésbe. A tokent a natív ONe API-kliens továbbítja a megfelelő API felé.

A süti legfeljebb 6 egyedi azonosítót tartalmaz, URL-kódolt JSON-ban: `{"v":1,"ids":["111139"]}`. Normál íráskor `Secure; SameSite=Lax; Path=/` attribútumokat kap, Domain, Expires és Max-Age nélkül. Azonos hoston a lapfülek közösen használják; böngésző-munkamenet-visszaállítás megőrizheti. A prod és a preprod külön hoston külön előzményt kap.

A webshop meglévő CookieYes/GTM engedélyezéséhez kell illeszteni. A modul `canUseCookie` callbackje önmagában nem olvassa a CMP választását.

## Kiadás

A pontos JS- és CSS-fájlnevet, méretet és SHA-256/SRI összeget a [release/manifest.json](release/manifest.json) tartalmazza. A kiadási fájlok és a `one-recent-products.v1.js` / `one-recent-products.css` források bájtról bájtra azonosak. A `v1.js` név kompatibilitási belépő marad; a modul és a manifest aktuális verziója 1.2.0.

A korábbi 1.0.0 és 1.1.0 JavaScript-kiadás a visszaállításhoz megmarad. A régi kiadási fájl tartalmát nem szabad felülírni; új kódhoz új fájlnév tartozzon.

A [gtm-loader.html](gtm-loader.html) a konkrét GitHub-commitból betöltött kiadási JavaScriptre mutat. Ez az éles használatra ajánlott URL. Az `@HEAD` vagy `@main` a fejlesztés során használható, de ágfrissítésnél a CDN-gyorsítótár miatt késleltetett frissülés lehetséges. A jsDelivr támogatja a commit alapú URL-t és a kiadott fájlok tartós gyorsítótárazását. [Hivatalos dokumentáció](https://github.com/jsdelivr/jsdelivr#github).

A standalone JavaScript tartalmazza a repó MIT licencszövegét. A CDN csak a nyilvánosan kiadott kódot szolgáltatja; a modul a termék-, ár- és készletadatokhoz az ONe API-ját használja.

## GTM

1. Másold a [one-recent-products.css](one-recent-products.css) tartalmát a webshop központi CSS-ének végére. A modul nem tölt be CSS-t és nem hoz létre `style` elemet. A natív osztályokat és szelektorokat a [STYLING.md](STYLING.md) írja le.
2. A CMS-ben helyezd el a [cms-target.html](cms-target.html) cél-divet, vagy azonos ID-val a meglévő üres, kizárólag e modulnak szánt konténert.
3. Ezután a [gtm-loader.html](gtm-loader.html) script sorát tedd Custom HTML tagbe.
4. Trigger: DOM Ready – All Pages, a webshop sütiengedélyezésével összehangolva. Firing option: Once per page.
5. A PWA-navigációt a modul kezeli; History Change miatti ismételt CDN-betöltés nem szükséges.
6. Ha a webshop CSP-t használ, a CDN-script és a webshop saját központi CSS-e a meglévő szabályok szerint töltendő be; a modul nem ad hozzá stíluslapkérést vagy inline stíluslapot.

SRI opcionálisan a manifest `integrity` értékének és `crossorigin="anonymous"` attribútumnak a scripthez adásával használható; a CDN CORS-válaszát is ellenőrizni kell. A fájl automatikusan generált `.min.js` változatához más ellenőrzőösszeg tartozna.

## Környezet és vevői kontextus

Az API-base URL-t, tenantot és aktuális tokent a meglévő ONe API-kliens kezeli. A CDN-betöltő preprod és prod környezetben ugyanaz lehet. A modul nem épít hostnévből API-címet, és nem vált vissza prodra, ha egy preprod kérés hibázik.

Be-/kijelentkezés, vevő-, raktár-, kosár-, pénznem- és nettó/bruttó váltás után a modul újrakéri az adatokat. A régi kontextusban indult válaszokat eldobja. A kosárba helyezést követően a friss készletfoglalások és árak miatt szintén újra lekérdez.

## Bevezetés és visszaállítás

GTM Preview/preprod módban először hasonlítsd össze az árakat a natív termékoldallal, azonos vevővel és mennyiséggel. Ellenőrizd a készletet, a kosárfrissítést, a minimum mennyiséget, a csomagolási egységet és a pluginos termék rendelési folyamatát. A [VALIDATION.md](VALIDATION.md) rögzíti az elvégzett teszteket és a még szükséges élő próbát.

Visszaállítás: a GTM-scriptet az előző kipróbált commit és a megfelelő korábbi kiadási fájl URL-jére állítsd. Az ajánló központi CSS-ét az adott kiadáshoz tartozó megjelenéssel együtt kezeld. Nem szükséges az előzménysüti formátumának migrációja.

Saját kezelésű tárhelyhez a korábban javasolt Cloudflare R2 + saját domain továbbra is használható alternatíva. A mostani csomag a megadott jsDelivr-repóra épül; külön R2-telepítést nem tartalmaz.
