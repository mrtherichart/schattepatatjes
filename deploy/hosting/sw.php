<?php
declare(strict_types=1);
require __DIR__.'/WebRevisions.php';
header('Content-Type: text/javascript; charset=utf-8');
header('Cache-Control: no-store, must-revalidate');
header('Service-Worker-Allowed: /sp/');
try {
    $rev = new WebRevisions(__DIR__);
    $sha = $rev->current()['current'] ?? null;
    if (!is_string($sha)) throw new RuntimeException('Nog geen webrevisie.');
    $script = @file_get_contents($rev->file($sha,'sw.js'));
    if ($script===false) throw new RuntimeException('Serviceworker ontbreekt.');
    echo str_replace('__WEB_REVISION__',$sha,$script);
} catch (Throwable $e) {
    http_response_code(503);
    echo '// Offline ondersteuning nog niet beschikbaar';
}
