<?php
/** Run every minute via cron: php scripts/notification-worker.php /absolute/private-storage */
declare(strict_types=1);
namespace Family;
checkCli();
function checkCli(): void {if(PHP_SAPI!=='cli')exit(1);}
require dirname(__DIR__).'/server/config.php';
require dirname(__DIR__).'/server/framework/store.php';
require dirname(__DIR__).'/server/framework/integrations.php';
$autoload=dirname(__DIR__).'/server/vendor/autoload.php';
check(is_file($autoload),'RUN_COMPOSER_INSTALL',503);require $autoload;
$dir=$argv[1]??'';check(is_dir($dir),'STORAGE_REQUIRED');
$cfg=integrationConfig()['vapid']??null;check(is_array($cfg),'VAPID_NOT_CONFIGURED',503);
$worker=fopen($dir.'/notifications.lock','c');if(!$worker||!flock($worker,LOCK_EX|LOCK_NB))exit(0);
try {
 $s=locked($dir,fn()=>read($dir.'/foundation.json'));
 $push=new \Minishlink\WebPush\WebPush(['VAPID'=>$cfg],['TTL'=>3600],15);
 foreach($s['subscriptions'] as $deviceId=>$sub) {
  $device=$s['devices'][$deviceId]??null;if(!$device||$device['revoked']||$device['expiresAt']<=time())continue;
  $prefs=$s['records']['notificationPreference:'.$sub['profileId']]['data']??[];if(($prefs['enabled']??true)===false)continue;
  foreach($s['notifications'] as $id=>$n) {
   if($n['recipientId']!==$sub['profileId']||isset($sub['delivered'][$id])||strtotime($n['createdAt'])<time()-86400||($prefs[$n['type']]??true)===false)continue;
   // Recheck authorization and preference immediately before delivery, without holding the data lock over a network call.
   $allowed=locked($dir,function()use($dir,$deviceId,$sub,$id){$live=read($dir.'/foundation.json');$d=$live['devices'][$deviceId]??null;$p=$live['records']['notificationPreference:'.$sub['profileId']]['data']??[];return $d&&!$d['revoked']&&$d['expiresAt']>time()&&($p['enabled']??true)&&isset($live['subscriptions'][$deviceId])&&!isset($live['subscriptions'][$deviceId]['delivered'][$id]);});
   if(!$allowed)continue;
   $payload=json_encode(['title'=>'Schattepatatjes','body'=>$n['type']==='krabbels'?'Een nieuw krabbeltje voor jou':'Een taak is aan jou toegewezen','tag'=>$id,'url'=>'/sp/?profile='.rawurlencode($n['recipientId'])],JSON_THROW_ON_ERROR);
   $result=$push->sendOneNotification(\Minishlink\WebPush\Subscription::create($sub['subscription']),$payload);
   transaction($dir,function(&$live)use($deviceId,$id,$result){if(!isset($live['subscriptions'][$deviceId]))return;if($result->isSubscriptionExpired())unset($live['subscriptions'][$deviceId]);elseif($result->isSuccess())$live['subscriptions'][$deviceId]['delivered'][$id]=now();});
  }
 }
}finally{flock($worker,LOCK_UN);fclose($worker);}
