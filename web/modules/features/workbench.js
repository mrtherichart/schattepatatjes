import {designFor,attachEditor} from './customization.js';

const LABELS={person:'Gezinslid',shop:'Winkel',task:'Taak',shopping:'Boodschap',product:'Product',krabbel:'Krabbeltje',decoration:'Decoratie',appearance:'Vormgeving'};
const FIELDS={
 person:{name:'Naam',bio:'Over mij',avatarId:'Profielfoto'},
 shop:{name:'Naam',latitude:'Breedtegraad',longitude:'Lengtegraad',radius:'Detectieafstand (meter)'},
 task:{title:'Taak',assigneeIds:'Voor wie',dueDate:'Datum',repeat:'Herhaling',completed:'Afgerond'},
 shopping:{name:'Product',quantity:'Hoeveelheid',shopId:'Winkel',category:'Categorie',imageId:'Foto',checked:'Afgevinkt',position:'Volgorde'},
 product:{name:'Product',quantity:'Hoeveelheid',shopId:'Winkel',category:'Categorie',imageId:'Foto',favorite:'Favoriet'},
 krabbel:{recipientId:'Voor wie',text:'Krabbeltje',imageId:'Foto',pinned:'Vastgepind'},
 decoration:{kind:'Soort',text:'Tekst / onderschrift',mediaId:'Afbeelding',sticker:'Sticker',anchor:'Anker',x:'Horizontaal (0–1)',y:'Verticaal (0–1)',scale:'Grootte',rotation:'Draaiing',z:'Laag',color:'Papierkleur'},
 appearance:{background:'Achtergrondkleur',accent:'Accentkleur',font:'Lettertype',paper:'Papier'}
};
const OPTIONS={repeat:{none:'Geen',daily:'Dagelijks',weekly:'Wekelijks',monthly:'Maandelijks'},kind:{sticker:'Sticker',postit:'Post-it',polaroid:'Polaroid'},sticker:{heart:'Hart',star:'Ster',flower:'Bloem',cat:'Kat',sun:'Zon',custom:'Eigen afbeelding'},anchor:{page:'Pagina',header:'Kop',content:'Inhoud',footer:'Onderkant'},font:{system:'Standaard',serif:'Boek',handwritten:'Handgeschreven'},paper:{plain:'Effen',lined:'Lijntjes',grid:'Ruitjes'}};
const BOOLEANS=['completed','checked','favorite','pinned'];const NUMBERS=['latitude','longitude','radius','position','x','y','scale','rotation','z'];
const DEFAULTS={radius:100,position:0,x:0.5,y:0.3,scale:1,rotation:0,z:0,kind:'sticker',sticker:'heart',anchor:'page',pinned:true,color:'#fff2ad',background:'#f5efdf',accent:'#356f91',font:'system',paper:'plain',repeat:'none'};
function node(tag,text,attributes={}){const el=document.createElement(tag);if(text!==null)el.textContent=text;for(const [k,v]of Object.entries(attributes))el.setAttribute(k,v);return el;}
function button(text,action){const b=node('button',text,{type:'button'});b.addEventListener('click',action);return b;}

export function mountWorkbench(root,app){
 const {sync,family,transport}=app;let page='home';let visited=null;let showTrash=false;let showArchive=false;let shopFilter='';let editMode=false;let selected=null;let disposers=[];let urls=[];let lastUndo=null;
 root.className='foundation';root.replaceChildren();
 const title=node('h1','Schattepatatjes · v0.0.2');const status=node('p','Verbinden…',{id:'foundation-status',role:'status'});const feedback=node('p','',{role:'status'});
 const profile=node('select',null,{'aria-label':'Bekijken als'});const nav=node('nav');const content=node('section');const formHost=node('section');const conflicts=node('section');const loginHost=node('section');
 root.append(title,status,feedback,profile,nav,loginHost,content,formHost,conflicts);
 const run=fn=>async()=>{try{feedback.textContent='';await fn();}catch(e){feedback.textContent=e.message;}};
 for(const [id,label]of [['home','Vandaag'],['tasks','Taken'],['shopping','Boodschappen'],['calendar','Planning'],['people','Gezin'],['krabbels','Laatste krabbeltjes'],['settings','Meer']])nav.append(button(label,run(()=>{page=id;showTrash=false;showArchive=false;selected=null;formHost.replaceChildren();render();})));
 profile.addEventListener('change',run(()=>sync.selectProfile(profile.value)));
 function imageUrl(id){if(!id)return null;if(id.startsWith('local-')){const u=sync.view().uploads.find(u=>u.localId===id);if(!u)return null;const url=URL.createObjectURL(u.blob);urls.push(url);return url;}return transport.mediaUrl(id);}
 function picture(id,legacy=null){const safeLegacy=typeof legacy==='string'&&(/^[hH][tT][tT][pP][sS]:\/\/[^\s<>]+$/.test(legacy)||/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(legacy))?legacy:null;const src=imageUrl(id)||safeLegacy;if(!src)return null;return node('img',null,{src,alt:'',loading:'lazy'});}
 function editor(kind,record=null,extra={}){
  formHost.replaceChildren();const form=node('form');form.append(node('h2',record?`${LABELS[kind]} aanpassen`:`${LABELS[kind]} toevoegen`));const controls={};
  const existing={...DEFAULTS,...record?.data,...extra};
  for(const [key,label]of Object.entries(FIELDS[kind])){
   const wrap=node('label',label);let input;
   if(['imageId','mediaId','avatarId'].includes(key)){
    input=node('input',null,{type:'file',accept:'image/jpeg,image/png,image/webp'});input.dataset.media=existing[key]||'';
    const library=node('select',null,{'aria-label':'Bestaande afbeelding'});library.append(node('option','Upload nieuw of kies een opgeslagen afbeelding',{value:''}));for(const media of family.records('media'))library.append(node('option',`Foto ${media.createdAt||media.id}`,{value:media.id}));library.value=existing[key]||'';library.onchange=()=>{input.dataset.media=library.value;input.value='';};wrap.append(library);
    if(existing[key]){const img=picture(existing[key]);if(img)wrap.append(img);wrap.append(button('Afbeelding verwijderen',()=>{input.dataset.media='';input.value='';}));}
   }else if(OPTIONS[key]){input=node('select');for(const [value,name]of Object.entries(OPTIONS[key]))input.append(node('option',name,{value}));input.value=existing[key]??Object.keys(OPTIONS[key])[0];}
   else if(['assigneeIds','recipientId','shopId'].includes(key)){
    input=node('select');if(key==='assigneeIds')input.multiple=true;else input.append(node('option','Kies…',{value:''}));
    for(const r of family.records(key==='shopId'?'shop':'person')){const o=node('option',r.data.name,{value:r.id});o.selected=key==='assigneeIds'?(existing[key]||[]).includes(r.id):existing[key]===r.id;input.append(o);}
   }else if(BOOLEANS.includes(key)){input=node('input',null,{type:'checkbox'});input.checked=existing[key]??false;}
   else if(['text','bio'].includes(key)){input=node('textarea');input.value=existing[key]??'';}
   else{input=node('input',null,{type:key==='dueDate'?'date':NUMBERS.includes(key)?'number':['background','accent','color'].includes(key)?'color':'text'});if(NUMBERS.includes(key))input.step='any';input.value=existing[key]??'';}
   input.name=key;input.setAttribute('aria-label',label);wrap.append(input);form.append(wrap);controls[key]=input;
  }
  if(kind==='decoration'&&existing.kind==='polaroid'){
   for(const key of ['x','y','zoom']){const label=node('label',`Uitsnede ${key}`);const input=node('input',null,{type:'number',min:key==='zoom'?'1':'0',max:key==='zoom'?'5':'1',step:'0.05'});input.value=existing.crop?.[key]??(key==='zoom'?1:0.5);controls['crop-'+key]=input;label.append(input);form.append(label);}
  }
  const save=node('button','Opslaan',{type:'submit'});form.append(save,button('Annuleren',()=>formHost.replaceChildren()));
  form.addEventListener('submit',e=>{e.preventDefault();run(async()=>{
   save.disabled=true;try{
    const data={...extra};for(const [key,input]of Object.entries(controls)){
     if(key.startsWith('crop-'))continue;
     if(input.type==='file')data[key]=input.files[0]?await sync.stageImage(input.files[0]):input.dataset.media||null;
     else if(BOOLEANS.includes(key))data[key]=input.checked;
     else if(key==='assigneeIds')data[key]=[...input.selectedOptions].map(o=>o.value);
     else if(NUMBERS.includes(key))data[key]=input.value===''?null:Number(input.value);
     else data[key]=input.value===''&&['dueDate','shopId'].includes(key)?null:input.value;
    }
    if(kind==='decoration'){data.ownerId=sync.view().profileId;data.page=page;if(controls['crop-x'])data.crop={x:Number(controls['crop-x'].value),y:Number(controls['crop-y'].value),zoom:Number(controls['crop-zoom'].value)};}
    if(kind==='appearance')await family.appearance(page.startsWith('profile:')?'profile':'app',data);
    else if(record)await family.patch(kind,record.id,data);else await family.create(kind,data);
    formHost.replaceChildren();render();
   }finally{save.disabled=false;}
  })();});formHost.append(form);form.querySelector('input,textarea,select')?.focus();
 }
 function rows(kind,filter=()=>true){
  const container=node('div');let records=family.records(kind,{trash:showTrash,archive:showArchive}).filter(filter);
  if(kind==='shopping')records.sort((a,b)=>(a.data.category||'').localeCompare(b.data.category||'')||(a.data.position||0)-(b.data.position||0)||a.id.localeCompare(b.id));
  if(kind==='krabbel')records.sort((a,b)=>Number(b.data.pinned)-Number(a.data.pinned)||(b.createdAt||'').localeCompare(a.createdAt||''));
  if(!records.length)container.append(node('p','Nog niets hier.'));
  for(const r of records){const card=node('article');card.append(node('strong',r.data.title||r.data.name||r.data.text||LABELS[kind]));
   if(r.pending)card.append(node('small',' · wacht op synchronisatie'));
   if(kind==='shopping')card.append(node('p',[r.data.quantity,r.data.category].filter(Boolean).join(' · ')));
   if(kind==='task')card.append(node('p',[r.data.dueDate,...(r.data.assigneeIds||[]).map(id=>sync.view().state.records[`person:${id}`]?.data.name||id)].filter(Boolean).join(' · ')));
   if(kind==='krabbel'){const people=sync.view().state.records;card.append(node('p',`${people[`person:${r.authorId}`]?.data.name||'Gezin'} → ${people[`person:${r.data.recipientId}`]?.data.name||'Gezin'}${r.data.pinned?' · vastgepind':''}`));}
   const img=picture(r.data.imageId||r.data.avatarId,r.data.legacyImage||r.data.legacyAvatar);if(img)card.append(img);
   if(showTrash)card.append(button('Terugzetten',run(()=>family.restore(kind,r.id))));
   else{
    if(kind==='task')card.append(button(r.data.completed?'Heropenen':'Afronden',run(()=>family.completeTask(r.id,!r.data.completed))));
    if(kind==='shopping')card.append(button(r.data.checked?'Terug op lijst':'Afvinken',run(()=>family.checkShopping(r.id,!r.data.checked))));
    if(kind==='product')card.append(button('Op boodschappenlijst',run(()=>family.addProduct(r.id))));
    if(kind==='person')card.append(button('Profiel bezoeken',()=>{page=`profile:${r.id}`;visited=r.id;formHost.replaceChildren();render();}));
    card.append(button('Bewerken',()=>editor(kind,r)),button(showArchive?'Uit archief':'Archiveren',run(()=>family.archive(kind,r.id,!showArchive))));
    if(kind!=='person')card.append(button('Prullenbak',run(()=>family.trash(kind,r.id))));
   }
   container.append(card);
  }return container;
 }
 function decorations(design,anchors){
  for(const r of design.decorations){const d=r.data;const el=node('div',null,{class:'decoration',tabindex:'0'});const anchor=anchors[d.anchor]||anchors.page;
   function paint(p){el.style.left=`${p.x*100}%`;el.style.top=`${p.y*100}%`;el.style.transform=`translate(-50%,-50%) rotate(${p.rotation}deg) scale(${p.scale})`;el.style.zIndex=String(p.z);}
   paint(d);el.style.background=d.kind==='sticker'?'transparent':d.color;
   if(d.kind==='sticker'&&d.sticker!=='custom')el.append(node('span',({heart:'♥',star:'★',flower:'✿',cat:'🐈',sun:'☀'})[d.sticker]||'★'));
   else if(d.kind!=='postit'){const img=picture(d.mediaId);if(img){const crop=d.crop||{x:0.5,y:0.5,zoom:1};img.style.objectPosition=`${crop.x*100}% ${crop.y*100}%`;img.style.transform=`scale(${crop.zoom})`;const frame=node('div',null,{class:'photo-crop'});frame.append(img);el.append(frame);}}
   if(d.kind!=='sticker')el.append(node('span',d.text));
   const editable=editMode&&design.ownerId===sync.view().profileId;
   if(editable){const handler=attachEditor(el,{getPlacement:()=>r.data,preview:paint,commit:async p=>{lastUndo={id:r.id,data:{x:d.x,y:d.y,scale:d.scale,rotation:d.rotation}};await family.patch('decoration',r.id,{x:p.x,y:p.y,scale:p.scale,rotation:p.rotation});},onError:e=>feedback.textContent=e.message});handler.select(selected===r.id);el.addEventListener('click',()=>{selected=r.id;render();});disposers.push(()=>handler.dispose());if(selected===r.id)el.classList.add('selected');}
   anchor.append(el);
  }
 }
 function login(){loginHost.replaceChildren();const form=node('form');form.append(node('h2','Dit apparaat toegang geven'));
  const password=node('input',null,{type:'password',autocomplete:'current-password',placeholder:'Gezinswachtwoord',required:''});const name=node('input',null,{placeholder:'Naam van dit apparaat',value:'Mijn telefoon'});const submit=node('button','Apparaat vertrouwen',{type:'submit'});form.append(password,name,submit);form.addEventListener('submit',e=>{e.preventDefault();run(async()=>{submit.disabled=true;try{await app.login(password.value,name.value);password.value='';render();}finally{submit.disabled=false;}})();});
  loginHost.append(form);loginHost.append(node('a','Oude interface openen om wachtende wijzigingen af te handelen',{href:'/sp/index.html?legacy=1'}));const setup=node('details');setup.append(node('summary','Eerste installatie'));
  const setupForm=node('form');const inputs={};for(const [key,label]of Object.entries({setupKey:'Installatiesleutel',household:'Gezinsnaam',owner:'Eerste gezinslid',partner:'Tweede gezinslid',password:'Nieuw gezinswachtwoord (min. 10 tekens)'})){const input=node('input',null,{placeholder:label,type:['password','setupKey'].includes(key)?'password':'text',required:''});inputs[key]=input;setupForm.append(input);}
  setupForm.append(node('button','Gezin instellen',{type:'submit'}));setupForm.addEventListener('submit',e=>{e.preventDefault();run(()=>app.setup(Object.fromEntries(Object.entries(inputs).map(([key,input])=>[key,input.value]))))();});setup.append(setupForm);loginHost.append(setup);
 }
 function render(){
  const v=sync.view();status.textContent=`${v.busy?'Synchroniseren…':v.error||'Gereed'} · ${v.outbox.length} wachtende wijzigingen`;
  if(!v.identity){content.replaceChildren();profile.hidden=true;nav.hidden=true;conflicts.replaceChildren();formHost.replaceChildren();if(!loginHost.childElementCount)login();return;}
  loginHost.replaceChildren();profile.hidden=false;nav.hidden=false;
  const current=v.profileId;profile.replaceChildren(...family.records('person').map(p=>{const o=node('option',p.data.name,{value:p.id});o.selected=p.id===current;return o;}));
  if(formHost.contains(document.activeElement))return;
  for(const dispose of disposers)dispose();disposers=[];for(const url of urls)URL.revokeObjectURL(url);urls=[];
  content.replaceChildren();const design=designFor(v.state,current,page);root.style.background=design.appearance.background;const rgb=design.appearance.background.slice(1).match(/../g).map(h=>parseInt(h,16));root.style.color=(rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722)<140?'#f8f5ed':'#263238';root.style.backgroundImage=design.appearance.paper==='lined'?'repeating-linear-gradient(transparent 0 27px,#8883 28px)':design.appearance.paper==='grid'?'repeating-linear-gradient(0deg,transparent 0 27px,#8883 28px),repeating-linear-gradient(90deg,transparent 0 27px,#8883 28px)':'none';root.style.setProperty('--accent',design.appearance.accent);root.style.fontFamily=({system:'system-ui',serif:'Georgia, serif',handwritten:'cursive'})[design.appearance.font];
  const board=node('div',null,{class:'board'});const heading=node('header',null,{class:'anchor-header'});const body=node('div',null,{class:'anchor-content'});const footer=node('footer',null,{class:'anchor-footer'});board.append(heading,body,footer);content.append(board);
  heading.append(node('h2',page.startsWith('profile:')?family.records('person').find(p=>p.id===visited)?.data.name||'Profiel':({home:'Vandaag',tasks:'Taken',shopping:'Boodschappen',calendar:'Planning',people:'Gezinsleden',krabbels:'Laatste krabbeltjes',settings:'Instellingen'})[page]));
  if(page==='tasks'){body.append(button('Taak toevoegen',()=>editor('task')),rows('task'));}
  if(page==='shopping'){
   const shops=node('select',null,{'aria-label':'Winkel'});shops.append(node('option','Alle winkels',{value:''}));for(const s of family.records('shop'))shops.append(node('option',s.data.name,{value:s.id}));shops.value=shopFilter;shops.onchange=()=>{shopFilter=shops.value;render();};
   body.append(shops,button('Boodschap toevoegen',()=>editor('shopping',null,{shopId:shopFilter||null})),button('Product bewaren',()=>editor('product')),button('Winkel toevoegen',()=>editor('shop')),button('Winkel bij mij zoeken',run(async()=>{const fix=await app.location.current();const found=app.nearbyShops(fix,family.records('shop'));if(found.length===1&&found[0].confident){shopFilter=found[0].shop.id;render();}else feedback.textContent=found.length?'Meerdere mogelijke winkels: kies de juiste winkel.':'Geen winkel met voldoende nauwkeurigheid gevonden.';})),rows('shopping',r=>!shopFilter||r.data.shopId===shopFilter));
   const catalogue=node('details');catalogue.append(node('summary','Producten en winkels'),rows('product'),rows('shop'));body.append(catalogue);
  }
  if(page==='people')body.append(button('Gezinslid toevoegen',()=>editor('person')),rows('person'));
  if(page==='krabbels'||page.startsWith('profile:')){
   body.append(button('Krabbeltje achterlaten',()=>editor('krabbel',null,page.startsWith('profile:')?{recipientId:visited}:{})),rows('krabbel',r=>!page.startsWith('profile:')||r.data.recipientId===visited));
  }
  if(page==='home'){body.append(node('h3','Taken voor vandaag'),rows('task',r=>!r.data.completed&&(!r.data.dueDate||r.data.dueDate<=new Date().toLocaleDateString('en-CA'))),node('h3','Krabbeltjes voor jou'),rows('krabbel',r=>r.data.recipientId===current));}
  if(page==='calendar'){
   body.append(button('Agenda verversen',run(()=>app.calendar())));const cal=v.calendar;
   body.append(node('p',!cal?'Laad de gedeelde agenda.':!cal.configured?'De gedeelde Google-agenda is nog niet gekoppeld.':`${cal.stale?'Opgeslagen agenda; verversen mislukt. ':'Bijgewerkt: '}${cal.fetchedAt||''}`));
   for(const e of cal?.events||[]){const article=node('article');article.append(node('strong',e.title),node('p',`${e.start.date||new Date(e.start.dateTime).toLocaleString('nl-NL')} – ${e.end.date||new Date(e.end.dateTime).toLocaleString('nl-NL')}`),node('p',e.location));body.append(article);}
  }
  if(page==='settings'){
   body.append(button('Synchroniseren',run(()=>sync.flush())),button('Meldingen voor mij aanzetten',run(async()=>{await family.notificationPreferences({enabled:true,krabbels:true,tasks:true});await app.notifications.enable(current,app.capabilities.vapidPublicKey);feedback.textContent=globalThis.SchattepatatjesDevice?'Android-toestemming aangevraagd. Achtergrondcontrole ongeveer elke 15 minuten; Android kan vertragen.':'Meldingen ingeschakeld.';})),button('Meldingen uitzetten',run(async()=>{await family.notificationPreferences({enabled:false});await app.notifications.disable();})),button('Vertrouwde apparaten',run(async()=>{const data=await transport.request('devices');const panel=node('section');for(const d of data.devices){const row=node('p',`${d.name}${d.revoked?' · ingetrokken':''}`);if(!d.revoked)row.append(button('Toegang intrekken',run(async()=>{await transport.request('revoke',{deviceId:d.id});await app.connect();})));panel.append(row);}formHost.replaceChildren(panel);})),button('Gegevens exporteren',run(async()=>{const data=await transport.request('export');const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=node('a','Download',{href:url,download:'schattepatatjes-export.json'});link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);})),button('Uitloggen en apparaat vergeten',run(()=>app.logout())));
   body.append(node('p','Een volledige back-up met foto’s wordt op de server gemaakt.'));
   body.append(button(showTrash?'Prullenbak sluiten':'Alle verwijderde inhoud',()=>{showTrash=!showTrash;showArchive=false;render();}));
   if(showTrash)for(const kind of ['task','shopping','product','shop','krabbel','decoration'])body.append(node('h3',LABELS[kind]),rows(kind));
   if(globalThis.SchattepatatjesUpdater)body.append(button('App-update controleren',()=>globalThis.SchattepatatjesUpdater.checkUpdates()));
  }
  if(['tasks','shopping','krabbels'].includes(page))footer.append(button(showTrash?'Actieve inhoud':'Prullenbak',()=>{showTrash=!showTrash;showArchive=false;render();}),button(showArchive?'Actieve inhoud':'Archief',()=>{showArchive=!showArchive;showTrash=false;render();}));
  if(design.ownerId===current){footer.append(button('Vormgeving aanpassen',()=>editor('appearance',null,design.appearance)),button(editMode?'Klaar met decoreren':'Decoreren',()=>{editMode=!editMode;render();}));if(editMode){footer.append(button('Sticker / Post-it / Polaroid',()=>editor('decoration')),node('p','Selecteer een decoratie; verplaats, draai en schaal met twee vingers.'));
   if(selected){const r=v.state?.records[`decoration:${selected}`];if(r)footer.append(button('Decoratie aanpassen',()=>editor('decoration',r)),button('Decoratie verwijderen',run(()=>family.trash('decoration',selected))));}
   if(lastUndo)footer.append(button('Laatste verplaatsing ongedaan maken',run(async()=>{const undo=lastUndo;lastUndo=null;await family.patch('decoration',undo.id,undo.data);})));}}
  decorations(design,{page:board,header:heading,content:body,footer});
  conflicts.replaceChildren();for(const q of v.outbox.filter(q=>['conflict','blocked'].includes(q.status))){const panel=node('article');panel.append(node('strong',q.status==='conflict'?'Twee wijzigingen aan hetzelfde onderdeel':'Wijziging kan niet worden opgeslagen'),node('p',`${q.operation.type}: ${q.error}`));const currentRecord=v.state?.records[`${q.operation.type.split('.')[0]}:${q.operation.entityId}`];panel.append(node('p','Jouw wijziging: '+JSON.stringify(q.operation.data)),node('p','Op de server: '+JSON.stringify(currentRecord?.data||null)),button('Serverversie behouden',run(()=>sync.resolve(q.operation.id,'discard'))),button('Mijn wijziging opnieuw toepassen',run(()=>sync.resolve(q.operation.id,'reapply'))));conflicts.append(panel);}
 }
 const unsubscribe=sync.subscribe(render);const openProfile=e=>{visited=e.detail;page=`profile:${visited}`;render();};window.addEventListener('family-profile',openProfile);render();return()=>{unsubscribe();window.removeEventListener('family-profile',openProfile);for(const dispose of disposers)dispose();for(const url of urls)URL.revokeObjectURL(url);};
}
