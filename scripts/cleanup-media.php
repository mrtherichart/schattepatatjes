<?php
/** Delete only crash-orphaned image files older than seven days; registered media is retained. */
declare(strict_types=1);
namespace Family;
if(PHP_SAPI!=='cli')exit(1);
require dirname(__DIR__).'/server/framework/store.php';
$dir=$argv[1]??'';check(is_dir($dir),'STORAGE_REQUIRED');
locked($dir,function()use($dir){$s=read($dir.'/foundation.json');foreach(glob($dir.'/media/*.png')?:[] as $file){$id=preg_replace('/-thumb$/','',basename($file,'.png'));if(!isset($s['records']['media:'.$id])&&filemtime($file)<time()-7*86400)check(unlink($file),'CLEANUP_FAILED',500);}});
