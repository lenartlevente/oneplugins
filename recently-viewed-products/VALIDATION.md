# Ellenőrzési eredmény – 2026. október 7.

Státusz: előkészített első verzió, 19/19 sikeres automatizált teszttel.

## Elvégzett ellenőrzések

- A megadott besttool.hu termékoldal publikus HTML-je, termékadatai, klienskonfigurációja és az oldalhoz tartozó ONe JavaScript-források vizsgálata.
- Az élő termékoldal DOM-jában a termékazonosító és a termékoldali adatok ellenőrzése.
- A CDN-es kliensfájl JavaScript szintaktikai ellenőrzése.
- 19 szimulált integrációs teszt jsdom 26.1.0 környezetben, az ONe kliens megfigyelt metódusszerződését helyettesítő tesztimplementációval.

| Ellenőrzött viselkedés | Eredmény |
| --- | --- |
| Valós besttool.hu mintatermékből kártya és süti | Sikeres |
| Host-only, Secure, SameSite=Lax, Path=/ munkamenetsüti | Sikeres |
| 7 termék után legfeljebb 6 egyedi azonosító | Sikeres |
| Ismételt megtekintés, legfrissebb elöl, query/hash kezelése | Sikeres |
| Vezető nulla és nagybetűs SKU megőrzése | Sikeres |
| Későn megjelenő és kicserélt konténer | Sikeres |
| Lassú, elhagyott oldalválasz eldobása | Sikeres |
| Korábbi vevő válaszának eldobása | Sikeres |
| Engedélyezés tiltása és későbbi engedélyezése | Sikeres |
| Inaktív, hiányzó és idegen domainre mutató termék kihagyása | Sikeres |
| Terméknév szövegként kerül a DOM-ba | Sikeres |
| Hibás vagy letiltott süti kezelése | Sikeres |
| 403 válasznál nincs újrapróbálkozás; a hibába nem kerül token | Sikeres |
| Átmeneti hibáknál véges újrapróbálkozás | Sikeres |
| Ismételt scriptbetöltés nem telepít második modul-példányt | Sikeres |
| ONe routeres kattintás és Ctrl-kattintás | Sikeres |
| Nem termékoldal nem kerül az előzménybe | Sikeres |
| Törlés csak a modul saját sütijét érinti | Sikeres |
| Vue által kiürített azonos konténer helyreállítása | Sikeres |
| Popstate és megszakított navigáció | Sikeres |

## Az eredmény határa

Nem történt GTM-publikálás, CDN-telepítés, hitelesített vevői API-próba vagy az éles oldalon a modul injektálása. A tesztek a modul logikáját és a forrásból azonosított ONe kliensszerződés használatát vizsgálják; nem igazolják a konkrét tenant éles végpontjainak összes jogosultsági és futásidejű viselkedését.

Élesítés előtt GTM Preview/preprod próba szükséges vendégként és bejelentkezett vevővel, a tényleges cél-divvel, CDN-URL-lel és a meglévő sütikezelési konfigurációval.
