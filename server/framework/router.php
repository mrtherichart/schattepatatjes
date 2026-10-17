<?php
declare(strict_types=1);
namespace Family;
require_once __DIR__.'/store.php';
require_once __DIR__.'/domain.php';
require_once __DIR__.'/media.php';
require_once __DIR__.'/integrations.php';

function requireDevice(array $s,string $id): array { $d=$s['devices'][$id]??null;check(is_array($d)&&!$d['revoked']&&$d['expiresAt']>time(),'DEVICE_REQUIRED',401);return $d; }
function device(string $dir): ?string {
    $token=$_COOKIE['sp_device']??'';if(!is_string($token)||!preg_match('/^([a-f0-9]{32})\.([a-f0-9]{64})$/D',$token,$m)||!is_file($dir.'/foundation.json'))return null;
    return locked($dir,function()use($dir,$m){$s=read($dir.'/foundation.json');$d=$s['devices'][$m[1]]??null;if(!$d||$d['revoked']||$d['expiresAt']<=time()||!hash_equals($d['hash'],hash('sha256',$m[2])))return null;return $m[1];});
}
function inputJson(): array {
    check(str_starts_with($_SERVER['CONTENT_TYPE']??'','application/json'),'JSON_REQUIRED',415);
    $raw=file_get_contents('php://input',false,null,0,65537);check(is_string($raw)&&strlen($raw)<=65536,'PAYLOAD_TOO_LARGE',413);
    $body=json_decode($raw,true,64,JSON_THROW_ON_ERROR);check(is_array($body),'MALFORMED_REQUEST',400);return $body;
}
function output(array $data,int $status=200): never {http_response_code($status);echo json_encode(['ok'=>true,'apiVersion'=>2,'data'=>$data],JSON_THROW_ON_ERROR);exit;}
function route(): never {
    try {
        $dir=\storage();$route=$_GET['route']??'bootstrap';$method=$_SERVER['REQUEST_METHOD']??'GET';
        $post=['login','logout','revoke','mutate','upload','subscribe','unsubscribe'];
        check(in_array($route,array_merge($post,['bootstrap','state','media','devices','calendar','notifications','export']),true),'NOT_FOUND',404);
        check($method===(in_array($route,$post,true)?'POST':'GET'),'METHOD_NOT_ALLOWED',405);
        $_SESSION['sp_csrf']??=bin2hex(random_bytes(24));
        if($method==='POST') {
            $origin=$_SERVER['HTTP_ORIGIN']??'';$expected='https://'.($_SERVER['HTTP_HOST']??'');
            $local=defined('SP_TEST_HTTP')&&SP_TEST_HTTP;
            check($origin===$expected||($local&&$origin==='http://'.($_SERVER['HTTP_HOST']??'')),'ORIGIN_INVALID',403);
            check(hash_equals($_SESSION['sp_csrf'],$_SERVER['HTTP_X_CSRF_TOKEN']??''),'CSRF_INVALID',403);
        }
        $deviceId=device($dir);
        if($route==='bootstrap')output(['version'=>'0.0.2','deviceId'=>$deviceId,'csrfToken'=>$_SESSION['sp_csrf'],'needsSetup'=>!is_file($dir.'/account.json'),'capabilities'=>['calendar'=>!empty(integrationConfig()['calendar']),'webPush'=>!empty(integrationConfig()['vapid']),'vapidPublicKey'=>integrationConfig()['vapid']['publicKey']??null]]);
        if($route==='login') {
            check(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off'||(defined('SP_TEST_HTTP')&&SP_TEST_HTTP),'HTTPS_REQUIRED',403);
            $v=inputJson();$password=$v['password']??'';check(is_string($password)&&strlen($password)<=1024);
            locked($dir,function()use($dir,$password){
                $path=$dir.'/login-limits.json';$limits=is_file($path)?read($path):[];$key=hash('sha256',$_SERVER['REMOTE_ADDR']??'');$entry=$limits[$key]??['attempts'=>0,'until'=>0];
                if($entry['until']<time())$entry=['attempts'=>0,'until'=>time()+300];
                check($entry['attempts']<10,'RATE_LIMITED',429);$entry['attempts']++;$limits[$key]=$entry;
                foreach($limits as $k=>$l)if($l['until']<time())unset($limits[$k]);write($path,$limits);
                $account=read($dir.'/account.json');check(password_verify($password,$account['hash']),'LOGIN_FAILED',401);
            });
            migrate($dir);$id=bin2hex(random_bytes(16));$secret=bin2hex(random_bytes(32));$expires=time()+180*86400;$name=text($v['name']??'Apparaat',80);
            transaction($dir,function(&$s)use($id,$secret,$expires,$name,$deviceId){
                if($deviceId&&isset($s['devices'][$deviceId]))$s['devices'][$deviceId]['revoked']=true;
                check(count(array_filter($s['devices'],fn($d)=>!$d['revoked']&&$d['expiresAt']>time()))<50,'DEVICE_LIMIT');
                $s['devices'][$id]=['id'=>$id,'name'=>$name,'hash'=>hash('sha256',$secret),'createdAt'=>now(),'expiresAt'=>$expires,'revoked'=>false];
            });
            session_regenerate_id(true);$_SESSION['sp_csrf']=bin2hex(random_bytes(24));
            setcookie('sp_device',$id.'.'.$secret,['expires'=>$expires,'path'=>'/','secure'=>!(defined('SP_TEST_HTTP')&&SP_TEST_HTTP),'httponly'=>true,'samesite'=>'Strict']);
            output(['deviceId'=>$id,'csrfToken'=>$_SESSION['sp_csrf']]);
        }
        check($deviceId!==null,'DEVICE_REQUIRED',401);
        if($route==='logout'||$route==='revoke') {
            $v=inputJson();$target=$route==='logout'?$deviceId:identifier($v['deviceId']??null);
            transaction($dir,function(&$s)use($deviceId,$target){requireDevice($s,$deviceId);check(isset($s['devices'][$target]),'NOT_FOUND',404);$s['devices'][$target]['revoked']=true;unset($s['subscriptions'][$target]);});
            if($target===$deviceId){setcookie('sp_device','',['expires'=>1,'path'=>'/','secure'=>!(defined('SP_TEST_HTTP')&&SP_TEST_HTTP),'httponly'=>true,'samesite'=>'Strict']);session_regenerate_id(true);$_SESSION['sp_csrf']=bin2hex(random_bytes(24));}
            output([]);
        }
        if($route==='mutate') {$v=inputJson();output(transaction($dir,function(&$s)use($deviceId,$v){requireDevice($s,$deviceId);return mutate($s,$v,$deviceId);}));}
        if($route==='upload')output(upload($dir,$deviceId));
        if($route==='subscribe'||$route==='unsubscribe') {
            $v=inputJson();$sub=$route==='subscribe'?subscription($v['subscription']??[]):null;$profile=$route==='subscribe'?identifier($v['profileId']??null):null;
            transaction($dir,function(&$s)use($deviceId,$sub,$profile){requireDevice($s,$deviceId);if($sub){reference($s,'person',$profile,false);$s['subscriptions'][$deviceId]=['subscription'=>$sub,'profileId'=>$profile,'delivered'=>[]];}else unset($s['subscriptions'][$deviceId]);});output([]);
        }
        $s=locked($dir,function()use($dir,$deviceId){$s=read($dir.'/foundation.json');requireDevice($s,$deviceId);return $s;});
        // Release PHP's session lock before potentially slow network/media operations.
        session_write_close();
        if($route==='state'||$route==='export')output(snapshot($s));
        if($route==='devices')output(['devices'=>array_values(array_map(fn($d)=>array_diff_key($d,['hash'=>true]),$s['devices']))]);
        if($route==='notifications')output(['notifications'=>array_values(array_filter($s['notifications'],function($n)use($s){$p=$s['records']['notificationPreference:'.$n['recipientId']]['data']??[];return ($p['enabled']??true)&&($p[$n['type']]??true);}))]);
        if($route==='calendar')output(calendar($dir));
        if($route==='media') {
            $id=identifier($_GET['id']??null);record($s,'media',$id);$path=$dir.'/media/'.$id.(($_GET['thumbnail']??'')==='1'?'-thumb':'').'.png';check(is_file($path),'NOT_FOUND',404);
            header('Content-Type: image/png');header('Content-Length: '.filesize($path));readfile($path);exit;
        }
        throw new Fault('NOT_FOUND',404);
    }catch(Fault $e){http_response_code($e->status);echo json_encode(['ok'=>false,'apiVersion'=>2,'error'=>['code'=>$e->kind,'details'=>$e->details]],JSON_THROW_ON_ERROR);exit;}
    catch(\Throwable $e){$requestId=bin2hex(random_bytes(6));error_log('Schattepatatjes '.$requestId.' '.get_class($e));http_response_code(500);echo json_encode(['ok'=>false,'apiVersion'=>2,'error'=>['code'=>'SERVER_ERROR','requestId'=>$requestId]]);exit;}
}
route();
