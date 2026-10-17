# Webapp publiceren vanaf GitHub (zonder de server mee te nemen)

Deze procedure publiceert alleen frontendbestanden; `api.php`, `config.php`, privé-JSON en APK's worden niet aangeraakt. De online webapp gebruikt `/sp/`, de PHP-API blijft op `/sp/api.php`. De Android-APK draait offline en haalt zijn updates via GitHub Releases.

## Eenmalige hostinginstallatie

1. Maak een **controleerbare backup** van de bestaande `/sp/`-map, inclusief `config.php`, en maak een afzonderlijke backup van de JSON-data **buiten** de webroot. Controleer dat de JSON-backup daadwerkelijk kan worden gelezen. Maak geen gebruik van de webdeployer voordat je die backups hebt.
2. Installeer het bestaande serverbestand apart: kopieer `server/api.php` naar `/sp/api.php` én `server/lib/` naar `/sp/lib/` (inclusief de afschermende `.htaccess`) (alleen als een serverupdate is goedgekeurd). Laat de bestaande `/sp/config.php`, sessies en privé-data ongemoeid. Nieuw installeren? Kopieer `server/config.example.php` naar een privé `/sp/config.php` en vul de eenmalige installatiesleutel in.
3. Kopieer eenmalig de PHP-bestanden uit `deploy/hosting/` naar `/sp/`: `index.php`, `sw.php`, `web-update.php`, `.htaccess`. Kopieer daarnaast `deploy/lib/WebRevisions.php` als `/sp/WebRevisions.php`.
4. Kopieer `deploy/hosting/web-config.example.php` naar `/sp/web-config.php`. Maak een **nieuwe sterke unieke webdeploysleutel van 32+ tekens**, vervang de voorbeeldwaarde en publiceer dit bestand **niet** op GitHub. Deze sleutel staat volledig los van de gezins- en Android-sleutels.
5. Maak de map `/sp/static/revisions/` en kopieer de inhoud van `deploy/hosting/static-revisions.htaccess` naar `/sp/static/revisions/.htaccess`. Zorg dat `/sp/.web-state/` door PHP schrijfbaar is, maar **niet** via HTTP bereikbaar. De PHP-deployer maakt de map zelf aan als deze niet bestaat en schrijft daarin een Apache-denybestand.
6. Zorg dat PHP `allow_url_fopen` en HTTPS/TLS-toegang tot de GitHub API en `raw.githubusercontent.com` heeft. De deployer gebruikt **geen** git-binary. Apache moet `.htaccess` en `DirectoryIndex index.php` respecteren. **Verifieer dit**; bij een oude `/sp/index.html` moet `/sp/` daadwerkelijk `index.php` uitvoeren. Verwijder oude bestanden pas nadat je werking en backups hebt bevestigd.
7. Open `https://mrtherich.nl/sp/web-update.php` via HTTPS en plak een concrete **40-tekens SHA van een gecontroleerde commit op main** plus je webdeploysleutel. De pagina downloadt alleen de toegestane bestanden uit `/web/`, inclusief `modules/**/*.js` en `styles/*.css` en controleert elk bestand met de Git-blobhash voordat hij de actieve pointer atomair omwisselt.
8. Controleer `/sp/`, `/sp/sw.php`, versiegebonden statische bestanden, de iPhone-PWA, `/sp/api.php?action=health` en synchronisatie. Verifieer dat de Android-app nog met de API werkt.

**Niet automatisch uploaden:** `/sp/config.php`, `/sp/web-config.php`, privé-data en Android-keystore horen nooit in een hosting- of GitHub-bronpakket. De deployer kan PHP-servercode niet bijwerken.

## Elke volgende webupdate

Ga naar `/sp/web-update.php`, vul de volledige commit-SHA en webdeploysleutel in, en kies **Download, controleer en activeer**. De website blijft gewoon werken wanneer GitHub offline is. De oude revisie blijft beschikbaar; met **Terugzetten** kun je de vorige revision opnieuw activeren. Een mislukte download laat de actieve versie onaangeroerd. Gebruik na de update een harde refresh; de serviceworker wordt vanaf `/sp/sw.php` ververst.

## Hostingbeveiliging: belangrijke grens

De code schrijft uitsluitend naar `/sp/static/revisions/` en `/sp/.web-state/`, weigert PHP-bestanden en verifieert Git-integriteit. Maar **PHP-code die onder dezelfde hostinggebruiker draait, heeft mogelijk technisch toegang tot zowel web- als serverbestanden**. Dit is dus geen afdwingbare OS- of accountisolatie. Voor een harde veiligheidsgrens: plaats backend-data/config buiten webroot, gebruik aparte hostinggebruikers of gescheiden services, beperk schrijfrechten en test het ook op je werkelijke hosting. Zonder bewezen hostingrechten mag je de deployer niet voorstellen als een strikt geïsoleerde server.

Controleer expliciet dat `/sp/lib/*.php` HTTP 403 geeft (ook als `.htaccess` niet wordt ingelezen), en dat `/sp/config.php`, `/sp/web-config.php`, `/sp/WebRevisions.php`, `/sp/.web-state/current.json` en bestanden in de JSON-privémap niet publiek uitleesbaar zijn, en dat de webserver geen PHP uitvoert binnen `/sp/static/revisions/`. De meeste Apache-configuraties gebruiken `.htaccess`; bij Nginx of een hostingomgeving die deze regels negeert, moet de hoster equivalente serverregels instellen voordat de deployer online mag.

## Terugzetten

Web: druk **Terugzetten** in `/sp/web-update.php`; de previous-revisie wordt weer current. Server: gebruik je eigen aparte serverbackup en controleer eventuele JSON-schemawijzigingen; terugzetten van PHP-code is niet hetzelfde als terugzetten van gegevens. Android: geen downgrade over een hoger geïnstalleerd `versionCode`; eerst een ondertekende reparatierelease met hoger buildnummer.
