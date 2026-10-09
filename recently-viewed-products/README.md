# ONe – utolsó 6 megtekintett termék

1.2.1 kliensmodul a besttool.hu ONe Front Office felületéhez, vevői árral, készlettel, kosárgombbal és külön CDN-es CSS-fájlból kezelt megjelenéssel.
Az ellenőrzött oldal az ONe 9.137.2 kliensét használta 2026. október 8-án.
A tulajdonos visszajelzése szerint az 1.2.0 JS + CSS beillesztési minta már megjelent az oldalon. Az 1.2.1 elrendezéshez a `gtm-loader.html` teljes tartalmára kell cserélni a korábbi beillesztést. Hitelesített vevői kosárpróba eredménye nincs rögzítve ebben a repóban.

A forrás helye: [lenartlevente/oneplugins – recently-viewed-products](https://github.com/lenartlevente/oneplugins/tree/main/recently-viewed-products).


## Működés

- Egy saját, hosthoz kötött munkamenetsüti: __Host-one_recent_products.
- Legfeljebb 6 egyedi, valódi termékazonosító; legfrissebb elöl. Az aktuális termék is szerepel.
- Nincs localStorage, sessionStorage, IndexedDB vagy saját szerveroldali előzménytárolás.
- A termékadatokat az ONe aktuális Front Office API-kliense kéri le.
- A kártyák tartalma: kép, terméknév, cikkszám, vevői ár, raktárkészlet és Kosárba gomb.
- A kép és a név a termékoldalra vezet; a kosárgomb külön elem, nem navigál.
- Az ár a natív ONe kliens aktuális vevői tokenjével készül. Vendégként az auth-optional végpont által visszaadott ár jelenik meg.
- Az ár a minimum rendelési mennyiség teljes ára, a mennyiséggel, pénznemmel és nettó/bruttó jelöléssel. A webshop árnézetének változását követi.
- A készlet a webshopban ismert raktárakra készül, tartalmi egységben. HIDDEN módnál csak elérhetőséget jelenít meg, mennyiséget nem.
- A látható raktársorok classában szerepel az azonosító, például one-rv__warehouse-FETFLK; a data-warehouse-id az eredeti azonosítót tartalmazza.
- A készletpöttyök a natív fetis-stockbox osztályokat használják, available, other-stock és unavailable állapotokkal; hiányzó adatnál unknown jelölést ad.
- Az ár a natív price_column, transactional_price és gr_net_unit osztályokat használja. Magasabb, megfelelő mennyiségű listaár esetén crossed és discount elemeket is megjelenít.
- A modul nem injektál CSS-t; a kártyák lekerekítését, halvány és hover/fókusz árnyékát a külön, `release/manifest.json` által megnevezett CSS kezeli, amelyet a beillesztési minta `link` eleme tölt be.
- Hiányzó vagy hibás ár nem lesz nullaár; ilyen terméket a modul nem helyez kosárba. Az API kifejezett nullaárát elfogadja.
- A termék minimum rendelési mennyiségét teszi kosárba, rendelési egységben. A csomagolási szorzó az árlekérés mennyiségénél érvényesül.
- A natív kosárfolyamatot használja, amennyiben a megfelelő ONe Vue-komponens elérhető. Ennek hiányában rendelési plugin nélküli terméknél a regisztrált cart/addProductToCart store actiont használja; az action a kosarat is újratölti.
- Az ONe pluginregiszterében app_add_to_cart típusú komponenshez kötött terméknél a natív handler vagy egy explicit adapter szükséges. A termék más kiegészítő adata, például productHelper, nem tiltja le a kosárgombot. Ismeretlen pluginregiszterrel a modul nem kerüli meg a lehetséges egyedi rendelési folyamatot.
- Folyamatban lévő kosárművelet alatt a gombokat letiltja; írási műveletet nem próbál automatikusan újra.
- ONe routerrel működő normál kattintás; új lap és módosító billentyűk esetén hagyományos link.
- Megszűnt, nem visszaadott vagy nem aktív termék nem jelenik meg; nincs mesterséges feltöltés 6 kártyára.
- Újranézéskor nincs duplikáció. Query és hash változása önmagában nem új termékmegtekintés.
- Az előzményeket a modul akkor is gyűjti a termékoldalon, ha a célkonténer még nincs ott.

## Telepítés

1. A `gtm-loader.html` teljes tartalmát, a `script` és a `link` elemet együtt illeszd be az oldal HTML-blokkjába vagy a GTM Custom HTML tagjébe, a régi beillesztés helyére. Az 1.2.1 új JS- és CSS-fájlt használ. A JavaScript nem tölti be automatikusan a CSS-t; azt a `link` elem kéri le. A besttool.hu meglévő fetis-stockbox és árstílusai is szükségesek.
2. A `release/manifest.json` nevezi meg az aktív JS- és CSS-fájlt. Mindkettő a GitHub-repóból, jsDelivr-en keresztül töltődik be. A jelenlegi minta `@HEAD` hivatkozást használ, így a repó alapértelmezett ágát követi.
3. A `cms-target.html` tartalmát helyezd el a termékoldal kívánt CMS HTML-blokkjában, ha a célkonténer még nincs ott.
4. Ha meglévő üres UUID-s divet használsz, annak ID-jét add meg a betöltő `data-target-id` attribútumában. A cél-div kizárólag e modulhoz tartozzon. Más célra használt rejtett ONe-elemet ne adj meg.
5. A CDN-host és a cél-div ID a mintában előre ki van töltve. Ha a minta már az oldal HTML-jében szerepel, a GTM-ben ne töltsd be még egyszer.
6. Indítás: első betöltéskor, például DOM Ready. A tag firing option legyen Once per page. A modul kezeli a további navigációt; History Change miatti ismételt CDN-betöltés nem szükséges.
7. A GTM indítását igazítsd a webshop meglévő CookieYes/consent beállításához. A modul canUseCookie konfigurációs függvénye további, futás közben is ellenőrzött engedélyezési pont. Alapértelmezése true; önmagában nem olvassa a CookieYes választását.
8. Ha a konténer őse rejtett, azt a CMS-ben külön láthatóvá kell tenni. A modul csak a saját cél-divjét mutatja meg.

A CDN csak a kódot szolgáltatja. Tokenérték nem kerül a fájlba vagy a CDN-kérésbe.

## ONe illesztés és bizonyíték

Az aktuális, publikus kliensforrásban azonosított hívások:

~~~js
window.$nuxt.$api.catalog.app.getProductBySlug(slug);
window.$nuxt.$api.catalog.app.getProductsListById(true, productIds);
~~~

Az ONe API-plugin getToken callbackje a store.state.auth.accessToken aktuális értékét adja át a saját API-rétegének; a frissítést is az ONe kezeli. A modul a meglévő klienst használja, nem állít elő vagy tárol második hitelesítési tokent. Az auth és vevői kontextus változásakor eldobja a régi válaszokat, és újrakéri az adatokat.

Ár és készlet:

~~~js
window.$nuxt.$api.pricing.app.fetchPricingForProducts({
  products: [{ productId: productId, quantity: quantityInContentUnits }]
});
window.$nuxt.$api.stock.app.post('/products/stocks', {
  skus: productIds,
  warehouses: warehouseIds,
  cartId: currentCartId
}, { authentication: 'public' });
~~~

A pricing metódus a POST /api/v1/pricing/app/auth-optional/get-price végpontot használja. A stock általános POST-hívás a POST /api/v1/stock/app/public/products/stocks végpontot használja. A 9.137.2 natív getStocksForProductsAndWarehouses metódusa GET-et küld, ezért itt nem azt hívja a modul.

A környezethez tartozó API-base URL és one-tenant fejléc az ONe kliens konfigurációjából jön. A JavaScriptben nincs prod/preprod hostlista vagy saját tokenes fetch; ugyanaz a betöltő mindkét környezetben működik.

Az aktuális raktár, raktárlista, kosár, pénznem, nettó/bruttó nézet és vásárlási/ármegtekintési engedély változása is új lekérést indít. Régi kontextusban indult válasz nem írja felül az új vevő kártyáit.

Az alkalmazás one-route-change eseményt küld a navigáció előtt. A modul a router afterEach hookját, DOM-változásfigyelést, vissza/előre és bfcache visszatérést is kezeli.

Ezek a klienskód alapján megfigyelt belső illesztések, nem verziófüggetlen, dokumentált ONe plugin-API garanciák. ONe frissítés után ellenőrizendők.

Vizsgált források:

- https://besttool.hu/format-lemezfuro-extra-rovid-din1897-dk77-hss-3-2mm-f111139-id-111139
- https://code.one.unity.pl/9.137.2/384c0e7.js – API-plugin, token callback, útvonal-esemény.
- https://code.one.unity.pl/9.137.2/973ee3c.js – natív terméklekérő store actionök.
- https://code.one.unity.pl/9.137.2/c94a199.js – pricing/stock SDK metódusok.
- https://code.one.unity.pl/9.137.2/1abc55d.js – általános POST, környezet, tenant és token továbbítása.
- https://code.one.unity.pl/9.137.2/80d296c.js – kosárba helyezés és kosárfrissítés store action.
- https://docs.b2b.one/links-to-swagger – hivatalos app Swagger-szerződések.

A két kért POST végpontot vendégként olvasási próbával ellenőriztem; mindkettő HTTP 200 választ adott. Hitelesített vevővel és tényleges kosármódosítással nem történt élő próba. A forrásvizsgálat a belső klienshívásokat igazolja; az automatizált tesztek ezek szerződését szimulálják. A bevezetés vendég és belépett vevő külön preprod integrációs ellenőrzését igényli.

## Ellenőrzés

A csomag tesztjei Node.js és jsdom környezetben futtathatók a modul könyvtárából: `npm install --ignore-scripts`, majd `npm test`. A tesztek közvetlenül a `release/manifest.json` által megnevezett JavaScriptet futtatják. Nincs külön, vele párhuzamosan karbantartott forrásmásolat. Az oldal csak a mintában megadott JS-t és CSS-t tölti be; a GitHub-repó többi követett fájlja is elérhető lehet külön CDN-URL-en.

Teszteld GTM Preview módban: közvetlen termékmegnyitás, legalább 7 termék, ismételt megtekintés, vissza/előre, nem termékoldalról visszatérés, későn létrejövő vagy újralétrejövő konténer, be-/kijelentkezés és vevőváltás.

A vevői árat ugyanarra a mennyiségre hasonlítsd össze a natív termékoldal árával. Ellenőrizd a nettó/bruttó váltást, raktárváltást, csomagolási szorzót, minimum rendelési mennyiséget, készletkorlátos és előrendelhető terméket, a fejléc kosárszámlálójának frissülését és pluginos termék saját folyamatát is.

Sikeres visszaigazoláskor a dokumentum one-recent-products-cart-added eseményt küld productId és quantity mezőkkel. A modul nem küld automatikus analitikai eseményt külső szerverre. Natív handlernél az ONe saját értesítései és mérési folyamata működnek.

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

## Karbantartás és archívum

A `release/` könyvtárban az aktív JS, CSS és manifest, valamint a még használt 1.2.0 beillesztés fájljai maradnak. Az 1.0.0 és 1.1.0 kiadások és a külön forrásmásolatok helyi, repón kívüli archívumba kerültek; lásd a [repó leírását](../README.md#fájlok-és-archiválás).

Új fejlesztéshez az aktív kiadásból készíts munkapéldányt a repón kívül. Új kiadáskor új verzióval és a végleges, LF sortöréses fájl SHA-256 hashének első 12 karakterével képzett fájlnévvel helyezd el a JS-t és CSS-t a `release/` könyvtárban. Frissítsd a manifestet és a betöltési mintát, majd futtasd a teszteket. Már közzétett, hash-t tartalmazó fájl tartalmát ne írd felül: az oldalon használt URL a meglévő kiadást azonosítja.

Az 1.2.0 CSS-fájlnév történelmi azonosító: a korábbi módosítások után már nem egyezik a tartalom hashének elejével. Az 1.2.1 fájlnevek és a manifest a végleges, LF sortöréses tartalom alapján készültek.

## 1.2.1 elrendezés

- A terméknév legfeljebb négy sor, három pont nélkül; a teljes név a link szövegében megmarad. A cikkszám közvetlenül a név alatt van.
- Egy sor kártyái közös CSS subgrid sorokhoz igazítják az árblokk alját, a raktárblokk alját és a Kosárba gombot. A név és cikkszám közös fejlécet kapott; az árblokk belső HTML-je változatlan.
- Az opcionális további költségek és a gomb alatti visszajelzések külön helyet kapnak, így nem tolják el a szomszédos gombokat.
- Ár hiányában a letiltott Kosárba gomb szürke, a webshop alap gombszíneit felülírva.
- 768 px szélességnél és alatta két kártya van soronként, 585 px alatt egy. A korábbi nagyobb képernyős oszlopszámok megmaradnak.
- Subgrid nélküli böngészőben a tartalék flex elrendezés az ár–raktár–gomb csoportot a kártya aljára rendezi.

A kiadást a webshop aktuális CSS-eivel, Chrome-ban 1440, 1199, 769, 768, 585, 584 és 375 px szélességen ellenőriztük, különböző hosszúságú nevekkel, hiányzó árral és további költség üzenettel.
