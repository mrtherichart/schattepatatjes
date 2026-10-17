<?php
declare(strict_types=1);
namespace Family;

final class Fault extends \RuntimeException {
    public function __construct(public string $kind, public int $status=422, public array $details=[]) { parent::__construct($kind); }
}
function check(bool $test, string $code='VALIDATION_FAILED', int $status=422): void { if (!$test) throw new Fault($code,$status); }
function identifier(mixed $id): string { check(is_string($id) && preg_match('/^[a-zA-Z0-9_-]{1,90}$/D',$id)===1); return $id; }
function text(mixed $v,int $max=200): string { check(is_string($v) && preg_match('//u',$v)===1 && (function_exists('mb_strlen')?mb_strlen($v):strlen($v))<=$max); return trim($v); }
function now(): string { return gmdate('Y-m-d\TH:i:s\Z'); }
function read(string $path): array {
    check(is_file($path),'NOT_INITIALIZED',503);
    $raw=file_get_contents($path); check($raw!==false,'STORAGE_ERROR',500);
    $data=json_decode($raw,true,512,JSON_THROW_ON_ERROR); check(is_array($data),'STORAGE_CORRUPT',500); return $data;
}
function write(string $path,array $data): void {
    $json=json_encode($data,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);
    $tmp=$path.'.'.bin2hex(random_bytes(8)).'.tmp'; $fd=fopen($tmp,'xb'); check($fd!==false,'STORAGE_ERROR',500);
    try {
        chmod($tmp,0600); $offset=0;
        while ($offset<strlen($json)) { $n=fwrite($fd,substr($json,$offset)); check($n!==false && $n>0,'STORAGE_ERROR',500); $offset+=$n; }
        check(fflush($fd),'STORAGE_ERROR',500); if(function_exists('fsync'))check(fsync($fd),'STORAGE_ERROR',500);
        fclose($fd); $fd=null; check(rename($tmp,$path),'STORAGE_ERROR',500);
    } finally { if(is_resource($fd))fclose($fd); if(is_file($tmp))unlink($tmp); }
}
function locked(string $dir,callable $fn): mixed {
    $fd=fopen($dir.'/foundation.lock','c'); check($fd!==false,'STORAGE_ERROR',500);
    try { check(flock($fd,LOCK_EX),'STORAGE_ERROR',500); return $fn(); }
    finally { flock($fd,LOCK_UN); fclose($fd); }
}
function initial(array $old): array {
    $s=['schemaVersion'=>2,'revision'=>1,'household'=>$old['household']??'Ons gezin','records'=>[], 'receipts'=>[], 'uploads'=>[], 'devices'=>[], 'notifications'=>[], 'subscriptions'=>[]];
    $mapping=['people'=>'person','stores'=>'shop','tasks'=>'task','groceries'=>'shopping','catalogue'=>'product','notes'=>'krabbel'];
    foreach($mapping as $key=>$kind)foreach($old[$key]??[] as $v) {
        $id=identifier($v['id']);
        $fields=match($kind) {
            'person'=>['name'=>$v['name'],'bio'=>$v['bio']??'','avatarId'=>null,'legacyAvatar'=>$v['avatar']??''],
            'shop'=>['name'=>$v['name'],'latitude'=>null,'longitude'=>null,'radius'=>100],
            'task'=>['title'=>$v['name'],'assigneeIds'=>empty($v['assignee'])?[]:[$v['assignee']],'dueDate'=>$v['due']?:null,'repeat'=>$v['repeat']??'none','completed'=>(bool)($v['done']??false)],
            'shopping'=>['name'=>$v['name'],'quantity'=>$v['quantity']??'','shopId'=>$v['storeId']?:null,'category'=>'','imageId'=>null,'legacyImage'=>$v['image']??'','checked'=>(bool)($v['done']??false),'position'=>0],
            'product'=>['name'=>$v['name'],'quantity'=>$v['quantity']??'','shopId'=>$v['storeId']?:null,'category'=>'','imageId'=>null,'legacyImage'=>$v['image']??'','favorite'=>false,'used'=>(int)($v['used']??0)],
            'krabbel'=>['recipientId'=>$v['to'],'text'=>$v['message'],'imageId'=>null,'pinned'=>true],
        };
        $s['records'][$kind.':'.$id]=['id'=>$id,'kind'=>$kind,'version'=>1,'authorId'=>$v['from']??($old['people'][0]['id']??'p1'),'createdAt'=>$v['createdAt']??$v['at']??now(),'updatedAt'=>now(),'deleted'=>false,'archived'=>false,'data'=>$fields];
    }
    return $s;
}
function migrate(string $dir): void {
    locked($dir,function()use($dir){
        if(is_file($dir.'/foundation.json')) { check((read($dir.'/foundation.json')['schemaVersion']??null)===2,'SCHEMA_UNSUPPORTED',503); return; }
        // Take the legacy writer lock too: the baseline cannot race a legacy mutation.
        $fd=\lockFile($dir);
        try {
            $old=read($dir.'/household.json');
            if(!is_file($dir.'/before-v0.0.2.json'))write($dir.'/before-v0.0.2.json',$old);
            write($dir.'/foundation.json',initial($old));
        } finally { flock($fd,LOCK_UN); fclose($fd); }
    });
}
function transaction(string $dir,callable $fn): mixed {
    return locked($dir,function()use($dir,$fn){ $s=read($dir.'/foundation.json'); $out=$fn($s); write($dir.'/foundation.json',$s); return $out; });
}
function snapshot(array $s): array { return array_intersect_key($s,array_flip(['schemaVersion','revision','household','records'])); }
