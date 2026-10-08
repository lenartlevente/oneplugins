# ONe – utolsó 6 megtekintett termék

1.2.0 kliensmodul a besttool.hu ONe Front Office felületéhez, vevői árral, készlettel, kosárgombbal és központi CSS-ből kezelt megjelenéssel.
Az ellenőrzött oldal az ONe 9.137.2 kliensét használta 2026. október 8-án.
Integrációs ellenőrzésre előkészített kiadás; GTM-publikálás és hitelesített vevői kosárpróba nem történt.

A forrás helye: [lenartlevente/oneplugins – recently-viewed-products](https://github.com/lenartlevente/oneplugins/tree/main/recently-viewed-products).
A végleges tárolási és CDN-architektúrajavaslat: [STORAGE-CDN.md](STORAGE-CDN.md).
CSS-beillesztés, natív osztályok és raktár/állapot szelektorok: [STYLING.md](STYLING.md).
A `release/` mappában a változatlan futó kód verziózott kiadási fájlja és az ellenőrzőösszegeket tartalmazó manifest található.

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
- A modul nem injektál CSS-t; a kártyák lekerekítését, halvány és hover/fókusz árnyékát a külön one-recent-products.css kezeli a központi stíluslapból.
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

1. Másold a one-recent-products.css tartalmát a webshop központi CSS-ének végére. A JavaScript ezt nem tölti be automatikusan; az új GTM-betöltőre ezután válts. A besttool.hu meglévő fetis-stockbox és árstílusai is szükségesek. A részleteket a STYLING.md tartalmazza.
2. A release/manifest.json által megnevezett JavaScript a külön GitHub-repóból, jsDelivr-en keresztül tölthető be. A forrásfájl neve one-recent-products.v1.js; a GTM számára konkrét commitból betöltött kiadási fájl ajánlott.
3. A cms-target.html tartalmát helyezd el a termékoldal kívánt CMS HTML-blokkjában.
4. Ha meglévő üres UUID-s divet használsz, annak ID-jét add meg a GTM betöltő data-target-id attribútumában. A cél-div kizárólag e modulhoz tartozzon. Más célra használt rejtett ONe-elemet ne adj meg.
5. A gtm-loader.html script sorát tedd a GTM Custom HTML tagjébe. A CDN-host és a cél-div ID előre ki van töltve.
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

A csomag tesztjei Node.js és jsdom környezetben futtathatók: npm install --ignore-scripts, majd npm test. A fejlesztési csomagot és a teszteket nem kell CDN-re feltölteni; csak a release/manifest.json által megnevezett JavaScript-fájl kerül oda.

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
