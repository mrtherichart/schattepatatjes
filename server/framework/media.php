<?php
declare(strict_types=1);
namespace Family;
function upload(string $dir,string $deviceId): array {
    $id=identifier($_POST['id']??null);$f=$_FILES['file']??null;
    check(is_array($f)&&$f['error']===UPLOAD_ERR_OK&&is_uploaded_file($f['tmp_name']),'UPLOAD_FAILED');
    check($f['size']>0&&$f['size']<=5*1024*1024,'PAYLOAD_TOO_LARGE',413);
    $meta=getimagesize($f['tmp_name']);check(is_array($meta)&&in_array($meta['mime'],['image/jpeg','image/png','image/webp'],true),'INVALID_IMAGE');
    check($meta[0]*$meta[1]<=20000000,'IMAGE_TOO_LARGE',413);check(function_exists('imagecreatefromstring'),'GD_REQUIRED',503);
    $hash=hash_file('sha256',$f['tmp_name']);
    return transaction($dir,function(&$s)use($id,$f,$meta,$hash,$dir,$deviceId){
        requireDevice($s,$deviceId);$key=$id;
        if(isset($s['uploads'][$key])){check($s['uploads'][$key]['hash']===$hash,'OPERATION_ID_REUSED',409);return $s['uploads'][$key]['result'];}
        $img=@imagecreatefromstring(file_get_contents($f['tmp_name']));check($img!==false,'INVALID_IMAGE');
        $mediaDir=$dir.'/media';if(!is_dir($mediaDir))check(mkdir($mediaDir,0700),'STORAGE_ERROR',500);
        $mediaId=bin2hex(random_bytes(16));$path=$mediaDir.'/'.$mediaId.'.png';$thumbPath=$mediaDir.'/'.$mediaId.'-thumb.png';
        try {
            // PNG keeps sticker transparency; encoding removes original EXIF and other metadata.
            imagesavealpha($img,true);check(imagepng($img,$path),'STORAGE_ERROR',500);chmod($path,0600);
            $width=min(400,$meta[0]);$thumb=imagescale($img,$width);check($thumb!==false,'IMAGE_PROCESSING_FAILED',500);
            try {imagesavealpha($thumb,true);check(imagepng($thumb,$thumbPath),'STORAGE_ERROR',500);chmod($thumbPath,0600);}finally{imagedestroy($thumb);}
        } finally {imagedestroy($img);}
        $r=['id'=>$mediaId,'kind'=>'media','version'=>1,'authorId'=>null,'createdAt'=>now(),'updatedAt'=>now(),'deleted'=>false,'archived'=>false,'data'=>['mimeType'=>'image/png','width'=>$meta[0],'height'=>$meta[1],'byteLength'=>filesize($path)]];
        $s['records']['media:'.$mediaId]=$r;$s['revision']++;$result=['mediaId'=>$mediaId,'revision'=>$s['revision']];$s['uploads'][$key]=['hash'=>$hash,'result'=>$result];return $result;
    });
}
