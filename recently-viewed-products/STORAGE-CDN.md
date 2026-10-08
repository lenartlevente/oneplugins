# ONe – tárolási és CDN-javaslat

Ajánlott felállás: privát GitHub-forrás, egy első félhez tartozó munkamenetsüti, az ONe meglévő API-kliense és saját domainhez kapcsolt Cloudflare R2/CDN a kiadott JavaScripthez. A GTM egy konkrét verziót tölt be egyetlen script sorral.

Ez az architektúrajavaslat véglegesített változata, az implementáció integrációs ellenőrzésre előkészített 1.0.0 verzió. CDN és GTM publikálás nem történt.

## Mi hol legyen?

| Tartalom | Javasolt hely | Élettartam / hozzáférés |
| --- | --- | --- |
| Forrás, tesztek, dokumentáció | Privát `lenartlevente/CODE` repó, `ONe/recently-viewed-products/` | Git-verziókövetés, a repó jogosultságai szerint |
| Utolsó 6 termék azonosítói | `besttool.hu` saját `__Host-one_recent_products` sütije | Böngésző-munkamenet, legfrissebb elöl |
| Név, kép, cikkszám, terméklink | Futás közben az ONe Front Office API-kliense | Csak a modul futó állapotában és a megjelenített DOM-ban |
| Hitelesítési token | Az ONe meglévő hitelesítési állapota | A modul a natív API-klienst használja |
| Kiadott JavaScript | Külön R2 bucket, saját CDN-domain | Nyilvános, konkrét verzióhoz kötött fájl |
| CMS cél-div és CDN-betöltő | ONe CMS, illetve GTM | A webshop konfigurációja |

A modul nem ír localStorage-ba, sessionStorage-ba, IndexedDB-be vagy saját szerveroldali előzménytárba. A CDN a statikus kódot szolgáltatja; a modul nem küldi oda az előzménylistát vagy a Bearer tokent. A JavaScript HTTP-gyorsítótárazása a kódfájl letöltését gyorsítja.

## A munkamenetsüti

- Név: `__Host-one_recent_products`.
- Tartalom: URL-kódolt JSON, például `{"v":1,"ids":["111139","00123"]}`.
- Legfeljebb 6 egyedi, az ONe által visszaigazolt termékazonosító. Az aktuálisan megtekintett termék is szerepel.
- Attribútumok: `Secure; SameSite=Lax; Path=/`. Nincs `Domain`, `Expires` vagy `Max-Age` a normál írásnál.
- A célkonténer nélkül is gyűjti a megtekintéseket; a konténer megjelenésekor kirajzolja az elérhető termékeket.
- Azonos hoston a böngésző lapfülei közösen használják. Egy böngésző munkamenet-visszaállítása megőrizheti a sütit. Nem az ONe bejelentkezésének lejárata határozza meg az élettartamát.
- A webshop meglévő CookieYes/GTM engedélykezeléséhez kell illeszteni. A modul alapértelmezett `canUseCookie` függvénye önmagában nem olvassa a CMP választását.

A jelenlegi kéréshez böngésző-munkamenet tartozik. A kijelentkezéshez kötött törlés vagy külön üzleti inaktivitási idő új viselkedési döntés lenne.

## CDN-választás

| Lehetőség | Mikor választanám? | Feltétel |
| --- | --- | --- |
| **Cloudflare R2 + saját domain + Cloudflare cache** | Elsődleges javaslat, saját kezelésű ONe modulok közös kiadási helyének | R2-hozzáférés és a megfelelő Cloudflare-domainkonfiguráció |
| Meglévő, saját kezelésű statikus tárhely/CDN | Ha már van megbízható feltöltési hozzáférés és megfelelő HTTPS-/cache-beállítás | Verziózott fájlútvonalak és szabályozható válaszfejlécek |

A besttool.hu jelenlegi `static.besttool.hu` hostján termékképek láthatók. Az egyedi JavaScript feltöltési jogosultságát és kiszolgálási beállításait nem ellenőriztem; használata ezek tisztázásától függ.

Az R2 saját domainen kapcsolható a Cloudflare gyorsítótárához. A domainnek az R2 buckettel azonos Cloudflare-fiókban kell zónaként szerepelnie. A Cloudflare az `r2.dev` címet fejlesztési használatra adja, korlátozott forgalommal; éles GTM-betöltéshez saját domain a javaslat. [Hivatalos leírás](https://developers.cloudflare.com/r2/buckets/public-buckets/).

A példák `SAJAT-CDN` jelölése helykitöltő; még nincs kiválasztott vagy létrehozott CDN-domain. Egy külön, kezelt domain aldomainje használható, akár több ONe webshop moduljainak kiszolgálására. A webshop DNS-ének módosítása nem része ennek a mentésnek.

## Konkrét kiadási fájl

Az előkészített kiadás:

```text
release/one-recent-products.1.0.0.46957dcb8a91.js
```

Javasolt CDN-objektumútvonal:

```text
one/recently-viewed/one-recent-products.1.0.0.46957dcb8a91.js
```

A fájlnév teljes verziót és a tartalom SHA-256 ellenőrzőösszegének első 12 karakterét tartalmazza. A teljes ellenőrzőösszeg, méret és opcionális SRI-érték a [release/manifest.json](release/manifest.json) fájlban van. A kiadási JavaScript bájtról bájtra azonos a forrással; külön függőség vagy további fájlletöltés nem kell a modulhoz.

Javasolt válaszfejlécek:

```http
Content-Type: text/javascript; charset=utf-8
Cache-Control: public, max-age=31536000, immutable
```

Egy már kiadott URL tartalmát ne írd felül. Módosított kód új verziót, új ellenőrzőösszeget és új URL-t kapjon. A GTM-ben mindig a konkrét kiadási URL szerepeljen. Visszaállításkor az előző kipróbált kiadás URL-jét kell visszatenni; a korábbi fájlokat meg kell tartani.

Csak a kiadási JavaScript kerüljön a nyilvános bucketbe. A repó, tesztadatok és más céges anyagok maradjanak a forrástárban. Az R2-ben külön bucket használata egyszerűvé teszi ezt, mert a saját domain a bucket objektumait nyilvánosan elérhetővé teszi.

## GTM és opcionális SRI

Az alapbetöltő a [gtm-loader.html](gtm-loader.html) fájlban szerepel. A tényleges CDN-host megadása után egy script sor kerül a GTM Custom HTML tagbe; `Once per page` indítás mellett a modul kezeli a PWA-navigációt.

Opcionálisan a kiadás SRI-értéke is rögzíthető:

```html
<script src="https://SAJAT-CDN/one/recently-viewed/one-recent-products.1.0.0.46957dcb8a91.js" integrity="sha384-xH27UBz6JnWf0LR7nKxAYcoHaeQ5ZI4RPGl0v3waB7fps1kmxNQve6xAPvNYbxW2" crossorigin="anonymous" data-target-id="one-recent-products-159b7d2a-5b87-4caa-a981-c6930a4a587f" async></script>
```

Az SRI-s, másik originről történő betöltéshez megfelelő CORS-válasz szükséges. Csak nyilvános kódfájlokat tartalmazó R2 buckethez javasolt dashboard CORS-konfiguráció:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"]
  }
]
```

Ellenőrizd a CDN-választ `Origin: https://besttool.hu` kérésfejléccel. Már gyorsítótárazott fájlnál a CORS módosítása után cache-frissítés szükséges. [Cloudflare CORS-dokumentáció](https://developers.cloudflare.com/r2/buckets/cors/).

Ha a webshop CSP-t használ, annak engednie kell a CDN-scriptet és a modul stílusának létrehozását; a kód továbbadja a betöltő script nonce értékét a stílusnak. Az SRI/nonce beállításokat a tényleges GTM- és CSP-konfigurációval kell próbálni.

## Kiadási menet

1. Válaszd ki a kezelhető CDN-domaint és tárhelyet. R2 esetén állítsd be a külön bucketet és annak saját domainjét.
2. Töltsd fel a konkrét kiadási JavaScriptet a fenti objektumútvonalra, a megadott fejlécekkel.
3. Ellenőrizd a HTTP 200 választ, a tartalomtípust és a teljes SHA-256 összeget a manifesthez képest. SRI esetén a CORS-t is.
4. A CMS-ben helyezd el a [cms-target.html](cms-target.html) konténert, vagy add meg a meglévő, kizárólag e modulnak fenntartott üres div ID-jét.
5. A GTM-betöltőben írd át a CDN-hostot és szükség esetén a cél-div ID-jét. Illeszd a meglévő sütiengedélyezési folyamathoz.
6. GTM Preview/preprod módban ellenőrizd a vendég és a bejelentkezett vevő működését, 7 termék és ismételt megtekintés után a sorrendet, a PWA-navigációt, a vissza/előre műveletet és a konténer újralétrejöttét.
7. Sikeres próba után publikáld a GTM-változatot; a korábbi kiadás maradjon elérhető visszaállításhoz.

Ehhez a modulhoz külön alkalmazásszerver, adatbázis vagy Worker nem szükséges. A forráskezelés, CDN-feltöltés és GTM-publikálás külön lépés. Automatikus CDN-telepítést ez a csomag nem tartalmaz.

Az elvégzett teszteket és az éles ellenőrzés határát a [VALIDATION.md](VALIDATION.md) rögzíti. Az R2 díjait a választott fiók és várható használat alapján, a [mindenkori hivatalos díjszabással](https://developers.cloudflare.com/r2/pricing/) kell ellenőrizni; ez a javaslat nem tartalmaz költségígéretet.
