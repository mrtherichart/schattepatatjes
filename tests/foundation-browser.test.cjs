const {chromium}=require('playwright');const {spawn,execFileSync}=require('child_process');const fs=require('fs'),path=require('path'),os=require('os'),net=require('net'),assert=require('assert/strict');
(async()=>{
 const php=process.env.PHP_BINARY||'php';const temp=fs.mkdtempSync(path.join(os.tmpdir(),'family-browser-'));const root=path.join(temp,'public'),sp=path.join(root,'sp');fs.mkdirSync(sp,{recursive:true});fs.cpSync('web',sp,{recursive:true});fs.cpSync('server',sp,{recursive:true,filter:p=>!p.includes('vendor')});fs.writeFileSync(path.join(sp,'config.php'),"<?php define('SP_TEST_HTTP',true);define('BIJONS_SETUP_KEY','test-key');");
 const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const processPhp=spawn(php,['-d',`session.save_path=${temp}`,'-S',`127.0.0.1:${port}`,'-t',root],{stdio:'ignore'});const origin=`http://127.0.0.1:${port}`;
 let browser;try{
  for(let i=0;i<50;i++){try{await fetch(origin+'/sp/api.php?action=health');break;}catch{await new Promise(r=>setTimeout(r,50));}}
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']}:{})});
  const context=await browser.newContext({viewport:{width:430,height:932}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.request.post(origin+'/sp/api.php?action=setup',{data:{setupKey:'test-key',household:'Testgezin',owner:'Jan',partner:'Marloes',password:'test-password-long'},headers:{Origin:origin}});
  await page.goto(origin+'/sp/index.html');await page.getByPlaceholder('Gezinswachtwoord',{exact:true}).fill('test-password-long');await page.getByRole('button',{name:'Apparaat vertrouwen',exact:true}).click();
  await page.getByRole('combobox',{name:'Bekijken als'}).waitFor();await page.getByRole('button',{name:'Taken',exact:true}).click();await page.getByRole('button',{name:'Taak toevoegen',exact:true}).click();await page.getByLabel('Taak',{exact:true}).fill('Eerste taak');await page.getByRole('button',{name:'Opslaan',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('foundation-status').textContent.includes('0 wachtende'));
  assert.equal(await page.getByText('Eerste taak',{exact:true}).count(),1);
  // Simulate API outage while keeping the already packaged application assets accessible.
  await page.route('**/api.php?*',route=>route.abort());await page.getByRole('button',{name:'Taak toevoegen',exact:true}).click();await page.getByLabel('Taak',{exact:true}).fill('Offline bewaard');await page.getByRole('button',{name:'Opslaan',exact:true}).click();await page.getByText('Offline bewaard',{exact:true}).waitFor();
  await page.reload();await page.getByRole('button',{name:'Taken',exact:true}).click();await page.getByText('Offline bewaard',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Boodschappen',exact:true}).click();await page.getByRole('button',{name:'Boodschap toevoegen',exact:true}).click();await page.getByLabel('Product',{exact:true}).fill('Foto offline');
  const png=execFileSync(php,['-r',"$i=imagecreatetruecolor(4,4);imagepng($i);"]);await page.locator('input[type=file]').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:png});await page.getByRole('button',{name:'Opslaan',exact:true}).click();await page.getByText('Foto offline',{exact:true}).waitFor();await page.reload();await page.getByRole('button',{name:'Boodschappen',exact:true}).click();await page.getByText('Foto offline',{exact:true}).waitFor();assert(await page.locator('article img[src^="blob:"]').count()>0);
  await page.unroute('**/api.php?*');await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForFunction(()=>document.getElementById('foundation-status').textContent.includes('0 wachtende'));
  await page.locator('article img[src*="route=media"]').waitFor();
  await page.getByRole('button',{name:'Vormgeving aanpassen',exact:true}).click();await page.getByLabel('Achtergrondkleur').fill('#112233');await page.getByRole('button',{name:'Opslaan',exact:true}).click();await page.waitForFunction(()=>getComputedStyle(document.getElementById('app')).backgroundColor==='rgb(17, 34, 51)');
  await page.getByRole('button',{name:'Gezin',exact:true}).click();await page.getByRole('button',{name:'Profiel bezoeken',exact:true}).nth(1).click();await page.waitForFunction(()=>getComputedStyle(document.getElementById('app')).backgroundColor!=='rgb(17, 34, 51)');
  await page.getByRole('button',{name:'Krabbeltje achterlaten',exact:true}).click();await page.getByLabel('Krabbeltje',{exact:true}).fill('Lief bericht');await page.getByRole('button',{name:'Opslaan',exact:true}).click();await page.getByText('Lief bericht',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Vandaag',exact:true}).click();await page.waitForFunction(()=>getComputedStyle(document.getElementById('app')).backgroundColor==='rgb(17, 34, 51)');
  await page.getByRole('button',{name:'Decoreren',exact:true}).click();await page.getByRole('button',{name:'Sticker / Post-it / Polaroid',exact:true}).click();await page.getByLabel('Soort',{exact:true}).selectOption('postit');await page.getByLabel('Tekst / onderschrift',{exact:true}).fill('Post-it test');await page.getByRole('button',{name:'Opslaan',exact:true}).click();await page.getByText('Post-it test',{exact:true}).waitFor();
  await page.waitForFunction(()=>document.getElementById('foundation-status').textContent.includes('0 wachtende'));
  if(process.env.BROWSER_SCREENSHOT)await page.screenshot({path:process.env.BROWSER_SCREENSHOT,fullPage:true});
  assert.deepEqual(errors,[]);console.log('Browser: trusted login, task save, offline reload, offline image/link recovery, owner-vs-viewer design, profile krabbel, Post-it passed');
 }finally{await browser?.close();processPhp.kill();await new Promise(r=>processPhp.once('exit',r));fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
