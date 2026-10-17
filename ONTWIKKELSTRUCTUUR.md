# Schattepatatjes — ontwikkelstructuur

**Status:** leidende ontwikkelafspraken; bronscheiding en offline webpublicatie zijn in de VM geïmplementeerd en lokaal getest. Productiehosting en een APK-upgrade op een echt toestel blijven afzonderlijk te valideren.  
**Referentie:** de werkende Android-architectuur van [WorkClock](https://github.com/mrtherichart/Workclock).  
**Doel:** één voorspelbaar ontwikkelproces, drie onafhankelijk te publiceren onderdelen en geen verborgen afhankelijkheden tussen app, website en server.

## 1. Vaste principes

1. **Bestaande werkende oplossingen zijn het vertrekpunt.** Voor Android zijn WorkClocks Kotlin-structuur, WebViewAssetLoader, APK-signing, verificatie, updater en GitHub Releases de referentie. Voor afwijkingen staat vóór implementatie een concrete technische reden in het werkplan. Geen eigen alternatief enkel omdat het eenvoudiger lijkt om opnieuw te schrijven.
2. **Eén bron voor de interface.** De browserwebapp en Android-APK bouwen uit dezelfde `web/`-bestanden. De APK bevat daarvan een momentopname; Android haalt zijn interface niet live van de hosting.
3. **Drie producten, drie verantwoordelijkheden.** Android levert een native schil, web levert de interface, server levert data en authenticatie. De PHP-server bevat geen Android-updater en is geen distributieplek voor APK's.
4. **Publicatie is geen ontwikkeling.** Alle wijzigingen gebeuren in de VM. Geen lokale Git-workflow; GitHub dient voor bronpublicatie, geautomatiseerde controles, Android-builds en Releases. Publiceer een samenhangende wijziging in één begrijpelijke commit op `main`; geen onnodige branches of reeks microcommits.
5. **Kleine functionele stappen, integraal getoetst.** Elke wijziging moet zowel lokaal als in de relevante combinatie van Android/web/server werken. Geen nieuwe architectuur bij het oplossen van één fout.
6. **Data en identiteit zijn stabiel.** Android-`applicationId`, de bestaande JKS-ondertekeningssleutel, gebruikersgegevens en API-compatibiliteit worden niet ongemerkt veranderd.
7. **UI-ontwerp blijft een eigen verantwoordelijkheid.** De warme, persoonlijke Web 2.0-interface en inhoud blijven herkenbaar bij technische ingrepen. Stijlvarianten mogen per gebruiker verschillen zonder ongevraagde layout-, content- of datastructuurwijzigingen. Geen redesign als bijeffect van backendwerk.
8. **Stop bij ontbrekende voorwaarden.** Als noodzakelijke toegang, signing, tests, compatibiliteit of hostingkennis ontbreekt, benoem de blokkade en publiceer niet via een improvisatieroute.
9. **Geen succesclaims zonder bewijs.** 'Gebouwd', 'ondertekend', 'op hosting gepubliceerd' en 'op een telefoon getest' zijn verschillende statussen en worden ook zo gerapporteerd.

## 2. Onderdelen en grensvlakken

| Onderdeel | Wat erin hoort | Wat er niet in hoort | Publicatie |
| --- | --- | --- | --- |
| **Web** | HTML, CSS, JavaScript, afbeeldingen, PWA; ook de schermen voor serverstatus | PHP-dataopslag, geheime sleutels, Android-installer | Een vaste, lokaal gecachte versie vanaf `web/` op GitHub, geactiveerd op hosting |
| **Android** | Kotlin, `WebViewAssetLoader`, systeembestandskiezer, GitHub-release-updater | Online download van de HTML als primaire UI, PHP-logica, extra kopie van webbron | Één **ondertekende** APK per GitHub Release |
| **Server** | PHP-API, sessies, autorisatie, validatie, JSON-opslag met locking, gezondheidscontrole | Webinterface, APK's, GitHub-updater, automatische frontendoverschrijvingen | Afzonderlijke, gecontroleerde serverdeploy |

De drie onderdelen hebben **onafhankelijke versienummers**: de webrevisie is een vastgelegde commit-SHA, de Android-APK heeft `versionCode`/`versionName` en de PHP-API heeft een eigen API-/schemaversie. Een commit kan meerdere onderdelen wijzigen, maar activeert ze niet automatisch allemaal.

Beide interfaces gebruiken één **gedocumenteerd API-contract**; server en web mogen op dezelfde HTTPS-host draaien zonder dat hun bron, deploy of verantwoordelijkheden verweven raken. Alleen de server is gezaghebbend over gedeelde gezinsdata; lokale offline wijzigingen zijn een wachtrij, geen tweede server.

## 3. Gewenste repository-indeling

```text
schattepatatjes/
├── web/                         # één bron voor browser én APK
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   ├── manifest.webmanifest
│   ├── sw.js
│   └── assets/
├── app/                         # WorkClock-achtige Android-module
│   ├── build.gradle.kts
│   └── src/main/java/.../       # Kotlin MainActivity, updater
├── server/
│   ├── api.php
│   └── config.example.php       # voorbeeld; echte config nooit in repo
├── deploy/                      # dunne PHP-webbootstrap + veilige webpublicatie
├── tests/                       # web, API, offline/sync, Android/release
├── .github/workflows/           # tests, Android-testbuild, getekende release
├── build.gradle.kts
├── settings.gradle.kts
└── ONTWIKKELSTRUCTUUR.md
```

De Android-build kopieert `web/` automatisch naar APK-assets; de browserdeploy publiceert **dezelfde bestanden**. Geen handmatig onderhouden `web`-kopie in `app/` en geen `api.php` in de Android-APK.

**Uitgevoerd in de refactor:** de interface staat onder `web/`, de PHP-API onder `server/`, en de webdeployer onder `deploy/`. De Android-bundeling en API-contracttests zijn aangepast. Dit zegt niets over wat al op productiehosting staat.

## 4. Hosting: webapp en PHP-server blijven zelfstandig

Houd voor bestaande installaties deze adressen stabiel:

- **Webapp:** `https://mrtherich.nl/sp/`.
- **Gezins-API:** `https://mrtherich.nl/sp/api.php` (bestaand contract en sessies behouden).
- **APK-updates:** GitHub Releases, nooit `/sp/updates/`.

De map `/sp/` kan dus zowel een dunne frontend-bootstrap als één API-ingang bevatten; **deze gedeelde URL-ruimte betekent niet dat de deploys gekoppeld zijn**. Serverconfiguratie en JSON-gegevens staan buiten de publiek bereikbare map. De browser/webapp krijgt het API-adres expliciet als vaste of vertrouwde omgevingsconfiguratie (niet afgeleid van `document.baseURI`), zodat een frontend-revisiepad de API niet verplaatst. De Android-WebView behoudt dezelfde HTTPS-origin voor first-party sessiecookies; zonder zorgvuldig ontwerp geen extra CORS of afwijkend loginmechanisme.

### De online webapp via GitHub bijwerken

**Eén kleine PHP-bootstrap** bedient `/sp/` en verwijst naar de **actief gekozen, reeds gedownloade** webrevisie uit `web/` op GitHub. De frontend hoeft daardoor niet elke keer met FTP te worden geüpload.

Het publicatiepad is: (1) selecteer een concrete Git-commit/revisie; (2) download via HTTPS alleen toegestane statische frontendbestanden uit `web/` naar een nieuwe revisiemap; (3) controleer de allowlist (`.html`, `.css`, `.js`, webmanifest, serviceworker, afbeeldingen), bestandsintegriteit, correcte basispaden en het vaste API-adres; (4) wissel één kleine `current`-verwijzing *atomair* om; (5) bewaar de vorige revisie voor direct terugzetten. Bezoeken aan de site gebruiken uitsluitend de lokale cache; er wordt **niet bij elke pageview** naar GitHub gebeld.

De PHP-deployfunctie is met authenticatie én CSRF-bescherming afgeschermd, of wordt uitsluitend vanaf een afgeschermde CLI uitgevoerd. Ze heeft een expliciete handmatige of geautoriseerde trigger. **Doel:** de deployer kan alleen frontend-revisies en de actieve pointer schrijven. Controleer of de hosting deze rechten echt kan scheiden; processen onder dezelfde PHP-gebruiker kunnen anders tóch serverbestanden schrijven. Is filesystem-isolatie onmogelijk, kies een beperkt hosting-/SFTP-account of ander deploykanaal in plaats van een onterecht als veilig gepresenteerde PHP-deployer. Ze kan **nooit** `api.php`, `config.php`, JSON-data of andere serverbestanden overschrijven, en voert geen willekeurige vanuit GitHub gedownloade PHP-code uit. Een mislukte download of controle laat de actieve website ongemoeid. Wijzigingen aan server-PHP hebben een apart, gecontroleerd pad.

**Praktisch ontwerpbesluit voor de implementatie:** de bootstrap behoudt `/sp/` als stabiele URL en laat statische bestanden laden uit een versioneerd, immutable pad; het API-adres blijft absoluut `/sp/api.php`. Controleer bij de omschakeling bovendien dat de hosting werkelijk `index.php` als `/sp/`-ingang kiest in plaats van een oude `index.html` (DirectoryIndex / redirect). Pas manifest, PWA-startadres en service-worker-scope bewust aan zodat versiewisselingen geen verouderde shell blijven serveren. Test de geïnstalleerde iPhone-PWA expliciet; wijzig de SW-scope niet stilzwijgend. Dit ontwerp eerst in een hostingachtige testomgeving bevestigen (Apache/PHP/rewrite/symlinks zijn niet vanzelfsprekend op shared hosting).

## 5. API-contract, offline gedrag en diagnostiek

- Het API-contract beschrijft endpoints, minimale compatibele client-/serverversies, authenticatie, dataformaten, fouten en synchronisatieregels. Onderhoud een geteste compatibiliteitsmatrix voor de daadwerkelijk verspreide APK-versies en de actuele webrevisie. Een nieuwe client blijft samenwerken met een bestaande ondersteunde server en omgekeerd; als dat niet kan, komt eerst een expliciet migratieplan.
- `api.php?action=health` meldt bereikbaarheid en API-versie zonder privégegevens of geheimen. **Server bereikbaar** is niet hetzelfde als **ingelogd** en niet hetzelfde als **alle wijzigingen gesynchroniseerd**.
- In Instellingen zijn zichtbaar: gebruikte API-URL, actuele HTTP-status, tijdstip laatste test, server-/authstatus, laatste geslaagde sync, aantal wachtende acties en de laatste relevante fout.
- Bewerkingen offline: lokaal bewaren → in wachtrij → pas na serverbevestiging verwijderen. Bij 401 aanmelding vereisen; bij 403/404/5xx relevante fout tonen; nooit stilzwijgend 'gesynchroniseerd' melden.
- Tests dekken het terugkomen van internet, dubbele verzoeken, sessieverval, conflicten, corrupte of onbereikbare API-responses en serverfouten. Behoud lokale data en toon onzekerheid wanneer serveracceptatie niet bevestigd is.

## 6. WorkClock-conforme Android-releases

De native schil blijft beperkt tot datgene waarvoor Android nodig is. Kotlin `MainActivity` laadt de ingebouwde webbestanden via `WebViewAssetLoader`; een aparte Kotlin-updater raadpleegt **alleen** `https://api.github.com/repos/mrtherichart/schattepatatjes/releases/latest`. De PHP-server heeft hier geen rol in.

Een officiële APK heeft altijd dezelfde `applicationId` (`nl.mrtherich.schattepatatjes`) en dezelfde permanente ondertekeningsidentiteit. De bestaande twee GitHub-secrets blijven:

- `SCHATTEPATATJES_KEYSTORE_B64` — de bestaande JKS als base64.
- `SCHATTEPATATJES_SIGNING_PASSWORD` — het wachtwoord van diezelfde keystore.

**Geen wijziging aan deze sleutelopzet.** Een debug-APK uit Actions is uitsluitend om te testen; die is niet de reguliere installatie of update. Een release vereist een verhoogde `versionCode`, een nieuwe `versionName`, succesvolle tests, **de juiste pakketnaam en certificaatfingerprint**, daarna publicatie van `Schattepatatjes.apk` in een GitHub Release. De updater controleert versie, downloadintegriteit en Android-signature, en geeft Android zelf de installatiebevestiging. Er zijn geen verborgen/silent updates.

Een mislukte update mag nooit worden opgelost door de certificaat- of pakketcontrole af te zwakken. Een eerdere Android-versie kan meestal niet simpelweg terug over een nieuwere geïnstalleerd worden; herstel via een geteste, hoger genummerde reparatierelease in plaats van een veronderstelde downgrade.

De onduidelijke melding 'APK-versie, pakketnaam of Android-ondertekening klopt niet' moet bij tests tot afzonderlijke controle-uitkomsten herleidbaar zijn. **Release van N+1 is pas bewezen als een werkelijk geïnstalleerde, ondertekende N met behoud van gegevens naar N+1 kan updaten.** Alleen een groene GitHub Actions-build is daarvoor niet voldoende.

## 7. Vast werkproces per wijziging

1. **Start met referenties.** Lees de relevante bestaande Schattepatatjes-code en bij Android de overeenkomende WorkClock-code. Bepaal eerst welk onderdeel eigenaar is van de wijziging.
2. **Schrijf een kleine taakafbakening:** gewenst gedrag, wat bewust onaangeroerd blijft, compatibiliteit, risico's, controlepunten. Wijs afwijkingen van de referentie expliciet aan.
3. **Werk uitsluitend in de VM.** Pas daar samenhangende bestanden aan, houd de interfacebron gedeeld; gebruik geen lokale Git en geen GitHub-API als code-editor.
4. **Doe twee kritische passes.** Eerst: klopt het ontwerp met de principes en wordt iets dubbel gebouwd? Daarna: wat gebeurt er bij echte fouten, oudere versies en gedeeltelijke upgrades? Schrappen is toegestaan; nieuwe features zonder aanleiding niet.
5. **Test voordat je publiceert.** Syntax, unit/contracttests, mobiele UI/scroll, offline + netwerk + 401/403/404/5xx; waar relevant Kotlin-build, APK-handtekening en upgradepad. Niet geteste onderdelen expliciet melden.
6. **Publiceer één afgeronde wijziging naar `main`** met één duidelijke commit. GitHub Actions doet de build en onafhankelijke checks. Een gewijzigde web-/serverbron mag niet onbedoeld een Android-release activeren. Een nieuw APK-versienummer met gecontroleerde signing en checks is de expliciete releasepoort.
7. **Activeer elk product afzonderlijk.** Webrevisie op hosting; serverupdate met backup en aparte test; Android via Release. Een migratie aan het JSON-dataschema moet eerst voor- én achterwaarts compatibel zijn of een afzonderlijk herstelplan krijgen: terugrollen van PHP-code herstelt geen gewijzigde data. Controleer productie apart van de buildomgeving.
8. **Rapporteer feiten, geen aannames:** gewijzigde onderdelen, tests en uitslagen, aanwezige links, wat op hosting is geactiveerd, wat op een telefoon is getest, openstaande problemen en herstelroute.

## 8. Compatibele migratie vanuit de huidige code

1. **Inventariseer en bevries invarianten.** Meet het huidige gedrag van de officiële APK, API en webapp. Controleer JKS-certificaat, application ID, huidige serverdata, cookies, localStorage en bestaande API-acties. Maak eerst een serverbackup. Geen permanente wijzigingen om alleen een test te laten slagen.
2. **Maak de API expliciet.** Verwijder afhankelijkheid van `document.baseURI` zodat dezelfde frontend vanaf een GitHub-revisiepad en uit de APK exact dezelfde API kan aanroepen. Behoud `/sp/api.php` en bestaande sessies. Test beide clients.
3. **Splits de bron in mappen.** Verplaats `web/` en `server/` zonder te herschrijven wat al werkt. Werk Android-bundling en tests tegelijk bij; controleer dat alle statische bestanden in APK én browser werken.
4. **Voeg de PHP-webbootstrap toe.** Test eerst downloaden, activeren, foutscenario's en rollback met een staging-kopie. Zorg dat een deploy de server-API/data technisch niet kan raken.
5. **Stabiliseer en test de Android-updater tegen de echte GitHub Release.** Pas WorkClocks bewezen updater zorgvuldig aan: kopieer geen irrelevante WorkClock-locatie- of notificatiefuncties. Hergebruik WorkClock-gedrag en controleer de specifieke APK-updatefout volledig. Geen workaround die pakketnaam, SHA of signaturecontroles uitschakelt.
6. **Neem de onafhankelijke releasepoorten in gebruik.** Eén kleine, gecontroleerde uitrol per onderdeel; oude versies ondersteunen zolang de overgang loopt.

## 9. Releasecontroles per onderdeel

| Wijziging | Minimale controle vóór activering | Herstelpad |
| --- | --- | --- |
| Web / PWA | Android-bundel en browser in dezelfde revision; `/sp/`, assetpaden, iPhone-PWA, cacheversie, vaste API-URL, offline en 401/403/5xx | Herstel de vorige frontend-pointer; raak de API niet aan |
| PHP / API | Contracttests voor huidige webapp en reeds verspreide APK's, health/auth/sync, correcte opslagrechten, geteste backup | Eerst data- en schema-compatibiliteit verifiëren; codeherstel alleen indien veilig |
| Android / APK | WorkClock-referentie vergelijken, Gradle/tests, pakket-ID, SHA/fingerprint, assetinhoud, handmatige installatie en N→N+1-test met data | Reparatierelease met hoger versienummer; geen downgrade veronderstellen |

Publicatie van een webrevisie is geen APK-release. Eén bron kan desondanks een nieuwe APK krijgen als een relevante frontendwijziging daarvoor bewust wordt geselecteerd. Releasen van een APK betekent niet dat `/sp/api.php` is bijgewerkt.

## 10. Stopregels en feitelijke status

Er wordt **geen nieuwe Android-release** gemaakt als de APK-upgradecontrole faalt of de signing-identiteit onbekend is. Er wordt **geen productie-webdeploy** gedaan als de bootstrap, PWA-paden of rollback niet getest zijn. Er wordt **geen serverdeploy** gedaan zonder geslaagde compatibiliteitstest en herstelbare backup. Bij ontbrekende toegang wordt expliciet om de ontbrekende voorwaarde gevraagd; er wordt geen nieuwe, afwijkende release- of updateconstructie bedacht.

Huidige feitelijke stand (17 oktober 2026): Kotlin, GitHub-release-updater en server-health bestonden al. De refactor heeft de bronscheiding en de webdeployer geïmplementeerd en met lokale unit-/integratietests gecontroleerd. Hostingrechten, daadwerkelijke frontendactivatie op mrtherich.nl en een volledige Android N→N+1-update met databehoud op een toestel zijn **nog niet bevestigd**. De eerdere APK-updatefout blijft een open defect; de native code toont inmiddels het specifieke mislukte controlepunt, maar dat is nog geen bewezen oplossing.

## 11. Gereed betekent

- [ ] APK start offline met alle ingebouwde assets; geen HTML van de server nodig.
- [ ] Website start op `/sp/` uit een lokale, versioneerde webrevisie; GitHub-uitval tijdens bezoek is onschadelijk.
- [ ] Android en website gebruiken dezelfde interfacebron en hetzelfde stabiele API-contract.
- [ ] Frontenddeploy kan aantoonbaar geen servergegevens, config of PHP-API overschrijven, óók niet bij verkeerde invoer of onvoldoende hosting-isolatie.
- [ ] Serverstatus, authenticatie en synchronisatiestatus worden verschillend weergegeven en getest.
- [ ] Een mislukte serveractie blijft veilig in de offline wachtrij.
- [ ] Android N → N+1 via GitHub Releases werkt op een echt toestel met de bestaande sleutel en behoud van data.
- [ ] Een webrollback en een serverrollback zijn afzonderlijk uitvoerbaar, met backup/compatibiliteit.
- [ ] Alle drie publicatiepaden hebben concrete checks en een expliciete geslaagd/mislukt-status.

### Kritische ontwerpbesluiten na twee beoordelingsrondes

- **Geschrapt:** één grote release voor web, server en APK; iedere component heeft een eigen activering.
- **Aangescherpt:** de PHP-bootstrap gebruikt lokale, immutable GitHub-revisies; zolang de hosting geen aantoonbaar geïsoleerde schrijfrechten biedt, is een beschermde alternatieve deploymethode verplicht.
- **Aangescherpt:** absolute API-base, sessies en PWA-scope zijn expliciete migratie- en testpunten, geen details die later vanzelf werken.
- **Aangescherpt:** een groene build bewijst geen veilige APK-upgrade, en een serverrollback bewijst geen veilig herstel van gewijzigde JSON-data.

*Dit document legt blijvende werkwijze en testvoorwaarden vast. Bronscheiding, bootstrap en locale testdekking zijn geïmplementeerd; echte hostingactivatie en succesvolle Android-update op hardware zijn nog te doen.*
