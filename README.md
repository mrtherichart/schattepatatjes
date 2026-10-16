# Schattepatatjes — versie 0.2

Een gezellige, eigenzinnige gezinsapp in een verzorgde Web 2.0-stijl: een beetje 2007, zonder kinderachtige aankleding. **Eén gewone HTML/CSS/JavaScript-interface**, met een kleine PHP/JSON-server. Android gebruikt later een native WebView-omhulsel; op iPhone installeer je dezelfde website als webapp op het beginscherm.

## Wat al werkt

- **Thuis**: een gedeeld overzicht met boodschappen, naderende taken, gezinsleden en krabbeltjes.
- **Boodschappen**: snel toevoegen, hoeveelheden, winkels, afvinken, terugvinden en opnieuw toevoegen. Winkels filteren dezelfde gezamenlijke lijst. Nieuwe winkels maak je direct bij een product aan.
- **Productkaartjes**: wat je toevoegt blijft beschikbaar als herbruikbaar product. Je kunt een kleine eigen foto kiezen, een HTTPS-afbeeldingslink invullen of vanuit de ingelogde versie Open Food Facts doorzoeken (als die dienst bereikbaar is).
- **Taken**: zichtbaar voor iedereen; optioneel aan één gezinslid toegewezen. Deadline en dagelijkse, wekelijkse of maandelijkse herhaling zijn mogelijk. Geen kalender nodig.
- **Profielen**: persoonlijke avatar, korte status, bio, zes kleurthema's, en onderlinge krabbels. Extra gezinsleden voeg je toe via instellingen.
- **Lokaal proberen**: de app start met voorbeeldinhoud en bewaart wijzigingen op het toestel.
- **Samen gebruiken**: na eenmalige serverinstallatie werken alle toestellen op één gedeelde gezinsruimte. Losse wijzigingen worden met bestandsvergrendeling verwerkt en tijdelijk offline in een wachtrij gezet.

## Zo probeer je de app lokaal

De VM-map is `/mnt/data/bij-ons-v1/`. Daarin staat het volledige project. Start de ontwikkelserver:

```bash
cd /mnt/data/bij-ons-v1
php -S 127.0.0.1:8787 -t .
```

Open vervolgens `http://127.0.0.1:8787/` op hetzelfde apparaat. Zonder installatie krijg je de voorbeeldinhoud. **Gebruik lokaal geen productiegezinswachtwoord.**

## Op je shared hosting zetten

1. Controleer dat de hosting **PHP 8.1 of hoger**, HTTPS en schrijfrechten voor een map *buiten de publieke document-root* ondersteunt. Geen database of PHP-framework nodig.
2. Maak op de hosting eerst een eigen `config.php` door `config.example.php` te kopiëren en daarin een lange willekeurige installatiesleutel te zetten. Upload daarna `index.html`, `styles.css`, `app.js`, `api.php`, je privé-`config.php`, `manifest.webmanifest`, `sw.js`, `.htaccess` en de hele map `assets/` naar bijvoorbeeld `https://mrtherich.nl/sp/`. Upload geen voorbeeldscreenshots, Android-bronnen of losse installatiesleutel als publiek bestand.
3. Open de website, klik rechtsboven op het tandwiel en vul onder *Samen synchroniseren* de gegevens in. De eenmalige installatiesleutel staat in `config.php`, achter `BIJONS_SETUP_KEY`. De demo-inhoud wordt vervangen door een lege gezamenlijke ruimte.
4. Kies een **sterk gezamenlijk wachtwoord** (minimaal 10 tekens), dat je vrouw ook kan gebruiken om in te loggen. Open dezelfde URL op haar iPhone en log in via de instellingen. Tik rechtsboven op haar avatar om vanaf haar toestel de juiste persoon als actieve gebruiker te kiezen.
5. Gebruik bij voorkeur een eigen submap of subdomein. De JSON-data en automatische dagback-ups worden door PHP buiten de publiek zichtbare document-root geplaatst (`bijons-private-...`). Mocht je hosting dat verbieden, dan geeft de API bewust een foutmelding. Zet de data **niet zomaar publiek in de webmap**.

**Let op: deze GitHub-repository is openbaar.** De echte `config.php`, installatiesleutel en gezinsgegevens zijn bewust uitgesloten van de gepubliceerde broncode. Upload geen eigen gezinsfoto’s naar GitHub.

**Beveiliging in v0.1:** alle gezinsleden delen één wachtwoord, zonder individuele rechten. Hun identiteit in de interface is een gekozen avatar, geen afzonderlijk beveiligd account. Dit past bij een klein privégezin, maar is niet geschikt voor grotere of niet-vertrouwde groepen. Gebruik HTTPS en publiceer `config.php` nooit als broncode. De installatiesleutel is eenmalig nodig; bewaar deze privé.

## Op de iPhone

Open de gehoste HTTPS-URL in **Safari**, gebruik *Deel → Zet op beginscherm* en zet desgewenst *Open als webapp* aan. Dit is blijvend bruikbaar zonder Apple Developer-lidmaatschap of wekelijkse heractivatie.

## Op Android

De map `android/` bevat de **broncode** van de native Android WebView-omhulling. Die laadt dezelfde gehoste app via HTTPS; hij heeft een native afbeeldingskiezer en schermvullende WebView. Er is **nog geen APK gebouwd** in deze VM (de Android SDK en Gradle-toolchain ontbreken hier). Je kunt een debug-APK laten bouwen met Java 17, Android SDK 35, Gradle 8.9 en een passende Android Gradle Plugin:

```bash
cd android
gradle :app:assembleDebug -PschattepatatjesUrl=https://mrtherich.nl/sp/
```

Voor een APK kun je op GitHub bij **Actions → Android APK bouwen → Run workflow** de volledige HTTPS-hosting-URL invoeren. De APK verschijnt als downloadbaar build-artifact. Dit is een debug-APK, nog geen officiële Play Store-release. **Gebruik de voorbeeld-URL in `android/app/build.gradle` niet voor de echte APK.** De app heeft internet nodig om de server te bereiken, maar de webinterface kan dankzij caching ook tijdelijk offline openen.

## Belangrijke beperkingen van v0.1

- Er zijn nog geen pushmeldingen of agenda-integraties.
- Alleen zes vaste profielthema's; geen vrij te verslepen Hyves-widgets.
- Er is nog geen echte, losse accountaanmelding per persoon. Iedereen met het gezinswachtwoord kan alles zien en wijzigen.
- Productfoto's worden lokaal verkleind en voorlopig als compacte gegevens in JSON opgeslagen. Dat is prima om te proberen, maar bij veel honderden foto's willen we aparte afbeeldingsbestanden op de server.
- Offline wijzigingen worden in de browseropslag bewaard. Wis niet de sitegegevens van de telefoon als er nog niet gesynchroniseerde wijzigingen zijn.
- De server verwerkt wijzigingen afzonderlijk zodat verschillende taken/producten niet elkaar overschrijven. Als twee mensen *tegelijk hetzelfde veld* aanpassen, wint de wijziging die het laatst op de server aankomt.
- Open Food Facts is een aparte, optionele dienst, uitsluitend voor voedingsproducten. Zoekresultaten hangen af van hun API en licentievoorwaarden; de app biedt daarom ook zelf foto's kiezen en een URL plakken.
- Als je de webcode aanpast, verhoog dan de versienummers in `index.html`, `sw.js` en de cachenaam om verouderde webappbestanden te voorkomen.

## Technische kern

- Frontend: `index.html`, `styles.css`, `app.js`; geen frontend-framework, geen externe lettertypen of tracking.
- Offline shell: `sw.js` en `manifest.webmanifest`.
- API: `api.php`; PHP-sessiecookies met een met `password_hash` opgeslagen gezinswachtwoord.
- Data: een JSON-bestand buiten de document-root. Schrijven gebruikt `flock()` en een atomische hernoeming; dubbele berichten hebben een idempotentie-ID. Één dagbackup wordt bewaard vóór de eerste wijziging van de dag.
- Android: eenvoudige Java WebView-wrapper; de appcode staat centraal op je eigen hosting.

Dit is een **eerste werkende versie** om de sfeer, navigatie en lijstinteractie daadwerkelijk op een telefoon te beoordelen. Pas daarna de details verder aan.

## Vaste locatie en naam

- Appnaam op Android, iPhone en in de browser: **Schattepatatjes**.
- Hostinglocatie: **https://mrtherich.nl/sp/**. Alle webverzoeken en PWA-bestanden gebruiken relatieve paden binnen `/sp/`.
- De Android-build gebruikt deze URL standaard; via de workflow-input kun je hem later wijzigen.
- De interne naam `bijons` in bestaande lokale opslagsleutels, sessiecookies en `BIJONS_SETUP_KEY` blijft voorlopig behouden voor compatibiliteit.

### De URL geeft 403 Forbidden

Zolang `/sp/` een 403 geeft, is Schattepatatjes nog niet live. Upload eerst de **publieke webbestanden** naar de webmap die bij `/sp/` hoort, inclusief `index.html`, `api.php`, `.htaccess`, `styles.css`, `app.js`, `manifest.webmanifest`, `sw.js` en `assets/`. Upload je echte `config.php` uitsluitend rechtstreeks naar die hosting; plaats dat bestand en de installatiesleutel nooit in de publieke GitHub-repository.

Als er daarna nog 403 staat, controleer dan bij de hosting of `/sp/` naar de juiste map verwijst, of `index.html` bereikbaar is, de map- en bestandsrechten kloppen en of `.htaccess` of een beveiligingsregel de toegang blokkeert. De Android-APK kan al worden gebouwd, maar toont pas een werkende app zodra de server bereikbaar is.

## Android APK en eigen updatesleutel (v0.3)

De Android-APK bevat `index.html`, `app.js`, `styles.css`, het manifest en de afbeeldingen zelf. De WebView laadt ze via onderschepte aanvragen voor `https://mrtherich.nl/sp/`. Alleen requests naar `api.php` lopen naar de server. De server mag offline zijn: de interface en lokale data blijven bruikbaar.

Elke update vereist dezelfde Android-ondertekeningssleutel (`schattepatatjes-release.jks`), dezelfde package-ID (`nl.mrtherich.schattepatatjes`) en een hoger `versionCode`. De `.jks` en het wachtwoord mogen **nooit** in GitHub of de APK worden opgenomen. Bewaar een privéback-up van beide.

Voor automatische release-builds kun je in de **GitHub-repository secrets** `SCHATTEPATATJES_KEYSTORE_B64` (de base64 van de JKS) en `SCHATTEPATATJES_SIGNING_PASSWORD` instellen. Zonder deze secrets maakt de workflow een unsigned release-APK die apart met dezelfde sleutel ondertekend kan worden.
