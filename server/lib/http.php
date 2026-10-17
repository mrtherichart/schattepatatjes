<?php
declare(strict_types=1);
if (!defined('SCHATTEPATATJES_API_BOOTSTRAP')) {http_response_code(403);exit;}

function fail(string $message, int $code=400): never {http_response_code($code);echo json_encode(['ok'=>false,'message'=>$message],JSON_UNESCAPED_UNICODE);exit;}
function result(array $value): never {echo json_encode($value,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE|JSON_PARTIAL_OUTPUT_ON_ERROR);exit;}
function input(): array {
    if (($_SERVER['CONTENT_TYPE']??'') !== 'application/json') fail('Gebruik JSON als inhoudstype.',415);
    if ((int)($_SERVER['CONTENT_LENGTH']??0)>500000) fail('Verzoek is te groot.',413);
    $raw=file_get_contents('php://input',false,null,0,500001);
    $data=json_decode($raw?:'null',true);
    if (!is_array($data)) fail('Ongeldige gegevens.');
    return $data;
}
function sliceText(string $value, int $limit): string {return function_exists('mb_substr') ? mb_substr($value,0,$limit,'UTF-8') : substr($value,0,$limit);}
function lowerText(string $value): string {return function_exists('mb_strtolower') ? mb_strtolower($value,'UTF-8') : strtolower($value);}
function lenText(string $value): int {return function_exists('mb_strlen') ? mb_strlen($value,'UTF-8') : strlen($value);}
function val(mixed $value, int $limit=120): string {return sliceText(trim(is_string($value)?$value:''),$limit);}
function im(mixed $v): string {
    if (!is_string($v)) return '';
    $v=trim($v);
    if(strlen($v)>180000) return '';
    if (preg_match('~^https://[^\s<>"\']{4,1600}$~i',$v))return $v;
    if (preg_match('~^data:image/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$~i',$v))return $v;
    return '';
}
function isId(mixed $v): bool {return is_string($v)&&strlen($v)<=90&&preg_match('/^[a-zA-Z0-9_-]+$/',$v)===1;}
function auth(): void {if (empty($_SESSION['bijons_auth'])) fail('Meld je aan met jullie gezinswachtwoord.',401);}
