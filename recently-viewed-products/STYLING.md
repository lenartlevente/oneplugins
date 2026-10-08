# Központi CSS és natív ONe osztályok – 1.2.0

A modul nem hoz létre stíluslapot vagy `style` elemet. A [one-recent-products.css](one-recent-products.css) teljes tartalmát másold a webshop központi CSS-ének végére, majd frissítsd a GTM betöltőt. Az ajánló `.one-rv` alá korlátozott szabályai a saját kártyáinak elrendezését, méretét, lekerekítését és árnyékát állítják be.

A besttool.hu 2026. október 8-án ellenőrzött készlet- és ármegjelenítő osztályait újrahasználja. Ezek a tenant központi CSS-éhez tartoznak; más ONe tenanton a megfelelő natív CSS is szükséges. A Bootstrap/ONe kosárgomb osztályai: `btn one-button btn-primary`.

## Raktár azonosítója

Példa a központi raktár készletes sorára:

```html
<li class="one-rv__stock-row fetis-stockbox__warehouse-row one-rv__warehouse-FETFLK one-rv__stock-row--available fetis-stockbox__warehouse-row--available"
    data-warehouse-id="FETFLK" data-stock-state="available"
    aria-label="Központi raktár: 6 Darab. Készleten.">
  <span class="one-rv__stock-dot fetis-stockbox__status-dot" aria-hidden="true"></span>
  <span class="one-rv__stock-name fetis-stockbox__warehouse-name">Központi raktár</span>
  <span class="one-rv__stock-value fetis-stockbox__warehouse-quantity">6 Darab</span>
</li>
```

| Raktár | Azonosító | CSS-osztály |
| --- | --- | --- |
| Központi raktár | `FETFLK` | `.one-rv__warehouse-FETFLK` |
| Budapest M3 Szerszámáruház | `FETM3` | `.one-rv__warehouse-FETM3` |
| Szolnok Szerszámáruház | `FETSZOL` | `.one-rv__warehouse-FETSZOL` |

A `data-warehouse-id` mindig az eredeti API-azonosítót tartalmazza. Betű, szám és kötőjel változatlanul kerül a class utótagjába; más karakterek `_hex_` alakban szerepelnek. A kis- és nagybetű megmarad. Összetett azonosítóra a pontos attribútumszelektor is használható: `.one-rv [data-warehouse-id="WH / 1"]`.

## Készletállapot

Minden látható raktársor megkapja a natív és az ajánló saját állapotosztályát is:

| Állapot | Natív CSS-osztály | Jelentés |
| --- | --- | --- |
| `available` | `.fetis-stockbox__warehouse-row--available` | Az adott raktár `quantity` értéke nagyobb nullánál |
| `other-stock` | `.fetis-stockbox__warehouse-row--other-stock` | Az adott raktárban nulla, de az összkészlet vagy egy másik ismert raktár készlete pozitív |
| `unavailable` | `.fetis-stockbox__warehouse-row--unavailable` | Az adott raktárban nulla, és az API összkészlete nulla, vagy az összes visszaadott raktársor ismert és nulla |
| `unknown` | `.fetis-stockbox__warehouse-row--unknown` | Hiányzó/hibás raktármennyiség, vagy nem eldönthető összkészlet |

A saját változatok előtagja `one-rv__stock-row`, például `.one-rv__stock-row--other-stock`. A `data-stock-state` ugyanezt az állapotot tartalmazza.

A meglévő központi CSS adja a három üzleti állapot pöttyének színét és kitöltését. Az ajánló CSS-je csak az ismeretlen állapotot jelöli semleges színnel. A mennyiség az API tartalmi egységében jelenik meg, csomagolási szorzó szerinti rendelési egységgé nem alakítja. Az állapot nem a kosárba tehető minimum mennyiségre utal; a kosárgomb külön ellenőrzi a rendelhetőséget.

`HIDDEN` készletmódban az ajánló továbbra is csak összesített elérhetőségi szöveget mutat. Nem készít számszerű készlet alapján raktársorokat vagy állapotosztályokat.

Csak ebben az ajánlóban érvényes stíluspélda:

```css
.one-rv .one-rv__warehouse-FETFLK .fetis-stockbox__warehouse-name {
  font-weight: 700;
}

.one-rv .one-rv__stock-row--available .fetis-stockbox__status-dot {
  border-color: #0aa44f;
  background-color: #0aa44f;
}
```

## Kártya és ár

A kártya alapállapotban halvány árnyékot, hover és billentyűzetes fókusz esetén erősebb árnyékot kap. A lekerekítés és árnyék CSS-változókkal felülírható:

```css
.one-rv {
  --one-rv-radius: 24px;
  --one-rv-shadow: 0 4px 18px rgba(0, 0, 0, .07);
  --one-rv-shadow-hover: 0 12px 28px rgba(0, 0, 0, .14);
}
```

Az ár natív osztályai: `price_column`, `transactional_price`, `gr_net_unit`, továbbá megfelelő API-adat esetén `crossed` és `discount`. Az árblokk háttere átlátszó. A vevői összeg két tizedessel, külön sorban a nettó/bruttó és rendelési egység jelölésével szerepel. Egynél nagyobb minimum mennyiségnél ezt is feltünteti, például `(Nettó/2 doboz)`; az összeg ennek teljes ára.

Az áthúzott listaár és százalékos kedvezmény csak akkor jelenik meg, ha az adott nettó/bruttó árnézethez a kért mennyiségre érvényes `catalogPriceNet`/`catalogPriceGross` magasabb a vevői árnál. A százalék e két értékből számított, egészre kerekített összehasonlítás. Hiányzó vagy alacsonyabb listaárból nem készít kedvezményjelzést.

Az ONe belső Vue `data-v-*` attribútumait nem utánozza; a tenant központi osztályait és az ajánló saját, stabil szelektorait használja. A stíluspróba a natív publikus CSS-sel és tesztadatokkal történik; a tényleges preprod központi CSS-sel az integrációt még ellenőrizni kell.
