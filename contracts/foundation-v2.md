# Schattepatatjes v0.0.2 — functional foundation

This is the current implementation contract. It supersedes the old theme/private-note/calendar-authoring proposals. The original screen modules remain in the repository for migration reference; `index.html` now starts `modules/entry.js`, which selects the foundation bootstrap by default. The visible interface is a functional workbench, not the final scrapbook design.

## Boundaries

- `foundation/database.js`: IndexedDB transactions. An edit resolves only after commit. One household workspace contains snapshot, outbox, pending image blobs and cached calendar; no credentials.
- `foundation/transport.js`: same-origin HTTPS requests, timeouts, CSRF renewal, protocol validation, typed error status/code.
- `foundation/model.js`: pure optimistic projection, queue ordering and explicit conflict resolution.
- `foundation/sync.js`: durable outbox, frozen retries, operation acknowledgement, monotonic snapshots, tab lease and conflict states. No DOM.
- `features/family.js`: task, shopping, product, profile, krabbel and archive/trash commands. Uses dispatch; never accesses storage or network directly.
- `features/customization.js`: viewer/owner resolution and two-pointer geometry/editor. Storage remains in family commands.
- `features/location.js`: foreground permission/read/watch/stop and accuracy-aware store matching. No position history or server uploads.
- `features/notifications.js`: platform adapter; browser PushManager or Android notification permission/background worker.
- `features/workbench.js`: replaceable test interface. It consumes the modules above. Its layout is not a framework requirement.
- PHP `framework/store.php`, `domain.php`, `media.php`, `integrations.php`, `router.php`: transaction storage, domain validation, media, Google integration and HTTP boundary respectively.

## Scope and identity

One shared household, one enrollment password, multiple revocable trusted devices. Device trust lasts 180 days; the raw secret is stored in a Secure, HttpOnly, SameSite=Strict cookie and only its hash is stored server-side. Every request rechecks revocation/expiry. Credential cookies are never copied into JavaScript or a downloadable backup. All authorized family devices have equal device-management access.

`actorId` is the freely selected family profile, not a private security identity. Profile-owned decoration can be changed by switching to that profile. All family data is family-visible. There are no private notes, chat, threads or forum features.

App pages select appearance using the viewing profile and surface `app`. A visited `profile:<id>` page selects that person's surface `profile` and decorations. Appearance records have stable IDs `<owner>-app` and `<owner>-profile`. Navigation and shared data are unaffected by personal appearance. No arbitrary CSS or scripts.

## HTTP

Base: `/sp/api.php?action=foundation&route=...`. API version 2 is independent of release name 0.0.2. Responses are `{"ok":true,"apiVersion":2,"data":...}` or `{"ok":false,"apiVersion":2,"error":{"code":...,"details":...}}`. All responses are no-store.

GET: `bootstrap`, `state`, `devices`, `media&id=...&thumbnail=1`, `notifications`, `calendar`, `export`.
POST: `login`, `logout`, `revoke`, `mutate`, `upload`, `subscribe`, `unsubscribe`.

All POSTs require exact-origin verification and `X-CSRF-Token` from bootstrap. Enrollment additionally requires the household password and HTTPS. Rate limiting persists outside the session. `state` and export never include device hashes, operation receipts or push endpoints.

Mutations contain exactly `id`, `actorId`, `type`, `entityId`, `expectedVersion`, `data`. Types are `<kind>.<verb>`; verbs: create, patch, trash, restore, archive. Creation expects version zero; editing expects the observed version. Boolean updates carry their target value. Archive takes `{archived:boolean}`; trash and restore take an empty object. Unknown fields fail validation. Receipts contain operationId, resulting object version and household revision. Operation IDs and receipts persist indefinitely, including across device re-enrollment. A different payload under an old ID is rejected.

Kinds and fields:

- person: name, bio, avatarId.
- shop: name, latitude, longitude, radius (20–1000 metres).
- task: title, assigneeIds, dueDate, repeat (none/daily/weekly/monthly), completed.
- shopping: name, quantity, shopId, category, imageId, checked, position.
- product: name, quantity, shopId, category, imageId, favorite, used.
- krabbel: recipientId, text, imageId, pinned. The server records the author. Messages belong to a recipient's profile; latest messages are a derived view.
- decoration: ownerId, page, kind (sticker/postit/polaroid), text, mediaId, sticker, anchor, x/y, scale, rotation, z, crop, color.
- appearance: ownerId, surface, background, accent, font, paper.
- notificationPreference: ownerId, enabled, krabbels, tasks.
- media: server-created immutable processed image metadata.

Titles/names have a 200-character limit; text/bio 10,000; JSON bodies 64 KiB. References must exist and not be trashed. Dates must be valid YYYY-MM-DD. Task completion creates one deterministic next occurrence; month-end recurrence clamps to the next month's last day. No automatic overdue-occurrence skipping.

Decorations store positions relative to their stable page/header/content/footer anchor (0–1), scale (0.2–5), rotation (-180–180) and stacking order. Crop contains x/y (0–1) and zoom (1–5). Moving is a local preview, followed by one versioned patch. Undo submits a new patch, preserving conflict checks. Photos are reusable media references, not embedded base64 inside records.

## Offline and concurrency

IndexedDB writes the action before publishing it optimistically. Pending photo blobs live in the same durable workspace. Uploads run before dependent actions and reuse their upload IDs. The complete mutation is frozen before transmission. Network failures retry that exact request. Acknowledged actions remain durable until a snapshot at least as new as their receipt can be committed together with queue removal.

A 120-second IndexedDB lease coordinates tabs; duplicate server delivery remains safe if a tab stalls beyond the lease. Conflicts block subsequent changes to that object; independent objects continue. The workbench shows local intent and server state, with discard or reapply. Reapply gives the affected queue chain new operation IDs and current expected versions. Polling never rebases existing pending changes silently. A 401 hides family content and pauses sending while preserving pending work for re-enrollment.

Browser storage eviction, device destruction and an explicit browser-data reset can still remove unsynchronized work. Remote device revocation prevents further network access; it cannot erase an offline device immediately.

## Media, trash and backup

Uploads accept decodable JPEG/PNG/WebP, up to 5 MiB and 20 megapixels. The server re-encodes to PNG (including transparent stickers) and writes thumbnails before registering the asset. SVG uploads are rejected. Images are served only through authenticated routes. Trashed objects remain available for restore; media references are retained. `cleanup-media.php` only removes unregistered crash-orphan files older than seven days, never a registered photo.

The initial migration locks the old writer and takes `before-v0.0.2.json` before creating `foundation.json`. Legacy writes are then rejected with HTTP 426. Existing image data URLs/URLs remain read-only legacy fields during migration. Registered uploads use the new media store.

`backup.php create STORAGE ARCHIVE.tar` copies the consistent JSON and registered media under the household lock. Restore verifies referenced files, preserves a before-restore snapshot and revokes all devices. After restoring an older timeline, clear local app data before re-enrolling; do not replay queues from the discarded timeline. The enrollment password/configuration and Google/VAPID keys are backed up separately, never included in the family export.

## Integrations and practical limits

Google Calendar is read-only. A server-side service account must have read access to the family's shared calendar. `config.php` references its private credential file outside the webroot and the calendar ID. No credentials enter the browser. The adapter loads expanded occurrences from 30 days before today to 180 days ahead, follows pagination, caches for five minutes and returns old cached events marked stale if refresh fails. No configuration means an explicit unconfigured result, not an empty pretend calendar. Calendar edits/reminders stay in Google Calendar.

PWA Web Push requires the Composer dependencies, VAPID keys and a cron invocation of `notification-worker.php` every minute. Native Android uses WorkManager at a 15-minute minimum interval; power management can delay it. These are deliberately different delivery adapters. Neither is advertised as guaranteed instantaneous delivery. Push creates profile krabbel/task-assignment notifications. Notification tags/IDs reduce duplicate display; delivery is at least once, not exactly once. Location is foreground-only, with runtime permission and accuracy/age checks. Multiple nearby stores remain a manual choice.

No final scrapbook UI, general plugin system, private notes, chat, calendar editor, background location tracking, automatic conflict merge, or weather integration is included.

## Replacing the workbench

Import `createFamilyRuntime` from `web/modules/foundation/runtime.js`. Creating the runtime has no DOM effects. Call `connect()` to check device access; subscribe to `runtime.sync` for state and queue changes. Use `runtime.family` for domain commands, `stageImage` for durable images, `designFor` for display ownership, and the location/notification adapters for permissions. Your screen controls its own mount/dispose lifecycle. Call `runtime.stop()` when disposing the application. `bootstrap.js` is only the current workbench's composition and lifecycle entry point.
