<?php
declare(strict_types=1);
namespace Family;

const FIELDS=[
 'person'=>['name','bio','avatarId'],
 'shop'=>['name','latitude','longitude','radius'],
 'task'=>['title','assigneeIds','dueDate','repeat','completed'],
 'shopping'=>['name','quantity','shopId','category','imageId','checked','position'],
 'product'=>['name','quantity','shopId','category','imageId','favorite','used'],
 'krabbel'=>['recipientId','text','imageId','pinned'],
 'decoration'=>['ownerId','page','kind','text','mediaId','sticker','anchor','x','y','scale','rotation','z','crop','color'],
 'appearance'=>['ownerId','surface','background','accent','font','paper'],
 'notificationPreference'=>['ownerId','enabled','krabbels','tasks'],
];
function record(array $s,string $kind,string $id): array {
    $r=$s['records'][$kind.':'.$id]??null; check(is_array($r)&&!$r['deleted'],'NOT_FOUND',404); return $r;
}
function reference(array $s,string $kind,mixed $id,bool $nullable=true): void { if($nullable&&$id===null)return; record($s,$kind,identifier($id)); }
function defaults(string $kind): array {return match($kind){
 'person'=>['name'=>'','bio'=>'','avatarId'=>null],
 'shop'=>['name'=>'','latitude'=>null,'longitude'=>null,'radius'=>100],
 'task'=>['title'=>'','assigneeIds'=>[],'dueDate'=>null,'repeat'=>'none','completed'=>false],
 'shopping'=>['name'=>'','quantity'=>'','shopId'=>null,'category'=>'','imageId'=>null,'checked'=>false,'position'=>0],
 'product'=>['name'=>'','quantity'=>'','shopId'=>null,'category'=>'','imageId'=>null,'favorite'=>false,'used'=>0],
 'krabbel'=>['recipientId'=>'','text'=>'','imageId'=>null,'pinned'=>true],
 'decoration'=>['ownerId'=>'','page'=>'home','kind'=>'sticker','text'=>'','mediaId'=>null,'sticker'=>'heart','anchor'=>'page','x'=>0.5,'y'=>0.2,'scale'=>1,'rotation'=>0,'z'=>0,'crop'=>['x'=>0.5,'y'=>0.5,'zoom'=>1],'color'=>'#fff2ad'],
 'appearance'=>['ownerId'=>'','surface'=>'app','background'=>'#f5efdf','accent'=>'#356f91','font'=>'system','paper'=>'plain'],
 'notificationPreference'=>['ownerId'=>'','enabled'=>true,'krabbels'=>true,'tasks'=>true],
};}
function validate(array $s,string $kind,array $d): void {
    foreach($d as $k=>$v) {
        // Legacy image fields are read-only migration data, never writable through patch.
        if(in_array($k,['legacyImage','legacyAvatar'],true))continue;
        if(in_array($k,['name','title'],true))check(text($v)!=='');
        elseif(in_array($k,['text','bio'],true))text($v,10000);
        elseif(in_array($k,['quantity','category'],true))text($v,120);
        elseif(in_array($k,['completed','checked','favorite','pinned','enabled','krabbels','tasks'],true))check(is_bool($v));
        elseif(in_array($k,['imageId','mediaId','avatarId'],true))reference($s,'media',$v);
        elseif(in_array($k,['ownerId','recipientId'],true))reference($s,'person',$v,false);
        elseif($k==='shopId')reference($s,'shop',$v);
        elseif($k==='assigneeIds') {check(is_array($v)&&array_is_list($v)&&count($v)<=12&&count(array_unique($v,SORT_REGULAR))===count($v));foreach($v as $id)reference($s,'person',$id,false);}
        elseif($k==='dueDate'&&$v!==null) {check(is_string($v));$date=\DateTimeImmutable::createFromFormat('!Y-m-d',$v);check($date!==false&&$date->format('Y-m-d')===$v);}
        elseif($k==='repeat')check(in_array($v,['none','daily','weekly','monthly'],true));
        elseif(in_array($k,['position','z','used'],true))check(is_int($v)&&abs($v)<=1000000&&($k!=='used'||$v>=0));
        elseif(in_array($k,['latitude','longitude'],true)&&$v!==null)check((is_float($v)||is_int($v))&&is_finite((float)$v)&&abs($v)<=($k==='latitude'?90:180));
        elseif($k==='radius')check(is_numeric($v)&&!is_string($v)&&$v>=20&&$v<=1000);
        elseif(in_array($k,['x','y','scale','rotation'],true)){check((is_int($v)||is_float($v))&&is_finite((float)$v));check(match($k){'x','y'=>$v>=0&&$v<=1,'scale'=>$v>=0.2&&$v<=5,'rotation'=>abs($v)<=180});}
        elseif(in_array($k,['background','accent','color'],true))check(is_string($v)&&preg_match('/^#[0-9a-fA-F]{6}$/D',$v)===1);
        elseif($k==='font')check(in_array($v,['system','serif','handwritten'],true));
        elseif($k==='paper')check(in_array($v,['plain','lined','grid'],true));
        elseif($k==='surface')check(in_array($v,['app','profile'],true));
        elseif($k==='kind')check(in_array($v,['sticker','postit','polaroid'],true));
        elseif($k==='sticker')check(in_array($v,['heart','star','flower','cat','sun','custom'],true));
        elseif($k==='anchor')check(in_array($v,['page','header','content','footer'],true));
        elseif($k==='page'){check(is_string($v)&&preg_match('/^(home|tasks|shopping|calendar|people|krabbels|settings|profile:[a-zA-Z0-9_-]{1,90})$/D',$v)===1);if(str_starts_with($v,'profile:'))reference($s,'person',substr($v,8),false);}
        elseif($k==='crop'){check(is_array($v)&&array_keys($v)===['x','y','zoom']);foreach($v as $a=>$n)check((is_int($n)||is_float($n))&&is_finite((float)$n)&&$n>=($a==='zoom'?1:0)&&$n<=($a==='zoom'?5:1));}
    }
    if($kind==='shop')check(($d['latitude']===null)===($d['longitude']===null));
    if($kind==='krabbel')check($d['text']!==''||$d['imageId']!==null);
    if($kind==='decoration') {
        if($d['kind']==='polaroid'||$d['sticker']==='custom')reference($s,'media',$d['mediaId'],false);
        if(str_starts_with($d['page'],'profile:'))check(substr($d['page'],8)===$d['ownerId']);
    }
}
function notify(array &$s,string $id,string $recipient,string $type,string $entity): void {
    $p=$s['records']['notificationPreference:'.$recipient]['data']??[];
    if(($p['enabled']??true)===false||($p[$type]??true)===false)return;
    $s['notifications'][$id]=['id'=>$id,'recipientId'=>$recipient,'type'=>$type,'entityId'=>$entity,'createdAt'=>now()];
    // Notifications have a bounded lifetime; operation receipts are never pruned.
    foreach($s['notifications'] as $key=>$n)if(strtotime($n['createdAt'])<time()-30*86400)unset($s['notifications'][$key]);
}
function mutate(array &$s,array $op,string $deviceId): array {
    check(array_diff(array_keys($op),['id','actorId','type','entityId','expectedVersion','data'])===[]);
    foreach(['id','actorId','type','entityId','expectedVersion','data'] as $key)check(array_key_exists($key,$op));
    $oid=identifier($op['id']);$actor=identifier($op['actorId']);record($s,'person',$actor);
    check(is_string($op['type'])&&is_int($op['expectedVersion'])&&is_array($op['data']));
    $hash=hash('sha256',json_encode($op,JSON_THROW_ON_ERROR));$receiptKey=$oid;
    if(isset($s['receipts'][$receiptKey])){check(hash_equals($s['receipts'][$receiptKey]['hash'],$hash),'OPERATION_ID_REUSED',409);return $s['receipts'][$receiptKey]['receipt'];}
    $parts=explode('.',$op['type']);check(count($parts)===2);[$kind,$verb]=$parts;
    check(isset(FIELDS[$kind])&&in_array($verb,['create','patch','trash','restore','archive'],true),'UNKNOWN_ACTION');
    $id=identifier($op['entityId']);$key=$kind.':'.$id;$old=$s['records'][$key]??null;
    if(($old['version']??0)!==$op['expectedVersion'])throw new Fault('VERSION_CONFLICT',409,['record'=>$old]);
    if($verb==='create')check($old===null,'ALREADY_EXISTS',409);else check($old!==null,'NOT_FOUND',404);
    if($old!==null&&$old['deleted'])check($verb==='restore','DELETED',409);
    if(in_array($kind,['appearance','decoration','notificationPreference'],true)) {
        $owner=$old['data']['ownerId']??($op['data']['ownerId']??''); check($owner===$actor,'PROFILE_OWNER_REQUIRED',403);
        if(isset($op['data']['ownerId']))check($op['data']['ownerId']===$owner);
    }
    if($kind==='appearance')check($id===$actor.'-'.($old['data']['surface']??$op['data']['surface']??'app'));
    if($kind==='notificationPreference')check($id===$actor);
    if($kind==='krabbel'&&$old)check($old['authorId']===$actor||$old['data']['recipientId']===$actor,'FORBIDDEN',403);
    if($kind==='person'&&$verb==='trash')throw new Fault('PERSON_REMOVAL_UNSUPPORTED');
    if($verb==='trash'&&in_array($kind,['shop','product'],true)){foreach($s['records'] as $other)if(!$other['deleted'])check(($other['data'][$kind.'Id']??null)!==$id,'ENTITY_IN_USE');}
    $r=$old??['id'=>$id,'kind'=>$kind,'version'=>0,'authorId'=>$actor,'createdAt'=>now(),'deleted'=>false,'archived'=>false,'data'=>defaults($kind)];
    if(in_array($verb,['create','patch'],true)) {
        check(array_diff(array_keys($op['data']),FIELDS[$kind])===[],'UNKNOWN_FIELD');
        if($kind==='appearance'&&$old&&isset($op['data']['surface']))check($op['data']['surface']===$old['data']['surface']);
        $r['data']=array_replace($r['data'],$op['data']);if(array_key_exists('imageId',$op['data']))unset($r['data']['legacyImage']);if(array_key_exists('avatarId',$op['data']))unset($r['data']['legacyAvatar']);validate($s,$kind,$r['data']);
    } else {
        if($verb==='archive'){check(array_keys($op['data'])===['archived']&&is_bool($op['data']['archived']));$r['archived']=$op['data']['archived'];}
        else {check($op['data']===[]);$r['deleted']=$verb==='trash';if($verb==='restore')validate($s,$kind,$r['data']);}
    }
    $r['version']++;$r['updatedAt']=now();$s['records'][$key]=$r;
    // Repeated tasks are a distinct occurrence, derived deterministically from this operation.
    if($kind==='task'&&$r['data']['completed']&&!($old['data']['completed']??false)&&$r['data']['repeat']!=='none') {
        $d=$r['data'];$base=new \DateTimeImmutable($d['dueDate']??gmdate('Y-m-d'));
        if($d['repeat']==='monthly'){$target=$base->modify('first day of next month');$next=$target->setDate((int)$target->format('Y'),(int)$target->format('m'),min((int)$base->format('d'),(int)$target->format('t')));}else $next=$base->modify($d['repeat']==='daily'?'+1 day':'+7 days');
        $d['dueDate']=$next->format('Y-m-d');$d['completed']=false;$nextId='repeat-'.hash('sha256',$oid);
        $s['records']['task:'.$nextId]=array_replace($r,['id'=>$nextId,'version'=>1,'data'=>$d,'createdAt'=>now()]);
    }
    if($kind==='krabbel'&&$verb==='create'&&$r['data']['recipientId']!==$actor)notify($s,$oid,$r['data']['recipientId'],'krabbels',$id);
    if($kind==='task'&&in_array($verb,['create','patch'],true))foreach(array_diff($r['data']['assigneeIds'],$old['data']['assigneeIds']??[]) as $recipient)if($recipient!==$actor)notify($s,$oid.'-'.$recipient,$recipient,'tasks',$id);
    $s['revision']++;$receipt=['operationId'=>$oid,'revision'=>$s['revision'],'version'=>$r['version']];
    $s['receipts'][$receiptKey]=['hash'=>$hash,'receipt'=>$receipt];return $receipt;
}
