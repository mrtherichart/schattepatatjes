> **v0.0.2:** De actuele functionele architectuur staat in [contracts/foundation-v2.md](contracts/foundation-v2.md); installatie en integraties in [RELEASE-v0.0.2.md](RELEASE-v0.0.2.md). De oudere beschrijving hieronder documenteert de vorige interface.

# Modulegrenzen — Schattepatatjes

Doel: functionaliteit onderhouden of vervangen zonder een andere laag mee te verbouwen. Dit is een onderhoudscontract, geen framework of plug-insysteem.

## Afhankelijkheden

- `web/modules/common.js`: veilige HTML/afbeeldingshelpers, datumhelpers, de bestaande `localStorage`-compatibiliteit en kleurnamen. **Geen** app-state, fetch of schermnavigatie.
- `web/modules/model.js`: standaardmodel, normalisatie en lokale toepassing van acties. Geen DOM, fetch of opslag. `applyOperation` gebruikt **dezelfde actiecodes** als de PHP-server; wijzigingen moeten aan beide kanten compatibel blijven.
- `web/modules/api-client.js`: één HTTPS/JSON-transport, met foutdiagnose. Kent geen UI, gebruikers of offline wachtrij.
- `web/modules/views/home.js`, `shopping.js`, `tasks.js`, `people.js`: zelfstandige schermtemplates. Ontvangen alleen de actuele gegevens en noodzakelijke weergavehelpers via `getContext`. Verzenden geen netwerkverzoeken en slaan niets op.
- `web/modules/views/dialogs.js`: modal-HTML. De controller verwerkt acties en formulieren; geen tweede statebeheer.
- `web/modules/update-ui.js`: berichten van de native Android-updater. Heeft geen toegang tot de gezinsserver of keystore.
- `web/app.js`: **enige coördinator** van huidige app-state, offline wachtrij, synchronisatie, gebruikersacties en levenscyclus. Alleen hier wordt de huidige state vervangen na serverbevestiging.
- `web/styles/*.css`: basis, gedeelde componenten, dialogen, responsive gedrag en verbindingsstatus. `styles.css` houdt de oorspronkelijke CSS-volgorde aan via `@import`.

De UI-staat van de moduleviews wordt via een functie (`getContext`) pas tijdens renderen opgehaald, zodat het vervangen van de gedeelde state na synchronisatie geen verouderde referenties achterlaat. Dit is bewust eenvoudiger dan een eventbus of DI-framework.

## Backend

- `server/api.php`: publieke HTTPS-ingang, sessies en acties (`health`, `state`, `setup`, `login`, `logout`, `mutate`, `product-search`).
- `server/lib/http.php`: JSON-response, input, validatie en autorisatie.
- `server/lib/storage.php`: JSON-bestanden buiten webroot, locking en atomair schrijven.
- `server/lib/mutations.php`: validatie en uitvoering van domeinbewerkingen.

PHP-modules accepteren alleen inclusie vanuit de API-bootstrap en staan achter `server/lib/.htaccess`. De server API-versie en het bestaande opslag-/sessiecontract blijven gelijk. Backend-update = `api.php` + `lib/`, **apart van** webdeployer.

## Publicatie en tests

Alle `web/modules/**/*.js` en `web/styles/*.css` gaan in zowel de APK als de verifieerbare GitHub-webrevisie. `web/sw.js` precachet ze voor offline gebruik. Nieuwe modules moeten dus door Android-bundling, de webdeployer, de cache en CI heen gaan; géén losse externe scriptbron.

Bij een wijziging aan dataacties: eerst modeltest, dan PHP-contracttest en offline/synchronisatieregressie. Bij een wijziging aan de interface: module-test, controller-smoke, hosting smoke, Android debugbuild. De git-publicatie is één samenhangende commit. Een release ontstaat alleen via het normale versie-/signing-proces.

**Niet geclaimd:** een browsertest op de VM (lokale Chromium-verbinding wordt door beleid geblokkeerd), een daadwerkelijke productiehostingdeploy of een toestel-upgradetest.
