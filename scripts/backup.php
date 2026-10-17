<?php
/** CLI-only full data/media backup and restore. Keep resulting archives outside the webroot. */
declare(strict_types=1);
namespace Family;
if(PHP_SAPI!=='cli')exit(1);
require dirname(__DIR__).'/server/framework/store.php';
$mode=$argv[1]??'';$dir=$argv[2]??'';$archive=$argv[3]??'';
check(in_array($mode,['create','restore'],true)&&is_dir($dir)&&str_ends_with($archive,'.tar'),'USAGE_CREATE_OR_RESTORE_STORAGE_ARCHIVE');
locked($dir,function()use($mode,$dir,$archive){
 if($mode==='create') {
  check(!file_exists($archive),'ARCHIVE_EXISTS');$tar=new \PharData($archive);$tar->addFile($dir.'/foundation.json','foundation.json');
  foreach(glob($dir.'/media/*.png')?:[] as $path)$tar->addFile($path,'media/'.basename($path));
  unset($tar);chmod($archive,0600);echo "Backup created\n";
 }else{
  $tar=new \PharData($archive);check(isset($tar['foundation.json']),'INVALID_BACKUP');
  $s=json_decode($tar['foundation.json']->getContent(),true,512,JSON_THROW_ON_ERROR);check(($s['schemaVersion']??null)===2&&is_array($s['records']??null)&&is_array($s['receipts']??null),'INVALID_BACKUP');
  // A restore revokes devices. Reconnect only after clearing local caches/queues from the old timeline.
  foreach($s['devices'] as &$d)$d['revoked']=true;unset($d);$s['subscriptions']=[];
  foreach($s['records'] as $r)if($r['kind']==='media'&&!$r['deleted']) {
   $id=identifier($r['id']);foreach(['','-thumb'] as $suffix){$key='media/'.$id.$suffix.'.png';check(isset($tar[$key]),'MISSING_MEDIA');}
  }
  if(is_file($dir.'/foundation.json'))write($dir.'/before-restore-'.time().'.json',read($dir.'/foundation.json'));
  if(!is_dir($dir.'/media'))check(mkdir($dir.'/media',0700),'STORAGE_ERROR',500);
  foreach($s['records'] as $r)if($r['kind']==='media'&&!$r['deleted'])foreach(['','-thumb'] as $suffix){$key='media/'.$r['id'].$suffix.'.png';$target=$dir.'/'.$key;check(file_put_contents($target,$tar[$key]->getContent(),LOCK_EX)!==false,'STORAGE_ERROR',500);chmod($target,0600);}
  write($dir.'/foundation.json',$s);echo "Restored; all devices revoked. Clear old local app data before enrolling again.\n";
 }
});
