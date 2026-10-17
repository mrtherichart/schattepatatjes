> **v0.0.2:** De actuele functionele architectuur staat in [contracts/foundation-v2.md](contracts/foundation-v2.md); installatie en integraties in [RELEASE-v0.0.2.md](RELEASE-v0.0.2.md). De oudere beschrijving hieronder documenteert de vorige interface.

# Schattepatatjes

Persoonlijke gezinsapp voor boodschappen, taken, profielen en krabbels. De interface is voor Android (Kotlin/WebView) en browser/PWA identiek; de gezinsgegevens worden via een zelfstandige PHP/JSON-server gesynchroniseerd.

**Lees [ONTWIKKELSTRUCTUUR.md](ONTWIKKELSTRUCTUUR.md) voordat je iets wijzigt.** WorkClock is de technische referentie voor de Android-laag. Ontwikkel en test in de VM; GitHub is uitsluitend voor publicatie, Android-testbuilds en releases. Geen lokale Git-workflow.

## Bronnen en verantwoordelijkheid

| Pad | Inhoud | Publicatie |
| --- | --- | --- |
| [`web/`](web/) | HTML/CSS/JS, afbeeldingen, manifest, serviceworker | Website via beveiligde GitHub-revisie-deployer; dezelfde bron gaat in APK |
| [`app/`](app/) | Kotlin, `WebViewAssetLoader`, fotokiezer en updater | Ondertekende APK via [GitHub Releases](https://github.com/mrtherichart/schattepatatjes/releases) |
| [`server/`](server/) | PHP-API en voorbeeldconfiguratie; private JSON buiten webroot | Apart en handmatig naar hosting, nooit via webdeployer |
| [`deploy/`](deploy/) | Veilige PHP-webbootstrap en webrevisiebeheer | Eenmalige hostinginstallatie, vervolgens alleen webrevisies bijwerken |
| [`tests/`](tests/) | API-, webdeploy-, integriteits- en projectchecks | Lokaal en in CI |

De drie onderdelen hebben **onafhankelijke releases**. Het API-adres blijft `https://mrtherich.nl/sp/api.php`, de webapp blijft `https://mrtherich.nl/sp/` en Android-updates gebruiken alleen GitHub Releases. Gebruikersdata, localStorage-sleutels, Android-pakket-ID en signing-fingerprint blijven behouden.

## Zelf hosten

Zie [deploy/INSTALLATIE.md](deploy/INSTALLATIE.md). De initiële installatie vergt eenmalig uploaden van de PHP-bestanden. Daarna kan de webinterface via de beschermde pagina `/sp/web-update.php` uit een specifieke GitHub-commit worden vernieuwd; de gezinsserver wordt daarbij nooit meegeüpdatet. De pagina werkt met een aparte, sterke webdeploysleutel. De twee bestaande GitHub Secrets voor Android-signing blijven ongewijzigd.

Er is **geen productie-deploy uitgevoerd** door het publiceren van deze code. Bestaande API-data wordt niet automatisch gemigreerd.

## Testen

```sh
node --check web/app.js
node tests/check-project.cjs
node tests/server-diagnostics.test.cjs
node tests/hosting-smoke.cjs
php tests/web-revisions.test.php
php -l server/api.php
```

De Android-testworkflow bouwt een debug-APK en controleert APK-inhoud. De release-workflow is *uitsluitend handmatig*, vereist de bestaande vaste signing-credentials en een expliciete versieophoging. Een debug-APK is **geen** update voor de ondertekende app.

## Versie en compatibiliteit

De refactor verandert **geen** Android-releaseversie. De huidige bron volgt versie 0.6.0 (`versionCode 7`); een daadwerkelijke nieuwe release vereist een geteste Android-upgrade, een hoger versienummer en een afzonderlijke handmatige releasehandeling. Een succesvolle build is geen bewijs van succesvolle installatie op een toestel.
