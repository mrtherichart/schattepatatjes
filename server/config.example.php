<?php
/**
 * Kopieer dit bestand op je eigen HTTPS-hosting naar config.php.
 * Zet nooit je echte configuratie of gezinswachtwoord op GitHub.
 * Genereer een willekeurige sleutel, bijvoorbeeld met:
 * php -r 'echo bin2hex(random_bytes(24)), "\n";'
 */
define('BIJONS_SETUP_KEY', 'VERVANG_DIT_DOOR_EEN_LANGE_WILLEKEURIGE_SLEUTEL');

// Optional. Files containing Google private keys must be outside the public webroot.
// Share only the family calendar with the service account's client_email (read permission).
// define('SCHATTEPATATJES_INTEGRATIONS', [
//   'calendar' => ['calendarId'=>'YOUR_CALENDAR_ID', 'serviceAccountFile'=>'/private/google-calendar.json'],
//   'vapid' => ['subject'=>'mailto:you@example.com','publicKey'=>'GENERATED_PUBLIC_KEY','privateKey'=>'GENERATED_PRIVATE_KEY'],
// ]);
