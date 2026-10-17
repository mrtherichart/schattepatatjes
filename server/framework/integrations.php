<?php
declare(strict_types=1);
namespace Family;

function integrationConfig(): array {return defined('SCHATTEPATATJES_INTEGRATIONS')?SCHATTEPATATJES_INTEGRATIONS:[];}
function httpsJson(string $url,?array $form=null,array $headers=[]): array {
    check(function_exists('curl_init'),'CURL_REQUIRED',503);
    $c=curl_init($url);curl_setopt_array($c,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>20,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_HTTPHEADER=>$headers]);
    if($form!==null){curl_setopt($c,CURLOPT_POST,true);curl_setopt($c,CURLOPT_POSTFIELDS,http_build_query($form));}
    $raw=curl_exec($c);$status=curl_getinfo($c,CURLINFO_RESPONSE_CODE);curl_close($c);
    check(is_string($raw)&&$status>=200&&$status<300,'INTEGRATION_UNAVAILABLE',503);
    $result=json_decode($raw,true,512,JSON_THROW_ON_ERROR);check(is_array($result),'INTEGRATION_UNAVAILABLE',503);return $result;
}
function googleToken(array $config): string {
    $creds=read($config['serviceAccountFile']);$b64=fn(string $s)=>rtrim(strtr(base64_encode($s),'+/','-_'),'=');
    $head=$b64(json_encode(['alg'=>'RS256','typ'=>'JWT'],JSON_THROW_ON_ERROR));
    $body=$b64(json_encode(['iss'=>$creds['client_email'],'scope'=>'https://www.googleapis.com/auth/calendar.readonly','aud'=>'https://oauth2.googleapis.com/token','iat'=>time(),'exp'=>time()+3600],JSON_THROW_ON_ERROR));
    check(openssl_sign($head.'.'.$body,$signature,$creds['private_key'],OPENSSL_ALGO_SHA256),'GOOGLE_CREDENTIALS_INVALID',503);
    $r=httpsJson('https://oauth2.googleapis.com/token',['grant_type'=>'urn:ietf:params:oauth:grant-type:jwt-bearer','assertion'=>$head.'.'.$body.'.'.$b64($signature)]);
    check(is_string($r['access_token']??null),'GOOGLE_CREDENTIALS_INVALID',503);return $r['access_token'];
}
function calendar(string $dir): array {
    $cfg=integrationConfig()['calendar']??[];$cache=$dir.'/calendar-cache.json';
    if(empty($cfg['calendarId'])||empty($cfg['serviceAccountFile']))return ['configured'=>false,'events'=>[]];
    $prior=is_file($cache)?read($cache):null;
    if($prior&&time()-($prior['fetchedEpoch']??0)<300)return $prior+['stale'=>false];
    try {
        $token=googleToken($cfg);$items=[];$page=null;$pages=0;
        do {
            $q=['singleEvents'=>'true','orderBy'=>'startTime','maxResults'=>2500,'timeMin'=>gmdate('c',time()-30*86400),'timeMax'=>gmdate('c',time()+180*86400)];if($page)$q['pageToken']=$page;
            $r=httpsJson('https://www.googleapis.com/calendar/v3/calendars/'.rawurlencode($cfg['calendarId']).'/events?'.http_build_query($q),null,['Authorization: Bearer '.$token]);
            foreach($r['items']??[] as $e)if(($e['status']??'')!=='cancelled')$items[]=['id'=>$e['id'],'title'=>$e['summary']??'Afspraak','start'=>$e['start'],'end'=>$e['end'],'location'=>$e['location']??'','description'=>$e['description']??'','url'=>$e['htmlLink']??null];
            $page=$r['nextPageToken']??null;$pages++;check($pages<50||!$page,'CALENDAR_TOO_LARGE',503);
        }while($page);
        $result=['configured'=>true,'fetchedEpoch'=>time(),'fetchedAt'=>now(),'timeZone'=>$r['timeZone']??'Europe/Amsterdam','events'=>$items];write($cache,$result);return $result+['stale'=>false];
    }catch(\Throwable $e){if($prior)return $prior+['stale'=>true,'error'=>'CALENDAR_REFRESH_FAILED'];throw $e;}
}
function subscription(array $input): array {
    check(array_diff(array_keys($input),['endpoint','keys','expirationTime'])===[]);
    $url=$input['endpoint']??'';check(is_string($url)&&strlen($url)<2048);$p=parse_url($url);$host=strtolower($p['host']??'');
    $allowed=in_array($host,['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'],true)||str_ends_with($host,'.notify.windows.com')||str_ends_with($host,'.push.apple.com');
    check(($p['scheme']??'')==='https'&&!isset($p['port'])&&!isset($p['user'])&&!isset($p['pass'])&&$allowed,'PUSH_ENDPOINT_INVALID');
    foreach(['p256dh','auth'] as $key)check(is_string($input['keys'][$key]??null)&&preg_match('/^[A-Za-z0-9_=-]{16,200}$/D',$input['keys'][$key])===1);
    return ['endpoint'=>$url,'keys'=>array_intersect_key($input['keys'],array_flip(['p256dh','auth']))];
}
