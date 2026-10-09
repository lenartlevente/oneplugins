# ONe plugins

ONe webshopmodulok. Licenc: [MIT](LICENSE).

## Legutóbb megtekintett termékek

Az aktuális 1.2.2 modul fájljai a [`recently-viewed-products/release/`](recently-viewed-products/release/) könyvtárban vannak. A telepítés és a működés leírása a [modul dokumentációjában](recently-viewed-products/README.md) található; a JS + CSS beillesztési minta a [`gtm-loader.html`](recently-viewed-products/gtm-loader.html). Az oldalon korábban használt 1.2.0 és 1.2.1 fájlok változatlanul megmaradnak; az új kiadáshoz a teljes beillesztési mintát frissíteni kell.

CDN: https://cdn.jsdelivr.net/gh/lenartlevente/oneplugins@HEAD/

## Fájlok és archiválás

- `release/`: az aktív JavaScript, CSS és az ezeket leíró `manifest.json`, valamint a korábbi beillesztésekhez szükséges 1.2.0 és 1.2.1 fájlok. Nincsenek külön forrásmásolatok.
- `tests/`, `package.json`: a kiadott JavaScript ellenőrzéséhez szükséges fejlesztési fájlok.
- `gtm-loader.html`, `cms-target.html`: beillesztési minták.
- `README.md`, `LICENSE`: dokumentáció és licenc.

A 2026. október 9-i rendrakáskor a régi 1.0.0 és 1.1.0 kiadások, valamint a külön JS- és CSS-másolatok a repón kívüli `../oneplugins-archive/2026-10-09-before-cleanup-e1f5165/` könyvtárba kerültek. Az archívum az eredeti könyvtárszerkezetet, az ellenőrzőösszegeket és a korábbi manifestet is megőrzi; helyi mentés, nem része a GitHub-repónak.

A jsDelivr GitHub-végpontja a repó fájljait szolgálja ki, nem a manifest alapján választ. Egy repóba commitolt `archive/` könyvtár is elérhető lenne a CDN-en, ezért az archívumot a repón kívül kell tartani. A korábbi commitokban és a CDN gyorsítótárában már meglévő fájlokat ez a rendrakás nem törli. [jsDelivr dokumentáció](https://github.com/jsdelivr/jsdelivr/blob/master/README.md#github)
