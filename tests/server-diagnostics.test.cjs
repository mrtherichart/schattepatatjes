'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const net=require('node:net');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'schattepatatjes-test-'));
const publicRoot=path.join(temp,'public');fs.mkdirSync(publicRoot);
fs.copyFileSync('server/api.php',path.join(publicRoot,'api.php'));
fs.mkdirSync(path.join(publicRoot,'lib'));
for (const file of fs.readdirSync('server/lib')) fs.copyFileSync(path.join('server/lib',file),path.join(publicRoot,'lib',file));
fs.writeFileSync(path.join(publicRoot,'config.php'),"<?php define('BIJONS_SETUP_KEY','this-is-a-test-only-secret-not-for-production');\n");
const freePort=()=>new Promise(resolve=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function main(){
 const port=await freePort();
 const server=spawn('php',['-S',`127.0.0.1:${port}`,'-t',publicRoot],{stdio:'ignore'});
 const base=`http://127.0.0.1:${port}/api.php`;
 async function call(action,body,cookie=''){
  const r=await fetch(`${base}?action=${action}`,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
  return {response:r,json:await r.json()};
 }
 try{
  let ready=false;
  for(let i=0;i<40;i++){try{await fetch(`${base}?action=health`);ready=true;break;}catch{await wait(90);}}
  assert(ready,'PHP server started');
  let direct=await fetch(`http://127.0.0.1:${port}/lib/mutations.php`);
  assert.equal(direct.status,403,'PHP modules cannot be opened directly');
  let r=await call('health');
  assert.equal(r.response.status,200);
  assert.equal(r.json.service,'schattepatatjes-api');
  assert.equal(r.json.configured,false);
  assert.equal(r.json.authenticated,false);
  assert.equal(typeof r.json.storageWritable,'boolean');
  assert.equal(Object.hasOwn(r.json,'revision'),false);
  r=await call('state');assert.equal(r.json.needsSetup,true);
  r=await call('setup',{household:'Testgezin',owner:'Eén',partner:'Twee',password:'very-long-test-password-123',setupKey:'this-is-a-test-only-secret-not-for-production'});
  assert.equal(r.json.ok,true);
  const oldStorage=path.join(temp,'bijons-private-'+require('node:crypto').createHash('sha256').update(fs.realpathSync(publicRoot)).digest('hex').slice(0,12));
  assert(fs.existsSync(path.join(oldStorage,'household.json')), 'Must reuse original storage directory identity');
  const cookie=r.response.headers.get('set-cookie').split(';')[0];
  r=await call('health',undefined,cookie);
  assert.equal(r.json.configured,true);
  assert.equal(r.json.authenticated,true);
  assert.equal(r.json.revision,1);
  r=await call('state',undefined,cookie);assert.equal(r.json.state.household,'Testgezin');
  r=await call('mutate',{id:'test_op_1',type:'addTask',actorId:'p1',at:new Date().toISOString(),data:{id:'task_diagnostic',name:'Test synchronisatie'}},cookie);
  assert.equal(r.json.ok,true);
  r=await call('health',undefined,cookie);assert.equal(r.json.revision,2);
  r=await call('logout',{},cookie);assert.equal(r.json.ok,true);
  // A fresh session has no stored authentication state.
  r=await call('health');assert.equal(r.json.configured,true);assert.equal(r.json.authenticated,false);
  r=await call('state');assert.equal(r.response.status,401);
  assert.equal(typeof r.json.message,'string');
  console.log('PHP API diagnostics: health, setup, state, mutation, session and 401 confirmed.');
 }finally{server.kill();const privatePath=path.join(os.tmpdir(),'bijons-private-'+require('node:crypto').createHash('sha256').update(fs.realpathSync(publicRoot)).digest('hex').slice(0,12));fs.rmSync(privatePath,{recursive:true,force:true});fs.rmSync(temp,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
