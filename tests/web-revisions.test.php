<?php
declare(strict_types=1);
require __DIR__.'/../deploy/lib/WebRevisions.php';
function verify(bool $ok,string $msg):void { if (!$ok) throw new RuntimeException($msg); }
$root=sys_get_temp_dir().'/sp-web-tests-'.bin2hex(random_bytes(5));
mkdir($root);
$serverData=$root.'/api.php';file_put_contents($serverData,'<?php /* KEEP SERVER */');
$config=$root.'/config.php';file_put_contents($config,'<?php /* SECRET */');
$familyFile=$root.'/family.json';file_put_contents($familyFile,'{"household":"immutable"}');
$baseline=[$serverData=>hash_file('sha256',$serverData),$config=>hash_file('sha256',$config),$familyFile=>hash_file('sha256',$familyFile)];
$rev=new WebRevisions($root);
$required=['index.html','app.js','styles.css','sw.js','manifest.webmanifest','assets/icon.svg','assets/icon-192.png','assets/icon-512.png','assets/apple-touch-icon.png'];
function mocked(string $commit,array $files):callable {
    $tree=[];$blobs=[];
    foreach($files as $name=>$bytes){$path='web/'.$name;$tree[]=['path'=>$path,'type'=>'blob','mode'=>'100644','sha'=>sha1('blob '.strlen($bytes)."\0".$bytes),'size'=>strlen($bytes)];$blobs[$path]=$bytes;}
    return function(string $url,int $limit)use($commit,$tree,$blobs):string{
        if(str_contains($url,'/git/commits/')) return json_encode(['tree'=>['sha'=>str_repeat('d',40)]]);
        if(str_contains($url,'/git/trees/')) return json_encode(['truncated'=>false,'tree'=>$tree]);
        foreach($blobs as $path=>$bytes)if(str_ends_with($url,'/'.$path))return $bytes;
        throw new RuntimeException('Unexpected request');
    };
}
function removeAll(string $dir):void{foreach(new DirectoryIterator($dir) as $i){if($i->isDot())continue;if($i->isDir()&&!$i->isLink())removeAll($i->getPathname());else unlink($i->getPathname());}rmdir($dir);}
try {
    $one=str_repeat('a',40);$two=str_repeat('b',40);
    $first=[];foreach($required as $file)$first[$file]='test content for '.$file;
    $first['index.html']='<!doctype html><html><head></head><body>FIRST</body></html>';
    verify($rev->download($one,mocked($one,$first))===count($required),'download number');
    verify($rev->current()===null,'No implicit activation');
    $rev->activate($one);
    verify($rev->current()['current']===$one,'First activation');
    $second=$first;$second['index.html']=str_replace('FIRST','SECOND',$first['index.html']);
    verify($rev->download($two,mocked($two,$second))===count($required),'Second download');
    $rev->activate($two);
    verify($rev->current()['current']===$two,'New revision active');
    verify($rev->rollback()===$one,'Previous revision restored');
    verify($rev->current()['current']===$one,'Rollback pointer');
    try{$rev->download(str_repeat('c',40),mocked('',$first+['api.php'=>'<?php die();']));throw new RuntimeException('Injected PHP should fail');}
    catch (RuntimeException $e){verify(str_contains($e->getMessage(),'Onverwacht bestand'),'PHP rejected');}
    try{$rev->download(str_repeat('e',40),function(string $url,int $limit)use($first){
        $callback=mocked('', $first);if(str_contains($url,'/web/index.html'))return 'CORRUPTED'; return $callback($url,$limit);
    });throw new RuntimeException('Corrupted Git blob should fail');}
    catch (RuntimeException $e){verify(str_contains($e->getMessage(),'integriteitscontrole'),'Corrupt blob rejected');}
    verify($rev->current()['current']===$one,'Failed download leaves website unchanged');
    foreach($baseline as $file=>$digest)verify(hash_file('sha256',$file)===$digest,'Server data/config changed: '.$file);
    try{$rev->activate('../../api.php');throw new RuntimeException('Traversal not rejected');}catch(RuntimeException $e){verify(str_contains($e->getMessage(),'Ongeldige'),'Traversal rejected');}
    echo "Web deploy: immutable Git revision, activation, rollback, malicious PHP, checksum and server isolation OK.\n";
}finally { removeAll($root); }
