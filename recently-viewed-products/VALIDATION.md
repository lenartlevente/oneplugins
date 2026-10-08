# Ellenőrzési eredmény – 2026. október 8., 1.2.0

Státusz: 49/49 sikeres automatizált teszt, JavaScript szintaktikai ellenőrzés, natív CSS-sel végzett böngészős megjelenítési próba és az 1.1.0 fejlesztése során két sikeres, csak olvasási célú vendég POST-próba. Hitelesített vevővel tényleges kosárírás nem történt.

## Igazolt szerződések

A hivatalos Swagger app v1 leírásokból ellenőrzött végpontok:

- POST `/api/v1/pricing/app/auth-optional/get-price`: `{products:[{productId,quantity}]}`, válasz termékazonosítónként `quantity`, `priceNet`, `priceGross` és `additionalCosts`.
- POST `/api/v1/stock/app/public/products/stocks`: `{skus,warehouses,cartId?}`, válasz termékazonosítókra kulcsolt objektum, `stockVisibilityMode`, `available` és raktáranként `quantity` mezőkkel.
- POST `/api/v1/orderpath/app/auth-optional/cart/{cartId}/products`: a natív kosárfolyamat használja, rendelési mennyiséggel és raktárkontextussal.

Forrás: https://docs.b2b.one/links-to-swagger ; a prod pricing, stock és orderpath app v1 specifikáció 2026. október 8-i állapota.

A 9.137.2 publikus ONe kliensben ellenőrzött integráció: natív ármetódus, általános POST, konfigurált API-base, aktuális token callback, készlet- és kosár store actionök. A native stock segédmetódus GET-et használ, ezért az új modul a kért POST-ot explicit hívja.

## Vendég olvasási próba

A `fetis` tenant prod API-ján, a nyilvános `111139` termékkel:

| Próba | Eredmény |
| --- | --- |
| Árkérés 1 és 2 tartalmi egységre | HTTP 200; a két ár a kért mennyiség teljes ára |
| Készlet POST a három ismert raktárra | HTTP 200; a Swaggerrel egyező objektum és raktársorok |

Bearer token nem került a tesztkódba, nem történt felhasználói bejelentkezés vagy kosárírás. A vendégpróba a végpontokat és az árszemantikát igazolja; vevőspecifikus kedvezményt nem igazol.

## Automatizált ellenőrzés

Node.js, jsdom 26.1.0, `node --test tests/recent-products.test.cjs`.

| Terület | Vizsgált esetek |
| --- | --- |
| Előzmények | Legfeljebb 6 egyedi SKU, sorrend, újranézés, query/hash, vezető nulla, munkamenetsüti, tiltott/hibás süti, más tároló használatának kizárása |
| PWA/DOM | Router, vissza/előre, megszakított és elhagyott útvonal, késői/újra létrejövő konténer, singleton, törlés |
| Árazás | Natív kliens, aktuális token, preprod kliens elkülönítése, minimum mennyiség × csomagolás, tört mennyiség, nettó/bruttó és pénznemváltás |
| Árhibák | Hiányzó/null/eltérő mennyiségű ár, kifejezett nullaár, 403 és további költségek jelzése |
| Készlet | POST payload, aktuális kosár és raktár, régi válasz eldobása, HIDDEN mód, ismeretlen készlet és készletkorlátos termék |
| Kosár | Rendelési egységben küldött minimum mennyiség, natív handler előnyben, rendelési plugin megőrzése, tájékoztató termékadat elkülönítése, pluginregiszter változása, regisztrált store action és kosárfrissítés |
| Írási védelem | Dupla kattintás, olvasási timeouttól független írási zárolás, újrapróbálkozás kizárása, régi vevőnek indított művelet visszajelzésének eldobása |
| Navigáció és hibák | Kép/név kattintható marad, gomb nem link; nevek szövegként, hibák token/HTTP-fejléc nélkül |
| Készletosztályok | Raktárazonosító, available/other-stock/unavailable/unknown, natív pöttyosztályok, hiányos összkészlet, összetett azonosító kódolása |
| Ármegjelenítés és CSS | Natív árosztályok, két tizedes, külön egységsor, megfelelő mennyiségű listaár és számított kedvezmény, CSS-injektálás kizárása és régi stíluselem eltávolítása |

## Böngészős stíluspróba

Chromium 151, tesztadatokból a tényleges modul által generált HTML, a besttool.hu 2026. október 8-i publikus központi CSS-ével. Külső böngészős hálózati kérések blokkolva; nem történt bejelentkezés vagy kosárírás.

| Ellenőrzés | Eredmény |
| --- | --- |
| Csak a natív CSS | Az ár színe és a három üzleti készletállapot pöttyének színe/kitöltése helyes; a saját kártyarácsot és árnyékot ez nem biztosítja |
| Natív CSS + one-recent-products.css | 1440 px-en 6 oszlop, 960 px-en 3, 390 px-es mobilnézetben 2; vízszintes túlcsordulás nélkül |
| Kártya | 24 px-es desktop és 18 px-es mobil lekerekítés; halvány alapárnyék és erősebb hover-árnyék |
| Árblokk | Átlátszó háttér, vevői ár és külön egységsor; megfelelő listaár esetén áthúzás és kedvezmény |
| Készlet | Natív zöld kitöltött, piros üres és piros kitöltött pötty; ismeretlen adat semleges pötty |

A desktop és mobil képernyőképeket vizuálisan is ellenőriztem. A mobil sorokban a mennyiség a raktárnév alatt szerepel, hogy a hosszú raktárnevek több helyet kapjanak. Ez helyi stíluspróba; a preprod tenant saját CSS-ébe való beillesztés még nem történt meg.

## Még szükséges élő integrációs próba

GTM Preview/preprod, tényleges cél-divvel és webshop CMP-konfigurációval:

1. Vendég, bejelentkezett vevő és vevőváltás: azonos mennyiségre a natív termékoldallal egyező ár.
2. Raktárváltás, nettó/bruttó váltás és csomagolási egység.
3. Kosárba helyezés, fejléc számlálója, kosártartalom és backend mennyiségi/készletszabályok.
4. Egyedi rendelési pluginnal rendelkező termék saját folyamata.
5. Legalább 7 termék, PWA-vissza/előre és konténer újralétrejötte.

A szimulált tesztek nem helyettesítik a konkrét preprod tenant jogosultsági és hitelesített kosárműködésének ellenőrzését. Az ONe belső Vue/SDK illesztések verzióváltáskor újra ellenőrizendők.
