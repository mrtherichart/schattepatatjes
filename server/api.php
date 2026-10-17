<?php
/** Schattepatatjes API v0.2 — PHP + a locked JSON file. No database required. */
declare(strict_types=1);

require __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

$secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_name('bijons_session');
    session_set_cookie_params(['lifetime'=>60*60*24*90, 'path'=>'/', 'secure'=>$secure, 'httponly'=>true, 'samesite'=>'Lax']);
    session_start();
}

// Only this HTTP entry point is public. Private modules require this bootstrap token.
define('SCHATTEPATATJES_API_BOOTSTRAP', true);
require_once __DIR__.'/lib/http.php';
require_once __DIR__.'/lib/storage.php';
require_once __DIR__.'/lib/mutations.php';

if (($_GET['action']??'')==='foundation') { require __DIR__.'/framework/router.php'; exit; }

$action=$_GET['action']??'state';
$method=$_SERVER['REQUEST_METHOD']??'GET';
if (!in_array($action,['health','state','setup','login','logout','mutate','product-search'],true))fail('Onbekende actie.',404);
if (in_array($action,['setup','login','logout','mutate'],true)&&$method!=='POST')fail('POST vereist.',405);
if ($method==='POST'){
    $origin=$_SERVER['HTTP_ORIGIN']??'';
    if($origin && parse_url($origin,PHP_URL_HOST)!==($_SERVER['HTTP_HOST']?explode(':',$_SERVER['HTTP_HOST'])[0]:''))fail('Verzoek is niet afkomstig van deze website.',403);
}
$dir=storage();
$file=$dir.'/household.json';$authFile=$dir.'/account.json';
if ($action==='health'){
    // No household contents or secrets are exposed by this endpoint.
    $configured=is_file($file)&&is_file($authFile);
    $loggedIn=!empty($_SESSION['bijons_auth']);
    $reply=['ok'=>true,'service'=>'schattepatatjes-api','version'=>'0.6',
        'serverTime'=>gmdate('c'),'configured'=>$configured,'authenticated'=>$loggedIn,
        'storageWritable'=>is_writable($dir)];
    if($configured&&$loggedIn){
        $current=readJson($file);
        if(!$current)fail('De gezinsgegevens zijn niet leesbaar.',500);
        $reply['revision']=(int)($current['revision']??0);
    }
    result($reply);
}
if ($action==='setup'){
    if(is_file($file))fail('Dit gezin is al ingesteld.',409);
    $v=input();
    if(!hash_equals(BIJONS_SETUP_KEY,(string)($v['setupKey']??'')))fail('Verkeerde installatiesleutel.',403);
    $password=(string)($v['password']??'');if(strlen($password)<10)fail('Wachtwoord moet minstens 10 tekens bevatten.');
    $owner=val($v['owner']??'',35);$partner=val($v['partner']??'',35);$house=val($v['household']??'',55);
    if(!$owner||!$partner||!$house)fail('Vul de gezinsnaam en beide namen in.');
    $fd=lockFile($dir);if(is_file($file)){flock($fd,LOCK_UN);fail('Dit gezin is net al ingesteld.',409);}
    $now=gmdate('c');
    $state=['revision'=>1,'household'=>$house,
      'people'=>[['id'=>'p1','name'=>$owner,'theme'=>'denim','mood'=>'Mijn eigen plekje','bio'=>'','avatar'=>''],['id'=>'p2','name'=>$partner,'theme'=>'rose','mood'=>'Mijn eigen plekje','bio'=>'','avatar'=>'']],
      'stores'=>[['id'=>'supermarkt','name'=>'Supermarkt'],['id'=>'drogist','name'=>'Drogist'],['id'=>'bouwmarkt','name'=>'Bouwmarkt'],['id'=>'action','name'=>'Action']],
      'groceries'=>[],'tasks'=>[],'notes'=>[],'catalogue'=>[],'processedOps'=>[]];
    atomicJson($authFile,['hash'=>password_hash($password,PASSWORD_DEFAULT),'createdAt'=>$now]);atomicJson($file,$state);
    flock($fd,LOCK_UN);fclose($fd);session_regenerate_id(true);$_SESSION['bijons_auth']=true;
    result(['ok'=>true,'state'=>array_diff_key($state,['processedOps'=>1])]);
}
if (!is_file($file)){
    if($action==='state')result(['ok'=>true,'needsSetup'=>true]);
    fail('Gezin is nog niet ingesteld.',404);
}
if ($action==='login'){
    $v=input();
    if(($_SESSION['login_locked_until']??0)>time())fail('Te veel pogingen. Probeer het later opnieuw.',429);
    $auth=readJson($authFile);
    if(!password_verify((string)($v['password']??''),$auth['hash']??'')){
        $_SESSION['login_attempts']=($_SESSION['login_attempts']??0)+1;
        if($_SESSION['login_attempts']>=6){$_SESSION['login_locked_until']=time()+180;$_SESSION['login_attempts']=0;}
        fail('Wachtwoord is niet juist.',401);
    }
    session_regenerate_id(true);$_SESSION['bijons_auth']=true;unset($_SESSION['login_attempts'],$_SESSION['login_locked_until']);result(['ok'=>true]);
}
if($action==='logout'){input();$_SESSION=[];session_regenerate_id(true);result(['ok'=>true]);}
if($action==='state'){
    auth();$s=readJson($file);if(!$s)fail('Gezinsgegevens kunnen niet worden gelezen.',500);
    if(isset($_GET['since'])&&ctype_digit((string)$_GET['since'])&&(int)$_GET['since']===(int)($s['revision']??0))result(['ok'=>true,'unchanged'=>true]);
    unset($s['processedOps']);result(['ok'=>true,'state'=>$s]);
}
if($action==='mutate'){
    auth();$op=input();if(!isId($op['id']??''))fail('Ongeldige bewerkingscode.');
    $fd=lockFile($dir);if(is_file($dir.'/foundation.json'))fail('Werk de app bij naar v0.0.2; oude clients kunnen niet meer schrijven.',426);$s=readJson($file);if(!$s)fail('Geen gezinsgegevens.',500);
    if(!in_array($op['id'],$s['processedOps']??[],true)){
        mutate($s,$op);
        $s['processedOps'][]=$op['id'];$s['processedOps']=array_slice($s['processedOps'],-250);
        $s['revision']=(int)($s['revision']??0)+1;
        $backup=$dir.'/backup-'.gmdate('Y-m-d').'.json';
        if(!is_file($backup))@copy($file,$backup);
        atomicJson($file,$s);
    }
    flock($fd,LOCK_UN);fclose($fd);unset($s['processedOps']);result(['ok'=>true,'state'=>$s]);
}
if($action==='product-search'){
    auth();
    $q=val($_GET['q']??'',80);if(lenText($q)<2)fail('Voer minimaal twee letters in.');
    $cache=$dir.'/off-'.hash('sha256',lowerText($q)).'.json';
    if(is_file($cache)&&(time()-filemtime($cache))<86400){$cached=readJson($cache);if($cached)result(['ok'=>true,'products'=>$cached]);}
    // Legacy Open Food Facts text search; small, cached, optional enhancement.
    $url='https://world.openfoodfacts.org/cgi/search.pl?'.http_build_query(['search_terms'=>$q,'search_simple'=>'1','action'=>'process','json'=>'1','page_size'=>6,'fields'=>'product_name,brands,image_front_url,image_front_small_url,code']);
    $host=preg_replace('/[^a-zA-Z0-9.-]/','',$_SERVER['HTTP_HOST']??'localhost');
    $ua='Schattepatatjes/0.2 (https://'.$host.'; private family shopping list)';
    $raw=false;
    if(function_exists('curl_init')){
        $ch=curl_init($url);curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>4,CURLOPT_TIMEOUT=>8,CURLOPT_USERAGENT=>$ua,CURLOPT_FOLLOWLOCATION=>false]);$raw=curl_exec($ch);curl_close($ch);
    }elseif(ini_get('allow_url_fopen')){
        $ctx=stream_context_create(['http'=>['timeout'=>8,'header'=>'User-Agent: '.$ua."\r\n"]]);$raw=@file_get_contents($url,false,$ctx);
    }
    if(!$raw)fail('Productzoekdienst is niet bereikbaar.',503);
    $data=json_decode($raw,true);if(!is_array($data))fail('Productzoekdienst gaf geen antwoord.',503);
    $products=[];foreach($data['products']??[] as $p){
        $image=im($p['image_front_small_url']??$p['image_front_url']??'');
        $name=val($p['product_name']??'',120);
        if($name&&$image)$products[]=['name'=>$name,'brand'=>val($p['brands']??'',90),'image'=>$image];
    }
    @file_put_contents($cache,json_encode($products,JSON_UNESCAPED_UNICODE));result(['ok'=>true,'products'=>$products]);
}
fail('Niet ondersteund.',404);
