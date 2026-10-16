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
function storage(): string {
    $root=realpath($_SERVER['DOCUMENT_ROOT']??__DIR__)?:__DIR__;
    $base=dirname($root).DIRECTORY_SEPARATOR.'bijons-private-'.substr(hash('sha256',realpath(__DIR__)?:__DIR__),0,12);
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
function personOk(array $state,string $id): bool {foreach($state['people']??[] as $p)if(($p['id']??'')===$id)return true;return false;}
function storeOk(array $state,string $id): bool {if($id==='')return true;foreach($state['stores']??[] as $s)if(($s['id']??'')===$id)return true;return false;}
function dueVal(mixed $v): string {$x=val($v,10);return $x===''||preg_match('/^\d{4}-\d{2}-\d{2}$/',$x)?$x:'';}
function nextDate(string $date,string $repeat): string {
    $d=DateTimeImmutable::createFromFormat('!Y-m-d',$date?:date('Y-m-d'))?:new DateTimeImmutable('today');
    $term=['daily'=>'+1 day','weekly'=>'+7 days','monthly'=>'+1 month'][$repeat]??'+1 day';
    $next=$d->modify($term);
    for($i=0;$i<365&&$next->format('Y-m-d')<date('Y-m-d');$i++)$next=$next->modify($term);
    return $next->format('Y-m-d');
}
function upsertProduct(array &$s,array $g): void {
    $key=lowerText(trim((string)($g['name']??'')));
    if($key==='')return;
    foreach($s['catalogue'] as &$p){
        if(lowerText($p['name']??'')===$key){
            $p['name']=$g['name'];$p['quantity']=$g['quantity']?:($p['quantity']??'');
            $p['storeId']=$g['storeId']?:($p['storeId']??'');$p['image']=$g['image']?:($p['image']??'');
            $p['used']=($p['used']??0)+1;return;
        }
    }
    unset($p);
    $s['catalogue'][]=['id'=>bin2hex(random_bytes(8)),'name'=>$g['name'],'quantity'=>$g['quantity'],'storeId'=>$g['storeId'],'image'=>$g['image'],'used'=>1];
}
function mutate(array &$s,array $op): void {
    $type=val($op['type']??'',40);
    $v=is_array($op['data']??null)?$op['data']:[];
    $actor=val($op['actorId']??'',90);
    $at=gmdate('c');
    if (!personOk($s,$actor)) fail('Ongeldig gezinslid. Herlaad de app.');
    if (!in_array($type,['addGrocery','editGrocery','toggleGrocery','deleteGrocery','addTask','editTask','toggleTask','deleteTask','addNote','deleteNote','editPerson','addStore','addPerson','renameHouse'],true))fail('Onbekende bewerking.');
    $id=$v['id']??'';
    if($type!=='renameHouse'&&!isId($id))fail('Ongeldige id.');
    if ($type==='addGrocery') {
        $name=val($v['name']??'',120);if(!$name)fail('Geef een productnaam op.');
        $sid=val($v['storeId']??'',90);if(!storeOk($s,$sid))fail('Onbekende winkel.');
        foreach($s['groceries'] as $g)if($g['id']===$id)return;
        $g=['id'=>$id,'name'=>$name,'quantity'=>val($v['quantity']??'',60),'storeId'=>$sid,'image'=>im($v['image']??''),'done'=>false,'createdAt'=>$at];
        $s['groceries'][]=$g;upsertProduct($s,$g);
    } elseif($type==='editGrocery'){
        foreach($s['groceries'] as &$g)if($g['id']===$id){
            $name=val($v['name']??$g['name'],120);if(!$name)fail('Geef een productnaam op.');
            $sid=val($v['storeId']??$g['storeId'],90);if(!storeOk($s,$sid))fail('Onbekende winkel.');
            $g['name']=$name;$g['storeId']=$sid;$g['quantity']=val($v['quantity']??$g['quantity'],60);$g['image']=im($v['image']??$g['image']);
            $copy=$g;break;
        }
        unset($g);if(isset($copy))upsertProduct($s,$copy);
    }elseif($type==='toggleGrocery'){
        foreach($s['groceries'] as &$g)if($g['id']===$id){$g['done']=!empty($v['done']);$g['doneAt']=$g['done']?$at:'';$g['doneBy']=$g['done']?$actor:'';break;}unset($g);
    }elseif($type==='deleteGrocery'){
        $s['groceries']=array_values(array_filter($s['groceries'],fn($g)=>$g['id']!==$id));
    }elseif($type==='addTask'){
        $name=val($v['name']??'',140);if(!$name)fail('Geef een taaknaam op.');
        $assignee=val($v['assignee']??'',90);if($assignee!==''&&!personOk($s,$assignee))fail('Onbekende persoon.');
        foreach($s['tasks'] as $t)if($t['id']===$id)return;
        $repeat=in_array(($v['repeat']??'none'),['none','daily','weekly','monthly'],true)?$v['repeat']:'none';
        $s['tasks'][]=['id'=>$id,'name'=>$name,'assignee'=>$assignee,'due'=>dueVal($v['due']??''),'repeat'=>$repeat,'done'=>false,'createdAt'=>$at];
    }elseif($type==='editTask'){
        foreach($s['tasks'] as &$t)if($t['id']===$id){
            $name=val($v['name']??$t['name'],140);if(!$name)fail('Taak mag niet leeg zijn.');
            $assignee=val($v['assignee']??$t['assignee'],90);if($assignee!==''&&!personOk($s,$assignee))fail('Onbekende persoon.');
            $t['name']=$name;$t['assignee']=$assignee;$t['due']=dueVal($v['due']??$t['due']);
            $repeat=$v['repeat']??$t['repeat'];$t['repeat']=in_array($repeat,['none','daily','weekly','monthly'],true)?$repeat:'none';break;
        }unset($t);
    }elseif($type==='toggleTask'){
        foreach($s['tasks'] as &$t)if($t['id']===$id){
            $wasDone=!empty($t['done']);$t['done']=!empty($v['done']);$t['doneAt']=$t['done']?$at:'';$t['doneBy']=$t['done']?$actor:'';
            if(!$wasDone&&$t['done']&&($t['repeat']??'none')!=='none'&&isId($v['nextId']??'')){
                $exists=false;foreach($s['tasks'] as $found)if($found['id']===$v['nextId'])$exists=true;
                if(!$exists){$s['tasks'][]=['id'=>$v['nextId'],'name'=>$t['name'],'assignee'=>$t['assignee'],'due'=>nextDate($t['due'],$t['repeat']),'repeat'=>$t['repeat'],'done'=>false,'createdAt'=>$at];}
            }break;
        }unset($t);
    }elseif($type==='deleteTask'){
        $s['tasks']=array_values(array_filter($s['tasks'],fn($t)=>$t['id']!==$id));
    }elseif($type==='addNote'){
        if(!personOk($s,val($v['to']??'',90)))fail('Onbekende ontvanger.');
        $text=val($v['message']??'',500);if(!$text)fail('Krabbeltje is leeg.');
        foreach($s['notes'] as $n)if($n['id']===$id)return;
        $s['notes'][]=['id'=>$id,'to'=>$v['to'],'from'=>$actor,'message'=>$text,'at'=>$at];
    }elseif($type==='deleteNote'){
        $s['notes']=array_values(array_filter($s['notes'],fn($n)=>$n['id']!==$id));
    }elseif($type==='editPerson'){
        foreach($s['people'] as &$p)if($p['id']===$id){
            if(isset($v['name']))$p['name']=val($v['name'],35)?:$p['name'];
            if(isset($v['mood']))$p['mood']=val($v['mood'],60);
            if(isset($v['bio']))$p['bio']=val($v['bio'],350);
            if(isset($v['avatar']))$p['avatar']=im($v['avatar']);
            if(isset($v['theme'])&&in_array($v['theme'],['sage','rose','denim','honey','lilac','pine'],true))$p['theme']=$v['theme'];
            break;
        }unset($p);
    }elseif($type==='addStore'){
        $name=val($v['name']??'',60);if(!$name)fail('Vul een winkelnaam in.');
        foreach($s['stores'] as $store)if($store['id']===$id)return;
        if(count($s['stores'])>70)fail('Te veel winkels.');
        $s['stores'][]=['id'=>$id,'name'=>$name];
    }elseif($type==='addPerson'){
        $name=val($v['name']??'',35);if(!$name)fail('Vul een naam in.');
        if(count($s['people'])>=12)fail('Maximaal 12 gezinsleden in deze versie.');
        foreach($s['people'] as $p)if($p['id']===$id)return;
        $s['people'][]=['id'=>$id,'name'=>$name,'theme'=>'sage','mood'=>'Mijn eigen plekje','bio'=>'','avatar'=>''];
    }elseif($type==='renameHouse'){
        $house=val($v['household']??'',55);if($house)$s['household']=$house;
    }
    foreach(['groceries','tasks','notes'] as $key)if(count($s[$key])>8000)fail('De lijst is te groot; verwijder oude items.');
}

$action=$_GET['action']??'state';
$method=$_SERVER['REQUEST_METHOD']??'GET';
if (!in_array($action,['state','setup','login','logout','mutate','product-search'],true))fail('Onbekende actie.',404);
if (in_array($action,['setup','login','logout','mutate'],true)&&$method!=='POST')fail('POST vereist.',405);
if ($method==='POST'){
    $origin=$_SERVER['HTTP_ORIGIN']??'';
    if($origin && parse_url($origin,PHP_URL_HOST)!==($_SERVER['HTTP_HOST']?explode(':',$_SERVER['HTTP_HOST'])[0]:''))fail('Verzoek is niet afkomstig van deze website.',403);
}
$dir=storage();
$file=$dir.'/household.json';$authFile=$dir.'/account.json';
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
    $fd=lockFile($dir);$s=readJson($file);if(!$s)fail('Geen gezinsgegevens.',500);
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
