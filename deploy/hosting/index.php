<?php
declare(strict_types=1);
require __DIR__.'/WebRevisions.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
try {
    $revisions = new WebRevisions(__DIR__);
    $sha = $revisions->current()['current'] ?? null;
    if (!is_string($sha)) throw new RuntimeException('Geen webrevisie geactiveerd.');
    $html = @file_get_contents($revisions->file($sha,'index.html'));
    if ($html === false) throw new RuntimeException('Webrevisie niet beschikbaar.');
    // Only a verified static GitHub revision reaches here; no user input in <base>.
    $base = '<base href="/sp/static/revisions/'.$sha.'/">';
    $html = preg_replace('~<head\s*>~i', '<head>' . "\n  " . $base, $html, 1, $count);
    if ($count!==1) throw new RuntimeException('Geen geldige HTML-shell.');
    header('Content-Type: text/html; charset=utf-8');
    echo $html;
} catch (Throwable $e) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Schattepatatjes-webapp is nog niet gepubliceerd. De gezins-API staat hier los van.';
}
