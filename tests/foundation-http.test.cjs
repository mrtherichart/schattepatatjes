const {spawn,execFileSync}=require('node:child_process');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const assert=require('node:assert/strict');const net=require('node:net');
(async()=>{
 const php=process.env.PHP_BINARY||'php';const temp=fs.mkdtempSync(path.join(os.tmpdir(),'family-http-'));const root=path.join(temp,'public');fs.cpSync('server',root,{recursive:true,filter:src=>!src.includes('vendor')});
 fs.writeFileSync(path.join(root,'config.php'),"<?php define('SP_TEST_HTTP',true); define('BIJONS_SETUP_KEY','test-setup');");
 const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const server=spawn(php,['-d',`session.save_path=${temp}`,'-S',`127.0.0.1:${port}`,'-t',root],{stdio:['ignore','ignore','pipe']});let logs='';server.stderr.on('data',x=>logs+=x);const origin=`http://127.0.0.1:${port}`;
 const privateDir=path.join(temp,'bijons-private-'+require('crypto').createHash('sha256').update(root).digest('hex').slice(0,12));
 function client(){const cookies=new Map();let csrf='';return {cookies,async request(route,body,options={}){
  const headers={Origin:origin,...options.headers};if(cookies.size)headers.Cookie=[...cookies].map(([a,b])=>a+'='+b).join('; ');if(body){headers['X-CSRF-Token']=csrf;if(!(body instanceof FormData))headers['Content-Type']='application/json';}
  const url=origin+'/api.php?'+new URLSearchParams({action:'foundation',route,...options.query});
  const r=await fetch(url,{method:body?'POST':'GET',headers,body:body?(body instanceof FormData?body:JSON.stringify(body)):undefined});
  for(const cookie of r.headers.getSetCookie()){const [pair]=cookie.split(';');const at=pair.indexOf('=');cookies.set(pair.slice(0,at),pair.slice(at+1));}
  const data=options.binary?await r.arrayBuffer():await r.json();if(data?.data?.csrfToken)csrf=data.data.csrfToken;return {status:r.status,data};
 }};}
 try {
  for(let i=0;i<50;i++){try{await fetch(origin+'/api.php?action=foundation&route=bootstrap');break;}catch{await new Promise(r=>setTimeout(r,50));}}
  const setup=await fetch(origin+'/api.php?action=setup',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({setupKey:'test-setup',household:'Family',owner:'One',partner:'Two',password:'test-password-long'})});assert.equal(setup.status,200);
  const a=client(),b=client(),stranger=client();assert.equal((await a.request('bootstrap')).data.data.deviceId,null);
  assert.equal((await a.request('login',{password:'wrong',name:'A'})).status,401);assert.equal((await a.request('login',{password:'test-password-long',name:'A'})).status,200);
  await b.request('bootstrap');const blogin=await b.request('login',{password:'test-password-long',name:'B'});assert.equal(blogin.status,200);
  const state=await a.request('state');assert.equal(state.data.data.schemaVersion,2);assert.equal(Object.keys(state.data.data.records).length,6);assert(!JSON.stringify(state.data).includes('devices'));
  const op={id:'first',actorId:'p1',type:'task.create',entityId:'task1',expectedVersion:0,data:{title:'Test'}};
  assert.equal((await a.request('mutate',op)).status,200);assert.equal((await b.request('mutate',op)).data.data.version,1);
  assert.equal((await a.request('mutate',{...op,data:{title:'Changed'}})).status,409);
  assert.equal((await b.request('mutate',{...op,id:'edit1',type:'task.patch',expectedVersion:1,data:{title:'B'}})).status,200);
  assert.equal((await a.request('mutate',{...op,id:'edit2',type:'task.patch',expectedVersion:1,data:{title:'A'}})).data.error.code,'VERSION_CONFLICT');
  assert.equal((await stranger.request('state')).status,401);
  assert.equal((await a.request('mutate',op,{headers:{Origin:'https://attacker.invalid'}})).status,403);
  const png=execFileSync(php,['-r',"$i=imagecreatetruecolor(4,4);imagepng($i);"]);
  const form=()=>{const f=new FormData();f.set('id','upload1');f.set('file',new Blob([png],{type:'image/png'}),'test.png');return f;};
  const uploaded=await a.request('upload',form());assert.equal(uploaded.status,200,JSON.stringify(uploaded));const mediaId=uploaded.data.data.mediaId;
  assert.equal((await b.request('upload',form())).data.data.mediaId,mediaId);
  assert.equal((await stranger.request('media',null,{query:{id:mediaId},binary:true})).status,401);
  assert.equal((await b.request('media',null,{query:{id:mediaId,thumbnail:'1'},binary:true})).status,200);
  const bad=new FormData();bad.set('id','evil');bad.set('file',new Blob(['<svg><script>evil</script></svg>'],{type:'image/svg+xml'}),'evil.svg');assert.equal((await a.request('upload',bad)).status,422);
  assert.equal((await a.request('mutate',{...op,id:'krabbel1',entityId:'k1',type:'krabbel.create',data:{recipientId:'p2',text:'Hello',imageId:mediaId}})).status,200);
  assert.equal((await b.request('notifications')).data.data.notifications.length,1);
  assert.equal((await a.request('calendar')).data.data.configured,false);
  assert.equal((await a.request('revoke',{deviceId:blogin.data.data.deviceId})).status,200);assert.equal((await b.request('state')).status,401);
  assert(fs.existsSync(path.join(privateDir,'before-v0.0.2.json')));
  const backup=path.join(temp,'backup.tar');execFileSync(php,['scripts/backup.php','create',privateDir,backup]);execFileSync(php,['scripts/backup.php','restore',privateDir,backup]);assert.equal((await a.request('state')).status,401);
  console.log('HTTP: login, cookies, CSRF, device revocation, migration, replay, conflicts, media validation/access, calendar configuration, backup+restore passed');
 }catch(error){console.error(logs);throw error;}finally{server.kill();await new Promise(resolve=>server.once('exit',resolve));fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
