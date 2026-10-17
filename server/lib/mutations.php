<?php
declare(strict_types=1);
if (!defined('SCHATTEPATATJES_API_BOOTSTRAP')) {http_response_code(403);exit;}

function personOk(array $state,string $id): bool {foreach($state['people']??[] as $p)if(($p['id']??'')===$id)return true;return false;}
function storeOk(array $state,string $id): bool {if($id==='')return true;foreach($state['stores']??[] as $s)if(($s['id']??'')===$id)return true;return false;}
function dueVal(mixed $v): string {$x=val($v,10);return $x===''||preg_match('/^\d{4}-\d{2}-\d{2}$/',$x)?$x:'';}
function nextDate(string $date,string $repeat): string {
    $d=DateTimeImmutable::createFromFormat('!Y-m-d',$date?:date('Y-m-d'))?:new DateTimeImmutable('today');
    $term=['daily'=>'+1 day','weekly'=>'+7 days','monthly'=>'+1 month'][$repeat]??'+1 day';
    $next=$d->modify($term);
    for($i=0;$i<365&&$next->format('Y-m-d')<date('Y-m-d');$i++)$next=$next->modify($term);
    return $next->format('Y-m-d');
}
function upsertProduct(array &$s,array $g): void {
    $key=lowerText(trim((string)($g['name']??'')));
    if($key==='')return;
    foreach($s['catalogue'] as &$p){
        if(lowerText($p['name']??'')===$key){
            $p['name']=$g['name'];$p['quantity']=$g['quantity']?:($p['quantity']??'');
            $p['storeId']=$g['storeId']?:($p['storeId']??'');$p['image']=$g['image']?:($p['image']??'');
            $p['used']=($p['used']??0)+1;return;
        }
    }
    unset($p);
    $s['catalogue'][]=['id'=>bin2hex(random_bytes(8)),'name'=>$g['name'],'quantity'=>$g['quantity'],'storeId'=>$g['storeId'],'image'=>$g['image'],'used'=>1];
}
function mutate(array &$s,array $op): void {
    $type=val($op['type']??'',40);
    $v=is_array($op['data']??null)?$op['data']:[];
    $actor=val($op['actorId']??'',90);
    $at=gmdate('c');
    if (!personOk($s,$actor)) fail('Ongeldig gezinslid. Herlaad de app.');
    if (!in_array($type,['addGrocery','editGrocery','toggleGrocery','deleteGrocery','addTask','editTask','toggleTask','deleteTask','addNote','deleteNote','editPerson','addStore','addPerson','renameHouse'],true))fail('Onbekende bewerking.');
    $id=$v['id']??'';
    if($type!=='renameHouse'&&!isId($id))fail('Ongeldige id.');
    if ($type==='addGrocery') {
        $name=val($v['name']??'',120);if(!$name)fail('Geef een productnaam op.');
        $sid=val($v['storeId']??'',90);if(!storeOk($s,$sid))fail('Onbekende winkel.');
        foreach($s['groceries'] as $g)if($g['id']===$id)return;
        $g=['id'=>$id,'name'=>$name,'quantity'=>val($v['quantity']??'',60),'storeId'=>$sid,'image'=>im($v['image']??''),'done'=>false,'createdAt'=>$at];
        $s['groceries'][]=$g;upsertProduct($s,$g);
    } elseif($type==='editGrocery'){
        foreach($s['groceries'] as &$g)if($g['id']===$id){
            $name=val($v['name']??$g['name'],120);if(!$name)fail('Geef een productnaam op.');
            $sid=val($v['storeId']??$g['storeId'],90);if(!storeOk($s,$sid))fail('Onbekende winkel.');
            $g['name']=$name;$g['storeId']=$sid;$g['quantity']=val($v['quantity']??$g['quantity'],60);$g['image']=im($v['image']??$g['image']);
            $copy=$g;break;
        }
        unset($g);if(isset($copy))upsertProduct($s,$copy);
    }elseif($type==='toggleGrocery'){
        foreach($s['groceries'] as &$g)if($g['id']===$id){$g['done']=!empty($v['done']);$g['doneAt']=$g['done']?$at:'';$g['doneBy']=$g['done']?$actor:'';break;}unset($g);
    }elseif($type==='deleteGrocery'){
        $s['groceries']=array_values(array_filter($s['groceries'],fn($g)=>$g['id']!==$id));
    }elseif($type==='addTask'){
        $name=val($v['name']??'',140);if(!$name)fail('Geef een taaknaam op.');
        $assignee=val($v['assignee']??'',90);if($assignee!==''&&!personOk($s,$assignee))fail('Onbekende persoon.');
        foreach($s['tasks'] as $t)if($t['id']===$id)return;
        $repeat=in_array(($v['repeat']??'none'),['none','daily','weekly','monthly'],true)?($v['repeat']??'none'):'none';
        $s['tasks'][]=['id'=>$id,'name'=>$name,'assignee'=>$assignee,'due'=>dueVal($v['due']??''),'repeat'=>$repeat,'done'=>false,'createdAt'=>$at];
    }elseif($type==='editTask'){
        foreach($s['tasks'] as &$t)if($t['id']===$id){
            $name=val($v['name']??$t['name'],140);if(!$name)fail('Taak mag niet leeg zijn.');
            $assignee=val($v['assignee']??$t['assignee'],90);if($assignee!==''&&!personOk($s,$assignee))fail('Onbekende persoon.');
            $t['name']=$name;$t['assignee']=$assignee;$t['due']=dueVal($v['due']??$t['due']);
            $repeat=$v['repeat']??$t['repeat'];$t['repeat']=in_array($repeat,['none','daily','weekly','monthly'],true)?$repeat:'none';break;
        }unset($t);
    }elseif($type==='toggleTask'){
        foreach($s['tasks'] as &$t)if($t['id']===$id){
            $wasDone=!empty($t['done']);$t['done']=!empty($v['done']);$t['doneAt']=$t['done']?$at:'';$t['doneBy']=$t['done']?$actor:'';
            if(!$wasDone&&$t['done']&&($t['repeat']??'none')!=='none'&&isId($v['nextId']??'')){
                $exists=false;foreach($s['tasks'] as $found)if($found['id']===$v['nextId'])$exists=true;
                if(!$exists){$s['tasks'][]=['id'=>$v['nextId'],'name'=>$t['name'],'assignee'=>$t['assignee'],'due'=>nextDate($t['due'],$t['repeat']),'repeat'=>$t['repeat'],'done'=>false,'createdAt'=>$at];}
            }break;
        }unset($t);
    }elseif($type==='deleteTask'){
        $s['tasks']=array_values(array_filter($s['tasks'],fn($t)=>$t['id']!==$id));
    }elseif($type==='addNote'){
        if(!personOk($s,val($v['to']??'',90)))fail('Onbekende ontvanger.');
        $text=val($v['message']??'',500);if(!$text)fail('Krabbeltje is leeg.');
        foreach($s['notes'] as $n)if($n['id']===$id)return;
        $s['notes'][]=['id'=>$id,'to'=>$v['to'],'from'=>$actor,'message'=>$text,'at'=>$at];
    }elseif($type==='deleteNote'){
        $s['notes']=array_values(array_filter($s['notes'],fn($n)=>$n['id']!==$id));
    }elseif($type==='editPerson'){
        foreach($s['people'] as &$p)if($p['id']===$id){
            if(isset($v['name']))$p['name']=val($v['name'],35)?:$p['name'];
            if(isset($v['mood']))$p['mood']=val($v['mood'],60);
            if(isset($v['bio']))$p['bio']=val($v['bio'],350);
            if(isset($v['avatar']))$p['avatar']=im($v['avatar']);
            if(isset($v['theme'])&&in_array($v['theme'],['sage','rose','denim','honey','lilac','pine'],true))$p['theme']=$v['theme'];
            break;
        }unset($p);
    }elseif($type==='addStore'){
        $name=val($v['name']??'',60);if(!$name)fail('Vul een winkelnaam in.');
        foreach($s['stores'] as $store)if($store['id']===$id)return;
        if(count($s['stores'])>70)fail('Te veel winkels.');
        $s['stores'][]=['id'=>$id,'name'=>$name];
    }elseif($type==='addPerson'){
        $name=val($v['name']??'',35);if(!$name)fail('Vul een naam in.');
        if(count($s['people'])>=12)fail('Maximaal 12 gezinsleden in deze versie.');
        foreach($s['people'] as $p)if($p['id']===$id)return;
        $s['people'][]=['id'=>$id,'name'=>$name,'theme'=>'sage','mood'=>'Mijn eigen plekje','bio'=>'','avatar'=>''];
    }elseif($type==='renameHouse'){
        $house=val($v['household']??'',55);if($house)$s['household']=$house;
    }
    foreach(['groceries','tasks','notes'] as $key)if(count($s[$key])>8000)fail('De lijst is te groot; verwijder oude items.');
}

