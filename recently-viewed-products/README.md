# ONe – utolsó 6 megtekintett termék

Előkészített kliensmodul a besttool.hu ONe Front Office felületéhez.
Az ellenőrzött oldal az ONe 9.137.2 kliensét használta 2026. október 7-én.
Ez ellenőrzésre szánt első verzió; nem történt GTM-publikálás vagy CDN-telepítés.

A forrás helye: [lenartlevente/CODE – ONe/recently-viewed-products](https://github.com/lenartlevente/CODE/tree/main/ONe/recently-viewed-products).
A végleges tárolási és CDN-architektúrajavaslat: [STORAGE-CDN.md](STORAGE-CDN.md).
A `release/` mappában a változatlan futó kód verziózott kiadási fájlja és az ellenőrzőösszegeket tartalmazó manifest található.

## Működés

- Egy saját, hosthoz kötött munkamenetsüti: __Host-one_recent_products.
- Legfeljebb 6 egyedi, valódi termékazonosító; legfrissebb elöl. Az aktuális termék is szerepel.
- Nincs localStorage, sessionStorage, IndexedDB vagy saját szerveroldali előzménytárolás.
- A termékadatokat az ONe aktuális Front Office API-kliense kéri le.
- A kártyák tartalma: kép, terméknév, cikkszám, termékoldal-link.
- A kártyákon az első verzió nem jelenít meg árat, készletet vagy kosárgombot.
- ONe routerrel működő normál kattintás; új lap és módosító billentyűk esetén hagyományos link.
- Megszűnt, nem visszaadott vagy nem aktív termék nem jelenik meg; nincs mesterséges feltöltés 6 kártyára.
- Újranézéskor nincs duplikáció. Query és hash változása önmagában nem új termékmegtekintés.
- Az előzményeket a modul akkor is gyűjti a termékoldalon, ha a célkonténer még nincs ott.

## Telepítés

1. A release/manifest.json által megnevezett JavaScript-fájlt helyezd HTTPS-en elérhető saját CDN-re, az one/recently-viewed/ útvonal alá. A forrásfájl neve one-recent-products.v1.js; a GTM a konkrét, ellenőrzőösszeggel megnevezett kiadási fájlt tölti be.
2. A cms-target.html tartalmát helyezd el a termékoldal kívánt CMS HTML-blokkjában.
3. Ha meglévő üres UUID-s divet használsz, annak ID-jét add meg a GTM betöltő data-target-id attribútumában. A cél-div kizárólag e modulhoz tartozzon. Más célra használt rejtett ONe-elemet ne adj meg.
4. A gtm-loader.html egy sorát tedd Custom HTML tagbe, a SAJAT-CDN helyére a valós CDN-hostot írva.
5. Indítás: első betöltéskor, például DOM Ready. A tag firing option legyen Once per page. A modul kezeli a további navigációt; History Change miatti ismételt CDN-betöltés nem szükséges.
6. A GTM indítását igazítsd a webshop meglévő CookieYes/consent beállításához. A modul canUseCookie konfigurációs függvénye további, futás közben is ellenőrzött engedélyezési pont. Alapértelmezése true; önmagában nem olvassa a CookieYes választását.
7. Ha a konténer őse rejtett, azt a CMS-ben külön láthatóvá kell tenni. A modul csak a saját cél-divjét mutatja meg.

A CDN csak a kódot szolgáltatja. Tokenérték nem kerül a fájlba vagy a CDN-kérésbe.

## ONe illesztés és bizonyíték

Az aktuális, publikus kliensforrásban azonosított hívások:

~~~js
window.$nuxt.$api.catalog.app.getProductBySlug(slug);
window.$nuxt.$api.catalog.app.getProductsListById(true, productIds);
~~~

Az ONe API-plugin getToken callbackje a store.state.auth.accessToken aktuális értékét adja át a saját API-rétegének; a frissítést is az ONe kezeli. A modul a meglévő klienst használja, nem állít elő vagy tárol második hitelesítési tokent. Az auth és vevői kontextus változásakor eldobja a régi válaszokat, és újrakéri az adatokat.

Az alkalmazás one-route-change eseményt küld a navigáció előtt. A modul a router afterEach hookját, DOM-változásfigyelést, vissza/előre és bfcache visszatérést is kezeli.

Ezek a klienskód alapján megfigyelt belső illesztések, nem verziófüggetlen, dokumentált ONe plugin-API garanciák. ONe frissítés után ellenőrizendők.

Vizsgált források:

- https://besttool.hu/format-lemezfuro-extra-rovid-din1897-dk77-hss-3-2mm-f111139-id-111139
- https://code.one.unity.pl/9.137.2/384c0e7.js – API-plugin, token callback, útvonal-esemény.
- https://code.one.unity.pl/9.137.2/973ee3c.js – natív terméklekérő store actionök.

A belépett vevő tokenhozzáférése és az éles API-válaszok nem kerültek ebben a munkamenetben hitelesített felhasználóval kipróbálásra. A forrásvizsgálat a belső klienshívásokat igazolja; a tesztek ezek szerződését szimulálják. Vendég és belépett vevő külön éles/preprod integrációs ellenőrzést igényel.

## Ellenőrzés

A csomag tesztjei Node.js és jsdom környezetben futtathatók: npm install --ignore-scripts, majd npm test. A fejlesztési csomagot és a teszteket nem kell CDN-re feltölteni; csak a release/manifest.json által megnevezett JavaScript-fájl kerül oda.

Teszteld GTM Preview módban: közvetlen termékmegnyitás, legalább 7 termék, ismételt megtekintés, vissza/előre, nem termékoldalról visszatérés, későn létrejövő vagy újralétrejövő konténer, be-/kijelentkezés és vevőváltás.

Állapot lekérése token vagy termékelőzmények kiírása nélkül:

~~~js
window.OneRecentlyViewed.getState();
~~~

Újraellenőrzés; például a meglévő CMP engedélyváltozási callbackjéből:

~~~js
window.OneRecentlyViewed.refresh();
~~~

Saját előzmények törlése:

~~~js
window.OneRecentlyViewed.clear();
~~~

Az API-hibáról a dokumentum one-recent-products-error eseményt küld, kizárólag feldolgozási lépéssel és státuszkóddal. Nem küld logot vagy mérési eseményt külső szolgáltatásnak.

A munkamenetsüti böngésző-visszaállításkor megmaradhat, és azonos hoston a lapfülek közösen használják. Ez nem lapfülenként külön tároló, és nem az ONe bejelentkezési munkamenetének lejáratához kötött tárolás.
