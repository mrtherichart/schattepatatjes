<?php
declare(strict_types=1);
namespace Family;
require __DIR__.'/../server/framework/store.php';
require __DIR__.'/../server/framework/domain.php';
require __DIR__.'/../server/framework/integrations.php';
function expect(bool $value,string $message): void {if(!$value)throw new \RuntimeException($message);}
function fails(callable $fn,string $code): void {try{$fn();throw new \RuntimeException('Expected '.$code);}catch(Fault $e){expect($e->kind===$code,'Wrong error: '.$e->kind);}}
$s=initial(['household'=>'Test','people'=>[['id'=>'p1','name'=>'One'],['id'=>'p2','name'=>'Two']]]);
function op(string $id,string $type,string $entity,int $version,array $data=[],string $actor='p1'): array{return ['id'=>$id,'actorId'=>$actor,'type'=>$type,'entityId'=>$entity,'expectedVersion'=>$version,'data'=>$data];}
$a=op('a','task.create','task1',0,['title'=>'Task','assigneeIds'=>['p2'],'dueDate'=>'2026-01-31','repeat'=>'monthly']);
$r=mutate($s,$a,'d1');expect($r['version']===1&&count($s['notifications'])===1,'Create task/notification');
expect(mutate($s,$a,'d2')===$r&&$s['revision']===2,'Replay after device reenrollment');
$b=$a;$b['data']['title']='Changed';fails(fn()=>mutate($s,$b,'d1'),'OPERATION_ID_REUSED');
mutate($s,op('b','task.patch','task1',1,['completed'=>true]),'d1');
fails(fn()=>mutate($s,op('c','task.patch','task1',1,['title'=>'Stale']),'d2'),'VERSION_CONFLICT');
$tasks=array_filter($s['records'],fn($r)=>$r['kind']==='task');expect(count($tasks)===2,'Repeat once');
$next=end($tasks);expect($next['data']['dueDate']==='2026-02-28','Monthly recurrence clamps');
fails(fn()=>mutate($s,op('d','task.create','bad',0,['title'=>'Bad','dueDate'=>'2026-02-30']),'d1'),'VALIDATION_FAILED');
fails(fn()=>mutate($s,op('e','task.create','bad',0,['title'=>'Bad','secret'=>'x']),'d1'),'UNKNOWN_FIELD');
fails(fn()=>mutate($s,op('f','krabbel.create','note',0,['recipientId'=>'p9','text'=>'Hi']),'d1'),'NOT_FOUND');
mutate($s,op('g','krabbel.create','note',0,['recipientId'=>'p2','text'=>'Hi']),'d1');expect($s['records']['krabbel:note']['authorId']==='p1','Krabbel author');
mutate($s,op('h','appearance.create','p1-app',0,['ownerId'=>'p1','surface'=>'app','accent'=>'#abcdef']),'d1');
fails(fn()=>mutate($s,op('i','appearance.patch','p1-app',1,['accent'=>'#000000'],'p2'),'d2'),'PROFILE_OWNER_REQUIRED');
fails(fn()=>mutate($s,op('j','appearance.patch','p1-app',1,['accent'=>'url(javascript:x)']),'d1'),'VALIDATION_FAILED');
mutate($s,op('k','decoration.create','sticker1',0,['ownerId'=>'p1','page'=>'home','kind'=>'postit','text'=>'Hello']),'d1');
fails(fn()=>mutate($s,op('l','decoration.patch','sticker1',1,['page'=>'profile:p2']),'d1'),'VALIDATION_FAILED');
mutate($s,op('m','decoration.trash','sticker1',1),'d1');mutate($s,op('n','decoration.restore','sticker1',2),'d1');expect(!$s['records']['decoration:sticker1']['deleted'],'Restore');
foreach(['https://localhost/a','https://fcm.googleapis.com:123/a','https://user@fcm.googleapis.com/a','http://fcm.googleapis.com/a'] as $url)fails(fn()=>subscription(['endpoint'=>$url,'keys'=>['p256dh'=>str_repeat('a',87),'auth'=>str_repeat('b',22)]]),'PUSH_ENDPOINT_INVALID');
$dir=sys_get_temp_dir().'/family-'.bin2hex(random_bytes(6));mkdir($dir);write($dir.'/foundation.json',$s);
$children=[];for($i=0;$i<4;$i++){$pid=pcntl_fork();if($pid===0){for($j=0;$j<10;$j++)transaction($dir,function(&$x)use($i,$j){return mutate($x,op("writer-$i-$j",'task.create',"task-$i-$j",0,['title'=>'Concurrent']),'d1');});exit(0);}$children[]=$pid;}
foreach($children as $pid){pcntl_waitpid($pid,$status);expect(pcntl_wexitstatus($status)===0,'Writer failed');}
$after=read($dir.'/foundation.json');expect($after['revision']===$s['revision']+40,'Concurrent writes lost');
file_put_contents($dir.'/foundation.json','broken');try{transaction($dir,fn(&$x)=>$x=[]);throw new \RuntimeException('Accepted corrupt data');}catch(\JsonException){}expect(file_get_contents($dir.'/foundation.json')==='broken','Corrupt state overwritten');
foreach(glob($dir.'/*') as $f)unlink($f);rmdir($dir);echo "Foundation PHP: replay, conflicts, recurrence, profiles, validation, restore, SSRF, concurrent writes, corrupt storage passed\n";
