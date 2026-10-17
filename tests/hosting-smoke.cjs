'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const net=require('node:net');
const {spawn}=require('node:child_process');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'schattepatatjes-hosting-'));
const root=path.join(tmp,'public');const sp=path.join(root,'sp');
fs.mkdirSync(sp,{recursive:true});
const commit='a'.repeat(40);
function copy(src,dst){fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);}
for(const f of ['index.php','sw.php'])copy(`deploy/hosting/${f}`,`${sp}/${f}`);
copy('deploy/lib/WebRevisions.php',`${sp}/WebRevisions.php`);
copy('server/api.php',`${sp}/api.php`);
for(const f of fs.readdirSync('server/lib')) copy(`server/lib/${f}`,`${sp}/lib/${f}`);
fs.writeFileSync(`${sp}/config.php`,`<?php define('BIJONS_SETUP_KEY','test-installation-token-not-production');\n`);
const webFiles=['index.html','app.js','styles.css','sw.js','manifest.webmanifest','assets/icon.svg','assets/icon-192.png','assets/icon-512.png','assets/apple-touch-icon.png'];
for (const dir of ['modules','modules/views','styles']) for(const f of fs.readdirSync(`web/${dir}`)) if(f.endsWith('.js') || f.endsWith('.css')) webFiles.push(`${dir}/${f}`);
for(const file of webFiles)copy(`web/${file}`,`${sp}/static/revisions/${commit}/${file}`);
fs.mkdirSync(`${sp}/.web-state`,{recursive:true});
fs.writeFileSync(`${sp}/.web-state/current.json`,JSON.stringify({current:commit,previous:null}));
async function port(){return new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});}
async function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function main(){
 const server=spawn('php',['-S',`127.0.0.1:${await port()}`,'-t',root],{stdio:['ignore','pipe','pipe']});
 const addr=`http://127.0.0.1:${server.spawnargs[2].split(':')[1]}`;
 try{
  let ready=false;for(let j=0;j<30;j++){try{const r=await fetch(`${addr}/sp/`);ready=r.ok;if(ready)break;}catch{}await wait(80);}
  assert(ready,'PHP preview starts');
  let res=await fetch(`${addr}/sp/`);let body=await res.text();
  assert.equal(res.status,200);assert(body.includes(`<base href="/sp/static/revisions/${commit}/">`));
  assert(body.includes('Schattepatatjes'));assert(body.includes('app.js?v=8'));
  res=await fetch(`${addr}/sp/static/revisions/${commit}/app.js`);
  assert.equal(res.status,200);body=await res.text();assert(body.includes('https://mrtherich.nl/sp/api.php'));
  res=await fetch(`${addr}/sp/static/revisions/${commit}/modules/model.js`);assert.equal(res.status,200);
  assert((await res.text()).includes('applyOperation'));
  res=await fetch(`${addr}/sp/sw.php`);assert.equal(res.status,200);body=await res.text();
  assert(body.includes(commit));assert(!body.includes('__WEB_REVISION__'));
  res=await fetch(`${addr}/sp/api.php?action=health`);const health=await res.json();
  assert.equal(res.status,200);assert.equal(health.service,'schattepatatjes-api');
  console.log('Hosting smoke: versioned HTML/base, assets, SW scope and independent PHP API OK.');
 } finally{
  server.kill();
  const crypto=require('node:crypto');const privatePath=path.join(os.tmpdir(),'bijons-private-'+crypto.createHash('sha256').update(fs.realpathSync(sp)).digest('hex').slice(0,12));
  fs.rmSync(privatePath,{recursive:true,force:true});fs.rmSync(tmp,{recursive:true,force:true});
 }
}
main().catch(error=>{console.error(error);process.exitCode=1});
