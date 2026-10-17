/* Schattepatatjes — one interface for the Android WebView and the iPhone web app.
   No framework, no remote JavaScript, no tracking. */
window.SCHATTEPATATJES_NATIVE = Boolean(window.SchattepatatjesUpdater);
import {storage,$,$$,mkid,esc,attr,ico,cleanImg,first,today,addDays,nextRepeat,formatDate,timeAgo,THEMES,STORE_PRESETS} from './modules/common.js';
import {demoData,normalized,applyOperation} from './modules/model.js';
import {createHomeViews} from './modules/views/home.js';
import {createShoppingViews} from './modules/views/shopping.js';
import {createTasksViews} from './modules/views/tasks.js';
import {createPeopleViews} from './modules/views/people.js';
import {createApiClient} from './modules/api-client.js';
import {createDialogView} from './modules/views/dialogs.js';
import {createUpdateUi} from './modules/update-ui.js';

function getSaved(key,fallback){try{const x=storage.getItem(key);return x?JSON.parse(x):fallback;}catch{return fallback;}}
let state = normalized(getSaved('bijons-local-v1',null) || demoData());
let ui = {page:'home',store:'all',taskFilter:'all',catalogue:false,historyGroceries:false,historyTasks:false,viewPerson:state.people[0]?.id||'p1'};
let activeId = storage.getItem('bijons-active-person') || state.people[0]?.id || 'p1';
let modal = null;
let mode = storage.getItem('bijons-was-online') === '1' ? 'online' : 'local'; // local | setup | locked | online
let outbox = getSaved('bijons-outbox-v1',[]);
let flushBusy = false;
let currentFileData = '';
let toastHandle = null;
let lastPollAt = 0;
const apiAddress = 'https://mrtherich.nl/sp/api.php';
const previousSync = getSaved('bijons-last-sync-v1', null);
const diagnostics = {
  phase: 'checking', checkedAt: 0, lastContact: 0,
  lastSync: previousSync, latency: null, httpStatus: null,
  error: '', configured: null, authenticated: null, version: '',
  storageWritable: null, revision: null
};
let probeBusy = false;
function readableTime(timestamp){
 if(!timestamp)return 'Nog nooit';
 return new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(timestamp));
}
function recordConnection(ok, details={}){
 diagnostics.checkedAt = Date.now();
 diagnostics.latency = details.latency ?? null;
 diagnostics.httpStatus = details.status ?? null;
 if(ok){
  diagnostics.lastContact=Date.now();
  diagnostics.phase='ok';
  diagnostics.error='';
  if(details.result?.service==='schattepatatjes-api'){
   diagnostics.configured=details.result.configured;
   diagnostics.authenticated=details.result.authenticated;
   diagnostics.version=details.result.version||'';
   diagnostics.storageWritable=details.result.storageWritable;
   diagnostics.revision=details.result.revision??null;
  }
 }else{
  diagnostics.error=details.error||'Onbekende verbindingsfout.';
  diagnostics.phase=details.status===401?'auth':details.status===0?'offline':'error';
  if(details.status>0)diagnostics.lastContact=Date.now();
 }
 updateConnectionDisplay();
}
function markSynced(){
 const timestamp=new Date().toISOString();
 diagnostics.lastSync=timestamp;
 try{storage.setItem('bijons-last-sync-v1',JSON.stringify(timestamp));}catch{}
 updateConnectionDisplay();
}
function serverPresentation(){
 if(diagnostics.phase==='checking' && !diagnostics.checkedAt)return {label:'Verbinding controleren',style:'checking',detail:'Contact maken met de gezinsserver…'};
 if(diagnostics.phase==='error'||diagnostics.phase==='offline')return {label:outbox.length?`${outbox.length} wachten op synchronisatie`:diagnostics.phase==='offline'?'Geen serververbinding':'Server geeft een fout',style:'offline',detail:diagnostics.error};
 if(diagnostics.phase==='auth'||mode==='locked')return {label:'Aanmelden nodig',style:'warning',detail:'De server is bereikbaar, maar je moet je aanmelden.'};
 if(mode==='setup')return {label:'Gezin instellen',style:'warning',detail:'De server werkt, maar het gezin is nog niet ingesteld.'};
 if(mode==='online'){
  if(!navigator.onLine)return {label:outbox.length?`${outbox.length} wachten`:'Geen internet',style:'offline',detail:'Wijzigingen worden bewaard tot er weer verbinding is.'};
  if(outbox.length)return {label:`${outbox.length} nog te versturen`,style:'warning',detail:'De wijzigingen staan veilig op dit toestel en wachten op de server.'};
  if(diagnostics.phase==='checking')return {label:'Synchronisatie controleren',style:'checking',detail:'Contact met de server controleren.'};
  return {label:'Gesynchroniseerd',style:'connected',detail:'De gezinsgegevens zijn bijgewerkt.'};
 }
 return {label:'Alleen op dit toestel',style:'local',detail:'Dit zijn lokale gegevens. Je deelt ze nog niet met je gezin.'};
}
function connectionPanel(){
 const p=serverPresentation();
 const statusText=diagnostics.httpStatus ? `HTTP ${diagnostics.httpStatus}` : 'Geen HTTP-antwoord';
 const known=diagnostics.configured===null?'Onbekend':diagnostics.configured?'Geïnstalleerd':'Nog niet ingesteld';
 const auth=diagnostics.authenticated===null?'Onbekend':diagnostics.authenticated?'Aangemeld':'Niet aangemeld';
 return `<div class="connection-panel ${p.style}" aria-live="polite">
  <div class="connection-heading"><span class="connection-light"></span><strong>${esc(p.label)}</strong></div>
  <p class="connection-explain">${esc(p.detail)}</p>
  ${(diagnostics.phase==='error'||diagnostics.phase==='offline')?`<div class="connection-error" role="status">${ico('info','sm')} ${esc(diagnostics.error)}</div>`:''}
  <div class="connection-facts">
   <div><span>Gezinsserver</span><strong>${diagnostics.phase==='offline'?'Geen antwoord':diagnostics.httpStatus?`HTTP ${diagnostics.httpStatus}`:'Nog niet gecontroleerd'}</strong></div>
   <div><span>Gezin / toegang</span><strong>${esc(known)} · ${esc(auth)}</strong></div>
   <div><span>Laatste synchronisatie</span><strong>${esc(readableTime(diagnostics.lastSync))}</strong></div>
   <div><span>Wachtende wijzigingen</span><strong>${outbox.length}</strong></div>
  </div>
  <div class="connection-actions">
   <button type="button" class="gloss-btn secondary small" data-action="test-server">${ico('cloud','sm')} Verbinding testen</button>
   ${mode==='online'?`<button type="button" class="gloss-btn small" data-action="sync-now">${ico('repeat','sm')} Nu synchroniseren</button>`:''}
  </div>
  <details class="connection-tech"><summary>Technische details</summary>
   <div>API-adres: <code>${esc(apiAddress)}</code></div>
   <div>Laatste controle: ${esc(readableTime(diagnostics.checkedAt))} · ${esc(statusText)}</div>
   <div>Reactietijd: ${diagnostics.latency===null?'—':`${Math.round(diagnostics.latency)} ms`}</div>
   <div>API-versie: ${esc(diagnostics.version||'Onbekend')} · Revisie: ${diagnostics.revision??'—'}</div>
   <div>Serveropslag schrijfbaar: ${diagnostics.storageWritable===null?'Onbekend':diagnostics.storageWritable?'Ja':'Nee'}</div>
   <button type="button" class="quiet-link" data-action="copy-diagnostics">Kopieer diagnose (zonder wachtwoord)</button>
  </details>
 </div>`;
}
function updateConnectionDisplay(){
 const trigger=$('#connection-trigger');
 if(trigger)trigger.innerHTML=syncLabel();
 const node=$('#connection-details');
 if(node){
  const opened=Boolean(node.querySelector('details')?.open);
  node.innerHTML=connectionPanel();
  if(opened && node.querySelector('details'))node.querySelector('details').open=true;
 }
}
function errorAdvice(status, isJson){
 if(status===403)return 'Toegang geweigerd (HTTP 403). Controleer /sp/api.php, de hostingrechten en .htaccess.';
 if(status===404)return isJson?'De PHP-API herkent deze controle niet. Upload de nieuwste api.php.':'API niet gevonden (HTTP 404). Controleer of api.php in /sp/ staat.';
 if(status>=500)return `Serverfout (HTTP ${status}). Controleer PHP, config.php en de schrijfrechten van de privé-opslag.`;
 if(status===401)return 'De server is bereikbaar, maar het gezinswachtwoord of de sessie moet opnieuw worden ingesteld.';
 if(status===429)return 'Te veel pogingen. Probeer later opnieuw.';
 if(!isJson)return 'De server geeft HTML of een andere foutpagina in plaats van JSON. Controleer /sp/api.php.';
 return `Serverfout (HTTP ${status}).`;
}
function persist(){try{storage.setItem('bijons-local-v1',JSON.stringify(state));storage.setItem('bijons-outbox-v1',JSON.stringify(outbox));}catch{toast('Lokale opslag is vol; gebruik kleinere foto’s.');}}
function person(id){return state.people.find(p => p.id === id);}
function store(id){return state.stores.find(s => s.id === id);}
function me(){return person(activeId) || state.people[0];}
function activeGroceries(){return state.groceries.filter(g=>!g.done);}
function activeTasks(){return state.tasks.filter(t=>!t.done);}
function avatar(p,size='',active=false){
 if (!p) return `<span class="avatar tiny" aria-label="Niemand toegewezen" style="--tone:#aaa">${ico('people','sm')}</span>`;
 const color=THEMES.find(t=>t.id===p.theme)?.color||'#a89b82';
 const src=cleanImg(p.avatar);
 return `<span class="avatar ${size} ${active?'active':''}" style="--tone:${color}" title="${attr(p.name)}">${src?`<img src="${attr(src)}" alt="">`:esc(first(p.name))}</span>`;
}
function photoFor(x){
 const src=cleanImg(x.image);
 const test=x.name.toLowerCase();
 const hint=/(melk|yoghurt|water|sap)/.test(test)?'milk':/(brood|bolletjes|croissant)/.test(test)?'bread':/(shampoo|zeep|wasmiddel|tandpasta)/.test(test)?'bottle':/(schroef|verf|lamp|gereedschap|boor)/.test(test)?'wrench':'basket';
 return `<span class="product-thumbnail ${src?'photo':''}">${src?`<img src="${attr(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:ico(hint)}</span>`;
}
function logoHeader(){return `<header class="masthead"><div class="masthead-row"><div><div class="mast-small">ONS KLEINE HOEKJE</div><div class="brand">schattepatatjes<span>✦</span></div></div><div class="mast-right"><div class="mast-avatars">${state.people.map(p=>`<button class="avatar ${p.id===activeId?'active':''}" aria-label="Verder als ${attr(p.name)}" title="Verder als ${attr(p.name)}" data-action="become" data-id="${attr(p.id)}" style="--tone:${THEMES.find(x=>x.id===p.theme)?.color||'#bbb'}">${cleanImg(p.avatar)?`<img src="${attr(cleanImg(p.avatar))}" alt="">`:esc(first(p.name))}</button>`).join('')}</div><button class="icon-button header-gear" aria-label="Instellingen" data-action="settings">${ico('gear')}</button></div></div></header>`;}
const nav = [{page:'home',name:'Thuis',icon:'home'},{page:'shopping',name:'Boodschappen',icon:'basket'},{page:'tasks',name:'Taken',icon:'checklist'},{page:'people',name:'Profielen',icon:'people'}];
function bottomNav(){return `<nav class="bottom-nav" aria-label="Hoofdnavigatie">${nav.map(n=>`<button class="nav-button ${ui.page===n.page?'active':''}" data-action="navigate" data-page="${n.page}" aria-current="${ui.page===n.page?'page':'false'}">${ico(n.icon)}<span>${n.name}</span></button>`).join('')}</nav>`;}
function syncLabel(){const p=serverPresentation();return `<span class="sync-status ${p.style}"><span class="status-dot"></span>${esc(p.label)}</span>`;}
function render(){
 if(!person(activeId))activeId=state.people[0]?.id || '';
 $('#app').innerHTML=`<div class="app-shell">${logoHeader()}<div class="motto-strip"><span class="motto-text">${esc(state.household)} · ${new Intl.DateTimeFormat('nl-NL',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}</span><button class="quiet-link" id="connection-trigger" data-action="settings" aria-label="Bekijk serververbinding en synchronisatie">${syncLabel()}</button></div><main class="page" id="main">${ui.page==='home'?homePage():ui.page==='shopping'?shoppingPage():ui.page==='tasks'?tasksPage():peoplePage()}</main>${bottomNav()}</div>`;
}
function pageTitle(kicker,title,subtitle='',right=''){return `<div class="page-head"><div><div class="eyebrow">${kicker}</div><h1 class="page-title">${title}</h1>${subtitle?`<p class="page-subtitle">${subtitle}</p>`:''}</div>${right}</div>`;}

// One live application state, domain-oriented views. Views cannot mutate state or send network requests.
const viewContext = () => ({state, ui, activeId, person, store, me, activeGroceries,
  activeTasks, avatar, photoFor, pageTitle, taskLine});
const {taskLine, tasksPage} = createTasksViews(viewContext);
const {homePage} = createHomeViews(viewContext);
const {shoppingPage} = createShoppingViews(viewContext);
const {peoplePage} = createPeopleViews(viewContext);
function operation(type,data){
 const op={id:mkid(),type,data,actorId:activeId,at:new Date().toISOString()};
 applyOperation(state,op);
 if(mode==='online'||(mode==='locked'&&storage.getItem('bijons-was-online')==='1'))outbox.push(op);
 persist();render();
 if(mode==='online')flushQueue();
 return op;
}
const api = createApiClient({apiAddress, recordConnection, errorAdvice});
async function loadRemote(){
 const previousMode=mode;
 try{
  const res=await api('state');
  if(res.needsSetup){mode='setup';render();if(modal?.kind==='settings'&&mode!==previousMode)renderOverlay();return;}
  if(res.state){
   mode='online';diagnostics.authenticated=true;diagnostics.configured=true;
   storage.setItem('bijons-was-online','1');
   state=normalized(res.state);
   if(outbox.length)outbox.forEach(op=>applyOperation(state,op));
   persist();if(!outbox.length)markSynced();render();
   if(modal?.kind==='settings'&&mode!==previousMode)renderOverlay();
   if(outbox.length)flushQueue();
  }
 }catch(e){
  if(e.status===401){mode='locked';render();if(modal?.kind==='settings'&&mode!==previousMode)renderOverlay();return;}
  if(mode!=='online'){mode='local';render();}
 }
}
async function flushQueue(){
 if(flushBusy||mode!=='online'||!outbox.length)return;
 flushBusy=true;
 try{
  while(outbox.length){
   const op=outbox[0];
   const res=await api('mutate',{body:op});
   outbox.shift();state=normalized(res.state);
   outbox.forEach(p=>applyOperation(state,p));
   persist();markSynced();render();
  }
 }catch(e){
  if(e.status===401){mode='locked';toast('Meld je opnieuw aan om te synchroniseren.');}
  else toast(`Wijzigingen blijven op dit toestel staan. ${e.message}`);
 }finally{flushBusy=false;render();updateConnectionDisplay();}
}
async function refreshRemote(force=false){
 if(mode!=='online'||flushBusy||outbox.length)return;
 if(!force && Date.now()-lastPollAt<5500)return;
 lastPollAt=Date.now();
 try{
  const res=await api('state',{query:{since:String(state.revision||0)}});
  if(res.state){state=normalized(res.state);persist();render();}
  markSynced();
 }catch(e){if(e.status===401){mode='locked';render();if(modal?.kind==='settings')renderOverlay();}}
}
async function probeServer(){
 if(probeBusy)return;
 probeBusy=true;
 try{
  const res=await api('health');
  const prior=mode;
  if(!res.configured){mode='setup';}
  else if(!res.authenticated){mode='locked';}
  else if(mode!=='online'){await loadRemote();}
  if(mode!==prior){render();if(modal?.kind==='settings')renderOverlay();}
 }catch(e){/* api() already supplied the concrete failure to the interface. */}
 finally{probeBusy=false;updateConnectionDisplay();}
}
async function syncNow(){
 await probeServer();
 if(mode==='online'){
  if(outbox.length)await flushQueue();
  else await refreshRemote(true);
 }
 updateConnectionDisplay();
}
function copiedDiagnostics(){
 const rows=[`Schattepatatjes ${window.SchattepatatjesUpdater?.appVersion?.()||'web'}`,`API: ${apiAddress}`,
  `Status: ${serverPresentation().label}`,`HTTP: ${diagnostics.httpStatus??'Geen'}`,
  `Laatste controle: ${readableTime(diagnostics.checkedAt)}`,`Laatste synchronisatie: ${readableTime(diagnostics.lastSync)}`,
  `Wachtende wijzigingen: ${outbox.length}`,`API-versie: ${diagnostics.version||'Onbekend'}`,
  `Probleem: ${diagnostics.error||'Geen'}`];
 return rows.join('\n');
}
function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toastHandle);toastHandle=setTimeout(()=>el.classList.remove('show'),2700);}
function openModal(kind,data={}){modal={kind,...data};currentFileData='';renderOverlay();}
function closeModal(){modal=null;currentFileData='';renderOverlay();}
const renderOverlay = createDialogView(() => ({modal,state,mode,person,avatar,connectionPanel,updatePanel}));
async function shrinkPhoto(file){
 if(!file||!file.type.startsWith('image/'))throw Error('Kies een afbeelding.');
 if(file.size>8_000_000)throw Error('Afbeelding is te groot.');
 const bmp=await createImageBitmap(file);const side=Math.min(330/Math.max(bmp.width,bmp.height),1);
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bmp.width*side));canvas.height=Math.max(1,Math.round(bmp.height*side));
 const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bmp,0,0,canvas.width,canvas.height);bmp.close?.();
 return canvas.toDataURL('image/jpeg',.72);
}
async function searchFood(){
 const name=$('#grocery-form input[name="name"]')?.value.trim();const target=$('#product-search-results');
 if(!name){toast('Vul eerst een productnaam in.');return;}
 target.innerHTML='<p class="fineprint">Zoeken in voedingsproducten…</p>';
 try{
  const result=await api('product-search',{query:{q:name}});
  if(!result.products?.length){target.innerHTML='<p class="fineprint">Geen producten gevonden. Je kunt zelf een foto kiezen of een afbeeldingsadres plakken.</p>';return;}
  target.innerHTML=result.products.map(p=>`<button type="button" class="search-result" data-action="use-product" data-image="${attr(p.image)}" data-product-name="${attr(p.name)}">${photoFor(p)}<span><strong>${esc(p.name)}</strong><small>${esc(p.brand||'Open Food Facts')}</small></span></button>`).join('')+`<p class="fineprint">Productfoto’s via Open Food Facts (ODbL / CC BY-SA); controleer of het product klopt.</p>`;
 }catch(e){target.innerHTML=`<p class="fineprint">Zoeken is nu niet beschikbaar. ${esc(e.message)} Plak eventueel een afbeeldingslink.</p>`;}
}
function prepareGroceryFromCatalog(p){
 if(!p)return;
 const dupe=activeGroceries().find(g=>g.name.toLowerCase()===p.name.toLowerCase());
 if(dupe){toast('Staat al op het briefje.');return;}
 operation('addGrocery',{id:mkid(),name:p.name,quantity:p.quantity,storeId:p.storeId,image:p.image});toast('Weer op het briefje gezet.');
}
const {androidUpdateAvailable, updatePanel}=createUpdateUi(toast);
async function handleClick(e){
 const button=e.target.closest('[data-action]');if(!button)return;
 const a=button.dataset.action,id=button.dataset.id;
 if(a==='shade-close'&&e.target===button){closeModal();return;}
 if(a==='close-modal'){closeModal();return;}
 if(a==='navigate'){ui.page=button.dataset.page;window.scrollTo(0,0);render();return;}
 if(a==='become'){activeId=id;storage.setItem('bijons-active-person',activeId);ui.taskFilter='all';render();toast(`Je kijkt nu als ${person(id)?.name}.`);return;}
 if(a==='view-person'){ui.page='people';ui.viewPerson=id;render();window.scrollTo(0,0);return;}
 if(a==='settings'){openModal('settings');return;}
 if(a==='check-app-update'){window.SchattepatatjesUpdater?.checkUpdates();return;}
 if(a==='install-app-update'){window.SchattepatatjesUpdater?.installUpdate();return;}
 if(a==='filter-store'){ui.store=id;render();return;}
 if(a==='filter-task'){ui.taskFilter=id;render();return;}
 if(a==='new-grocery'){openModal('grocery');return;}
 if(a==='new-task'){openModal('task',{assignee:ui.taskFilter==='all'||ui.taskFilter==='none'?'':ui.taskFilter});return;}
 if(a==='task-for-person'){openModal('task',{assignee:id});return;}
 if(a==='edit-grocery'){openModal('grocery',{id});return;}
 if(a==='edit-task'){openModal('task',{id});return;}
 if(a==='assign-task'){openModal('assign',{id});return;}
 if(a==='assign-to'){operation('editTask',{id,assignee:button.dataset.person||''});closeModal();return;}
 if(a==='toggle-grocery'){
  const g=state.groceries.find(g=>g.id===id);if(!g)return;
  operation('toggleGrocery',{id,done:!g.done});return;
 }
 if(a==='toggle-task'){
  const t=state.tasks.find(t=>t.id===id);if(!t)return;
  const wasDone=t.done;operation('toggleTask',{id,done:!wasDone,nextId:mkid()});if(!wasDone&&t.repeat!=='none')toast('De volgende keer staat alweer klaar.');return;
 }
 if(a==='catalogue-add'){prepareGroceryFromCatalog(state.catalogue.find(p=>p.id===id));return;}
 if(a==='again-grocery'){const p=state.groceries.find(g=>g.id===id);if(p)prepareGroceryFromCatalog(p);return;}
 if(a==='toggle-history-grocery'){ui.historyGroceries=!ui.historyGroceries;render();return;}
 if(a==='toggle-history-task'){ui.historyTasks=!ui.historyTasks;render();return;}
 if(a==='edit-person'){openModal('profile',{id});return;}
 if(a==='new-note'){openModal('note',{id});return;}
 if(a==='delete-note'){if(confirm('Dit krabbeltje weghalen?'))operation('deleteNote',{id});return;}
 if(a==='delete-grocery'){if(confirm('Boodschap verwijderen?')){operation('deleteGrocery',{id});closeModal();}return;}
 if(a==='delete-task'){if(confirm('Taak verwijderen?')){operation('deleteTask',{id});closeModal();}return;}
 if(a==='set-theme'){ $$('.theme-option').forEach(b=>b.classList.toggle('selected',b.dataset.theme===button.dataset.theme));$('#profile-form [name="theme"]').value=button.dataset.theme;return;}
 if(a==='search-product'){await searchFood();return;}
 if(a==='open-image-search'){const q=$('#grocery-form [name="name"]')?.value||'product';window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`,'_blank','noopener,noreferrer');return;}
 if(a==='use-product'){
  const url=cleanImg(button.dataset.image);if(!url)return;
  $('#grocery-image-url').value=url;currentFileData='';
  $('#preview-image').innerHTML=`<img src="${attr(url)}" alt="Productafbeelding">`;
  toast('Productfoto gekozen.');return;
 }
 if(a==='retry-server'||a==='test-server'){await probeServer();return;}
 if(a==='sync-now'){await syncNow();return;}
 if(a==='copy-diagnostics'){try{await navigator.clipboard.writeText(copiedDiagnostics());toast('Diagnose gekopieerd, zonder geheime gegevens.');}catch{toast('Kopiëren niet beschikbaar op dit apparaat.');}return;}
 if(a==='logout'){
  try{await api('logout',{body:{}});}catch{}
  mode='locked';diagnostics.authenticated=false;diagnostics.phase='auth';closeModal();render();toast('Afgemeld van dit toestel.');return;
 }
}
async function handleSubmit(e){
 const form=e.target;if(!form.id)return;
 e.preventDefault();
 const data=Object.fromEntries(new FormData(form).entries());
 const name=String(data.name||'').trim();
 if(form.id==='quick-grocery'){
  if(!name)return;
  const p=state.catalogue.find(p=>p.name.toLowerCase()===name.toLowerCase());
  prepareGroceryFromCatalog(p||{name,quantity:'',storeId:ui.store==='all'||ui.store==='other'?'':ui.store,image:''});
  $('#quick-grocery input[name="name"]')?.focus();return;
 }
 if(form.id==='quick-task'){
  if(!name)return;
  operation('addTask',{id:mkid(),name,assignee:ui.taskFilter==='all'||ui.taskFilter==='none'?'':ui.taskFilter,due:'',repeat:'none'});
  $('#quick-task input[name="name"]')?.focus();toast('Staat op het lijstje.');return;
 }
 if(form.id==='grocery-form'){
  if(!name)return;
  let sid=data.storeId||'';
  const storeName=String(data.newStore||'').trim();
  if(storeName){let existing=state.stores.find(s=>s.name.toLowerCase()===storeName.toLowerCase());if(!existing){sid=mkid();operation('addStore',{id:sid,name:storeName});}else sid=existing.id;}
  const image=currentFileData||cleanImg(data.image)||cleanImg(state.groceries.find(x=>x.id===modal.id)?.image);
  const obj={name,quantity:String(data.quantity||'').trim(),storeId:sid,image};
  if(modal.id)operation('editGrocery',{id:modal.id,...obj});else operation('addGrocery',{id:mkid(),...obj});
  closeModal();toast('Boodschappenbriefje bijgewerkt.');return;
 }
 if(form.id==='task-form'){
  if(!name)return;
  const payload={name,assignee:data.assignee||'',due:data.due||'',repeat:data.repeat||'none'};
  if(modal.id)operation('editTask',{id:modal.id,...payload});else operation('addTask',{id:mkid(),...payload});
  closeModal();toast('Taak bijgewerkt.');return;
 }
 if(form.id==='profile-form'){
  const p=person(modal.id);
  operation('editPerson',{id:modal.id,name,avatar:currentFileData||p?.avatar||'',mood:String(data.mood||'').trim(),bio:String(data.bio||'').trim(),theme:data.theme||'sage'});
  closeModal();toast('Jouw plekje is bijgewerkt.');return;
 }
 if(form.id==='note-form'){
  const text=String(data.message||'').trim();if(text)operation('addNote',{id:mkid(),to:modal.id,message:text});
  closeModal();toast('Krabbeltje geplaatst.');return;
 }
 if(form.id==='person-add-form'){
  if(!name)return;const id=mkid();operation('addPerson',{id,name});ui.page='people';ui.viewPerson=id;closeModal();render();toast(`${name} heeft nu een eigen plekje.`);return;
 }
 if(form.id==='house-form'){
  if(data.household?.trim())operation('renameHouse',{household:data.household.trim()});closeModal();toast('Naam gewijzigd.');return;
 }
 if(form.id==='setup-form'){
  const btn=form.querySelector('button[type="submit"]');btn.disabled=true;
  try{
   const result=await api('setup',{body:{household:String(data.household||'').trim(),owner:String(data.owner||'').trim(),partner:String(data.partner||'').trim(),password:String(data.password||''),setupKey:String(data.setupKey||'')}});
   if(result.state){state=normalized(result.state);mode='online';storage.setItem('bijons-was-online','1');outbox=[];activeId=state.people[0]?.id;storage.setItem('bijons-active-person',activeId);persist();markSynced();ui.page='home';closeModal();render();toast('Jullie eigen plekje is aangemaakt.');}
  }catch(err){toast(err.message);}finally{btn.disabled=false;}return;
 }
 if(form.id==='login-form'){
  const btn=form.querySelector('button[type="submit"]');btn.disabled=true;
  try{const result=await api('login',{body:{password:String(data.password||''),setupKey:String(data.setupKey||'')}});if(result.ok){closeModal();await loadRemote();toast('Welkom terug!');}}
  catch(err){toast(err.message);}finally{btn.disabled=false;}return;
 }
}
document.addEventListener('click',e=>{handleClick(e).catch(err=>{console.error(err);toast(err.message||'Er ging iets mis.');});});
document.addEventListener('submit',e=>{handleSubmit(e).catch(err=>{console.error(err);toast(err.message||'Er ging iets mis.');});});
document.addEventListener('change',async e=>{
 const el=e.target;
 if(!['grocery-photo-file','profile-photo-file'].includes(el.id))return;
 try{
  currentFileData=await shrinkPhoto(el.files[0]);
  if(el.id==='grocery-photo-file'){
   $('#preview-image').innerHTML=`<img src="${attr(currentFileData)}" alt="Nieuwe foto">`;
   $('#grocery-image-url').value='';
  }else{
   const av=$('.profile-edit-photo .avatar');
   av.innerHTML=`<img src="${attr(currentFileData)}" alt="Nieuwe profielfoto">`;
  }
  toast('Foto toegevoegd. Vergeet niet op te slaan.');
 }catch(err){toast(err.message);}
});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal)closeModal();});
window.addEventListener('online',()=>{if(mode==='online'){flushQueue();refreshRemote(true);}else probeServer();});
window.addEventListener('offline',()=>updateConnectionDisplay());
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(mode==='online'){flushQueue();refreshRemote(true);}else probeServer();}});
window.setInterval(()=>{if(document.hidden)return;if(mode==='online'){if(outbox.length)flushQueue();else refreshRemote();}else if(Date.now()-diagnostics.checkedAt>45000)probeServer();},12000);
if(!window.SCHATTEPATATJES_NATIVE && 'serviceWorker' in navigator && location.protocol==='https:')navigator.serviceWorker.register('/sp/sw.php', {scope:'/sp/'}).catch(()=>{});
render();
loadRemote();

if(androidUpdateAvailable){try{const last=Number(localStorage.getItem('sp-last-update-check')||0);if(Date.now()-last>12*60*60*1000){localStorage.setItem('sp-last-update-check',String(Date.now()));setTimeout(()=>window.SchattepatatjesUpdater.checkUpdates(),1200);}}catch(e){}}
