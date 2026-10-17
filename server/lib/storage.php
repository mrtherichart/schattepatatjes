<?php
declare(strict_types=1);
if (!defined('SCHATTEPATATJES_API_BOOTSTRAP')) {http_response_code(403);exit;}

function storage(): string {
    // Keep the old API-directory identity: moving this function to lib/ must
    // never create a different private directory or hide existing family data.
    $apiDir=dirname(__DIR__);
    $root=realpath($_SERVER['DOCUMENT_ROOT']??$apiDir)?:$apiDir;
    $base=dirname($root).DIRECTORY_SEPARATOR.'bijons-private-'.substr(hash('sha256',realpath($apiDir)?:$apiDir),0,12);
    if(!is_dir($base)&&!@mkdir($base,0700,true))fail('Kan de privé-opslag niet maken. Controleer schrijfrechten buiten de webmap.',500);
    return $base;
}
function readJson(string $file): ?array {if(!is_file($file))return null;$data=json_decode(file_get_contents($file)?:'null',true);return is_array($data)?$data:null;}
function atomicJson(string $file,array $value): void {
    $json=json_encode($value,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE|JSON_THROW_ON_ERROR);
    $tmp=$file.'.'.bin2hex(random_bytes(6)).'.tmp';
    if(file_put_contents($tmp,$json,LOCK_EX)===false)fail('Opslaan mislukt.',500);
    @chmod($tmp,0600);
    if(!rename($tmp,$file)){@unlink($tmp);fail('Opslaan mislukt.',500);}
}
function lockFile(string $dir): mixed {
    $fd=fopen($dir.'/write.lock','c');
    if(!$fd||!flock($fd,LOCK_EX))fail('Opslag is momenteel niet bereikbaar.',500);
    return $fd;
}
