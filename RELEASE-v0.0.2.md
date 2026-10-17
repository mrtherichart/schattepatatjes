# v0.0.2

Functional family-app foundation with a deliberately plain test interface. App appearance follows the viewing profile; visited profile pages use their owner's appearance. Profiles remain freely switchable on trusted devices.

Implemented: durable IndexedDB outbox and image blobs; frozen idempotent retries; version conflicts with retained edits; independent per-object conflict chains; trusted device enrollment/revocation; tasks and recurrence; shopping products/categories/stores/favourites; profile krabbeltjes; stickers/Post-its/Polaroids with reusable uploads, placement and two-finger editing; archive/restore; foreground GPS; read-only Google Calendar adapter/cache; PWA push and native periodic notification adapters; full backup/restore and legacy-data migration.

## Installation

1. Synchronize pending changes on **all existing devices** in the old app, then back up the server's private data and media. New enrollment refuses to ignore a nonempty legacy outbox. The old interface remains available with `?legacy=1` to finish it before migration.
2. Install the PHP backend **before** activating the new web revision or installing the APK. Upload `server/api.php`, `server/lib/`, `server/framework/`. Keep the existing `config.php`; merge only the optional integration settings from `config.example.php`.
3. Use PHP 8.3+ with GD, mbstring, curl, OpenSSL and Phar. Keep the private storage outside the webroot as before. The first v0.0.2 device enrollment creates a migration backup and the new state file. Old clients become read-only and should be updated together.
4. Deploy the web revision with the existing web updater. Android includes the same JavaScript modules inside its APK.
5. Enroll each Android/browser/PWA device once using the family password. The browser and an installed PWA may have separate cookie/storage containers; enroll whichever asks for authorization.

Version name is intentionally reset from 0.8.0 to the requested **0.0.2**. Android versionCode increases from 9 to **10**, preserving package/signing identity. The old updater compares version names and will not offer this lower-numbered release automatically: download and install the signed v0.0.2 APK once. Do not uninstall the old app. New releases carry `Android-build:` metadata so the new updater follows build numbers.

## Optional setup

- **Google Calendar:** enable the Calendar API in a Google Cloud project, create a service account, save its JSON key outside the webroot, and share only the family calendar with its `client_email` using read permission. Put that calendar's ID and the key-file path in `SCHATTEPATATJES_INTEGRATIONS['calendar']`. These credentials were not available during development; live calendar access still needs configuration and checking.
- **PWA notifications:** run `composer install --no-dev --prefer-dist` in `server/` (or use the packaged vendor directory). Generate VAPID keys with `Minishlink\WebPush\VAPID::createVapidKeys()` and place them in the integration settings. Run `php scripts/notification-worker.php /absolute/private-storage` once per minute using cron. Place CLI scripts outside the public webroot. Actual browser permission and push delivery require device testing.
- **Android notifications:** enable them in More and accept Android's permission prompt. The native worker checks about every 15 minutes when connectivity and Android scheduling allow. No Firebase credentials are required.
- **Location:** add store coordinates/radius, then use “Winkel bij mij zoeken”. No coordinates or location history are uploaded. Native GPS permission still needs an actual-device check.
- **Full backup:** `php scripts/backup.php create /private/storage /private/backups/family.tar`. Restore in an isolated environment first using `restore` in place of `create`. Clear local app data after restoring an older timeline; the restore revokes all device credentials.

## Validation

`npm ci`, `npm run check`, `npm test`, `npm run test:server`, `npm run test:http`, `npm run test:browser`.

Tests cover durable transactions, image blob reload, retry after a lost response, profile design resolution, explicit conflicts, valid dates, month-end recurrence, multiple PHP writers, corrupted storage, authenticated media, revocation and backup/restore. Browser tests exercise trusted login, offline API interruption + reload, offline photo linking, krabbeltjes and decoration.

Production hosting deployment, live Google Calendar, real push delivery and Android device behavior require separate verification. See `contracts/foundation-v2.md` for boundaries and protocol.
