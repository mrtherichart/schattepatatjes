# Schattepatatjes

Een persoonlijke gezinsapp voor boodschappen, gedeelde taken, profielen en krabbels, in een warme Web 2.0-stijl. De Android-architectuur volgt WorkClock; de gezinsserver blijft een kleine PHP/JSON-API op **https://mrtherich.nl/sp/api.php**.

## Installatie

Download uitsluitend de **ondertekende APK** van [GitHub Releases](https://github.com/mrtherichart/schattepatatjes/releases/latest). In de Android-app: **Instellingen → App bijwerken** om nieuwe releases op te halen. Android vraagt altijd zelf toestemming voor installatie.

Er is nog geen release beschikbaar tot de twee repository secrets zijn ingesteld en **Signed Android release** is uitgevoerd. Een debug-build uit Actions is niet geschikt om over een ondertekende versie te installeren. Versie 0.5.1 kan wel als update over de bestaande, met dezelfde sleutel ondertekende v0.3 en v0.4 worden geïnstalleerd.

## Structuur

- `app/src/main/java/.../*.kt`: kleine Kotlin Android-shell, file picker en updater.
- `index.html`, `styles.css`, `app.js`, `assets/`: **één gedeelde** HTML-interface voor de APK en de Safari-webapp. Gradle bundelt die bestanden vanuit de root in de APK.
- `api.php`, `config.example.php`: PHP-server met JSON-bestand buiten de openbare webmap.
- `sw.js`, `manifest.webmanifest`: Safari/PWA, niet actief in de Android WebView.
- `.github/workflows/android.yml`: Kotlin/debug APK voor validatie, geen update.
- `.github/workflows/stable-release.yml`: geteste, ondertekende APK als versiegebonden GitHub Release.

Net als bij WorkClock blijft de ontwikkelbron in de VM. GitHub is voor publicatie en Android-builds, zonder lokale Git-commando's.

## Hoe de Android-app met PHP werkt

`WebViewAssetLoader` levert HTML/CSS/JS uit de APK op het HTTPS-adres `https://mrtherich.nl/sp/index.html`. Alleen `https://mrtherich.nl/sp/api.php` is geen lokaal asset en gaat met de gewone POST-body en sessiecookies naar de echte host. Daarom werkt de interface zonder internet terwijl gedeelde gegevens synchroniseren zodra de PHP-server bereikbaar is. De browser/PWA gebruikt dezelfde bestanden op je hosting.

Plaats `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest`, `api.php`, `assets/`, `.htaccess` en een **eigen geheime** `config.php` in `/sp/`; die secret/configuratie hoort nooit in GitHub. De website moet vanaf Safari bereikbaar zijn; een 403 betekent dat hosting nog niet correct is ingericht.

## Android-signing en publicatie

De twee bestaande GitHub-repository secrets blijven exact hetzelfde:

- `SCHATTEPATATJES_KEYSTORE_B64`: base64 van je **bestaande** `.jks`.
- `SCHATTEPATATJES_SIGNING_PASSWORD`: het bijbehorende wachtwoord.

De keystore blijft privé en wordt op de GitHub-runner tijdelijk gedecodeerd. De release-workflow stopt vóór ondertekenen en publiceren als een van beide secrets ontbreekt. Hij verifieert de vaste SHA-256-certificaatfingerprint, app-ID en de aanwezigheid van de HTML-assets in de APK. Daarna maakt hij `v0.5.1` met `Schattepatatjes.apk`. Voor een volgende release: verhoog `versionCode` en `versionName` in `app/build.gradle.kts` (en de getoonde appversie).

De updater gebruikt alleen GitHub Releases, controleert SHA-256, de pakket-ID en de **zelfde certificaatfingerprint**, en opent vervolgens de Android-pakketinstaller. Hij kan de update niet stilletjes installeren. Vanaf de eerdere v0.4 moet je één keer de nieuwe APK handmatig installeren, omdat v0.4 nog een andere updatebron gebruikte.

## Testen

`node --check app.js`, `node tests/check-project.cjs`, `php -l api.php`. De Actions-testbouw compileert de Kotlin-app en controleert dat Android-assets daadwerkelijk in de APK zitten. Op een echte telefoon blijven installatie, foto-kiezer, Android-permissie en servergedrag nog te verifiëren.

## Serververbinding zichtbaar (versie 0.6.0)

De statusstrook onder de appnaam meldt of gezinsgegevens werkelijk gesynchroniseerd zijn, of er aanmelding nodig is, of een serverfout is opgetreden en hoeveel wijzigingen nog wachten. **Instellingen → Verbinding en synchronisatie** laat nu de bereikbaarheidscontrole, aanmelding, laatste succesvolle synchronisatie, wachtende wijzigingen en concrete foutmelding zien. Onder *Technische details* staan het exacte API-adres, HTTP-status, reactietijd, PHP-API-versie en opslagstatus. Er is een knop **Verbinding testen**, een knop **Nu synchroniseren** bij aangemelde gebruikers en een optie om een diagnose zonder wachtwoorden te kopiëren.

De nieuwe PHP-endpoint `api.php?action=health` beantwoordt een eenvoudige controle ook zonder aanmelding. Hij deelt geen privégegevens of sleutels. De WebView gebruikt nog steeds uitsluitend de echte gezinsserver voor synchronisatie; de interface werkt lokaal uit de APK. **Upload zowel het vernieuwde `api.php` als de webbestanden** voor iPhone/PWA; een APK-update alleen werkt met een oudere API niet volledig.

De laatste succesvolle synchronisatietijd wordt lokaal bewaard. Bij een serverstoring blijven lokale wijzigingen in de wachtrij, zodat ze later opnieuw verstuurd kunnen worden.
