<?php
declare(strict_types=1);
require __DIR__.'/../deploy/lib/WebRevisions.php';
$root=sys_get_temp_dir().'/sp-modular-test-'.bin2hex(random_bytes(4));
mkdir($root);
function removeDir(string $path): void {
 foreach(new DirectoryIterator($path) as $n) {if($n->isDot())continue; if($n->isDir() && !$n->isLink())removeDir($n->getPathname()); else unlink($n->getPathname());}
 rmdir($path);
}
try {
 $source=realpath(__DIR__.'/../web');
 $sha=str_repeat('c',40);
 $items=[];$blobs=[];
 $walk=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($source,FilesystemIterator::SKIP_DOTS));
 foreach($walk as $f) {
  $relative=substr($f->getPathname(),strlen($source)+1);
  $content=file_get_contents($f->getPathname());
  $items[]=['path'=>'web/'.$relative,'type'=>'blob','mode'=>'100644','sha'=>sha1('blob '.strlen($content)."\0".$content),'size'=>strlen($content)];
  $blobs['web/'.$relative]=$content;
 }
 $fetch=static function(string $url,int $limit)use($items,$blobs): string {
  if(str_contains($url,'/git/commits/'))return json_encode(['tree'=>['sha'=>str_repeat('d',40)]]);
  if(str_contains($url,'/git/trees/'))return json_encode(['truncated'=>false,'tree'=>$items]);
  foreach($blobs as $name=>$content)if(str_ends_with($url,'/'.$name))return $content;
  throw new RuntimeException('Onverwachte bron');
 };
 $revisions=new WebRevisions($root);
 $count=$revisions->download($sha,$fetch);
 if($count!==count($items))throw new RuntimeException('Niet alle frontendbestanden gepubliceerd.');
 $revisions->activate($sha);
 if(($revisions->current()['current']??null)!==$sha)throw new RuntimeException('Activeren mislukt.');
 echo "Complete frontend: $count gescheiden bestanden geverifieerd, alle module-imports aanwezig en geactiveerd.\n";
} finally {removeDir($root);}
