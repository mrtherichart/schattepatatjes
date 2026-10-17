<?php
declare(strict_types=1);
require __DIR__.'/WebRevisions.php';
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
if (PHP_SAPI !== 'cli' && (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS']==='off')) {
    http_response_code(403); exit('Alleen via HTTPS.');
}
if (!is_file(__DIR__.'/web-config.php')) { http_response_code(503); exit('Maak eerst web-config.php aan, volgens web-config.example.php.'); }
require __DIR__.'/web-config.php';
if (!defined('SP_WEB_DEPLOY_PASSWORD') || strlen(SP_WEB_DEPLOY_PASSWORD) < 32) {
    http_response_code(503); exit('Geen sterke publicatiesleutel ingesteld.');
}
session_name('sp_web_deploy');
session_set_cookie_params(['secure'=>true,'httponly'=>true,'samesite'=>'Strict','path'=>'/sp/']);
session_start();
$_SESSION['csrf'] ??= bin2hex(random_bytes(24));
$status='';
$revisions=new WebRevisions(__DIR__);
if ($_SERVER['REQUEST_METHOD']==='POST') {
    $origin=$_SERVER['HTTP_ORIGIN']??'';
    if ($origin!== 'https://mrtherich.nl' || !hash_equals((string)$_SESSION['csrf'],(string)($_POST['csrf']??''))) {
        http_response_code(403); exit('Formulier of herkomst niet geldig.');
    }
    if (!hash_equals(SP_WEB_DEPLOY_PASSWORD,(string)($_POST['password']??''))) {
        http_response_code(403); $status='Verkeerde publicatiesleutel.';
    } else {
        try {
            if (($_POST['action']??'')==='activate') {
                // Fetching the GitHub tree and all immutable assets can exceed 30s on shared hosting.
                @set_time_limit(120);
                $sha=strtolower(trim((string)($_POST['sha']??'')));
                $count=$revisions->download($sha);
                $revisions->activate($sha);
                $status='Webrevisie '.$sha.' actief ('.$count.' bestanden gecontroleerd).';
            } elseif (($_POST['action']??'')==='rollback') {
                $status='Teruggezet naar '.$revisions->rollback().'.';
            } else { throw new RuntimeException('Onbekende actie.'); }
        } catch (Throwable $e) { $status='Niet gewijzigd: '.$e->getMessage(); }
    }
    $_SESSION['csrf']=bin2hex(random_bytes(24));
}
$state=$revisions->current()??[];
function h(string $value):string{return htmlspecialchars($value,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
?>
<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Schattepatatjes · Webpublicatie</title>
<style>body{font:16px/1.5 system-ui;margin:2em auto;padding:0 1em;max-width:38em;background:#f4eee6;color:#252f2c}input{display:block;width:100%;padding:.7em;box-sizing:border-box;margin:.4em 0 1em}button{padding:.8em 1.1em;cursor:pointer}form{padding:1em;background:white;margin-top:1em;border:1px solid #ddd}code{overflow-wrap:anywhere}p.message{padding:1em;background:#ecf1ed}</style></head><body>
<h1>Webpublicatie</h1><p>Alleen de publieke webbestanden worden bijgewerkt. De Android-APK en PHP-gezinsserver blijven ongemoeid.</p>
<p><strong>Actief:</strong> <code><?=h((string)($state['current']??'nog geen'))?></code><br><strong>Vorige:</strong> <code><?=h((string)($state['previous']??'geen'))?></code></p>
<?php if ($status!==''): ?><p class="message" role="status"><?=h($status)?></p><?php endif; ?>
<form method="post"><h2>Nieuwe webrevisie</h2><label>GitHub commit-SHA (40 tekens)<input name="sha" autocomplete="off" required pattern="[0-9a-fA-F]{40}" maxlength="40"></label>
<label>Publicatiesleutel<input type="password" name="password" required autocomplete="off"></label><input type="hidden" name="csrf" value="<?=h($_SESSION['csrf'])?>"><button name="action" value="activate">Download, controleer en activeer</button></form>
<form method="post"><h2>Vorige versie herstellen</h2><label>Publicatiesleutel<input type="password" name="password" required autocomplete="off"></label><input type="hidden" name="csrf" value="<?=h($_SESSION['csrf'])?>"><button name="action" value="rollback">Terugzetten</button></form></body></html>
