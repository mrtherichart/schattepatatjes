/* Schattepatatjes — one interface for the Android WebView and the iPhone web app.
   No framework, no remote JavaScript, no tracking. */
const storage = (() => {try {const key='bijons-check';localStorage.setItem(key,'1');localStorage.removeItem(key);return localStorage;} catch {const mem=new Map();return {getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,String(v))};}})();
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const mkid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr = esc;
const ico = (name, cls = '') => `<svg aria-hidden="true" class="icon ${cls}"><use href="#ico-${name}"></use></svg>`;
const cleanImg = url => {
  const u = String(url || '').trim();
  if (/^https:\/\//i.test(u) && u.length < 1700) return u;
  if (/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(u) && u.length < 180000) return u;
  return '';
};
const first = name => [...String(name || '?').trim()][0]?.toUpperCase() || '?';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const addDays = (date, n) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };
const nextRepeat = (date, repeat) => {
  const d = new Date(`${date || today()}T12:00:00`);
  if (repeat === 'daily') d.setDate(d.getDate()+1);
  else if (repeat === 'weekly') d.setDate(d.getDate()+7);
  else if (repeat === 'monthly') d.setMonth(d.getMonth()+1);
  return d.toISOString().slice(0,10);
};
const formatDate = raw => {
  if (!raw) return '';
  if (raw === today()) return 'Vandaag';
  if (raw === addDays(today(),1)) return 'Morgen';
  if (raw === addDays(today(),-1)) return 'Gisteren';
  return new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short'}).format(new Date(`${raw}T12:00:00`));
};
const timeAgo = iso => {
  if (!iso) return '';
  const days = Math.floor((Date.now()-Date.parse(iso))/86400000);
  if (days <= 0) return 'vandaag';
  if (days === 1) return 'gisteren';
  return new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short'}).format(new Date(iso));
};
const THEMES = [{id:'sage',name:'Salie',color:'#74917b'},{id:'rose',name:'Rozen',color:'#bb8390'},{id:'denim',name:'Denim',color:'#6787a1'},{id:'honey',name:'Honing',color:'#b28d55'},{id:'lilac',name:'Sering',color:'#9b88a8'},{id:'pine',name:'Dennen',color:'#628a80'}];
const STORE_PRESETS = [{id:'supermarkt',name:'Supermarkt'},{id:'drogist',name:'Drogist'},{id:'bouwmarkt',name:'Bouwmarkt'},{id:'action',name:'Action'}];
function demoData(){
 const yesterday = addDays(today(),-1);
 return {
  revision:0, household:'Ons gezin', people:[
   {id:'p1',name:'Jij',theme:'denim',bio:'Altijd iets te maken, te bedenken of uit te proberen.',mood:'Lekker bezig',avatar:''},
   {id:'p2',name:'Partner',theme:'rose',bio:'Een eigen plekje, precies zoals ik het fijn vind.',mood:'Thuis is fijn',avatar:''}],
  stores: structuredClone(STORE_PRESETS),
  groceries:[
   {id:'g1',name:'Halfvolle melk',quantity:'2 pakken',storeId:'supermarkt',image:'',done:false,createdAt:new Date().toISOString()},
   {id:'g2',name:'Volkorenbrood',quantity:'1 brood',storeId:'supermarkt',image:'',done:false,createdAt:new Date().toISOString()},
   {id:'g3',name:'Schroeven 4 × 40 mm',quantity:'1 doos',storeId:'bouwmarkt',image:'',done:false,createdAt:new Date().toISOString()},
   {id:'g4',name:'Shampoo',quantity:'1 fles',storeId:'drogist',image:'',done:false,createdAt:new Date().toISOString()},
   {id:'g5',name:'Batterijen AA',quantity:'8 stuks',storeId:'action',image:'',done:false,createdAt:new Date().toISOString()}],
  tasks:[
   {id:'t1',name:'Auto naar de garage brengen',assignee:'p1',due:addDays(today(),1),repeat:'none',done:false,createdAt:new Date().toISOString()},
   {id:'t2',name:'Bibliotheekboeken terugbrengen',assignee:'p2',due:addDays(today(),3),repeat:'none',done:false,createdAt:new Date().toISOString()},
   {id:'t3',name:'Rookmelders controleren',assignee:'',due:'',repeat:'none',done:false,createdAt:new Date().toISOString()},
   {id:'t4',name:'Plank in de kast afmaken',assignee:'p1',due:'',repeat:'none',done:false,createdAt:new Date().toISOString()},
   {id:'t5',name:'Retourpakket wegbrengen',assignee:'',due:yesterday,repeat:'none',done:false,createdAt:new Date().toISOString()}],
  notes:[{id:'n1',to:'p1',from:'p2',message:'Vergeet niet ook even iets leuks te doen vandaag ♡',at:new Date().toISOString()},
         {id:'n2',to:'p2',from:'p1',message:'Er staat nog iets lekkers in de keuken!',at:new Date().toISOString()}],
  catalogue:[
   {id:'c1',name:'Halfvolle melk',quantity:'2 pakken',storeId:'supermarkt',image:'',used:8},
   {id:'c2',name:'Volkorenbrood',quantity:'1 brood',storeId:'supermarkt',image:'',used:6},
   {id:'c3',name:'Shampoo',quantity:'1 fles',storeId:'drogist',image:'',used:3},
   {id:'c4',name:'Batterijen AA',quantity:'8 stuks',storeId:'action',image:'',used:2}
  ]
 };
}
function normalized(input){
 const seed = demoData();
 const out = { ...seed, ...input };
 for (const k of ['people','stores','groceries','tasks','notes','catalogue']) if (!Array.isArray(out[k])) out[k] = [];
 return out;
}
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
function syncLabel(){const m=mode==='online'?{text:!navigator.onLine?'Wacht op internet':outbox.length?'Nog te synchroniseren':'Samen bijgewerkt',cls:navigator.onLine?'':'offline'}:mode==='locked'?{text:'Opnieuw aanmelden',cls:'offline'}:mode==='setup'?{text:'Lokaal voorbeeld',cls:'local'}:{text:'Alleen op dit toestel',cls:'local'};return `<span class="sync-status ${m.cls}"><span class="status-dot"></span>${m.text}</span>`;}
function render(){
 if(!person(activeId))activeId=state.people[0]?.id || '';
 $('#app').innerHTML=`<div class="app-shell">${logoHeader()}<div class="motto-strip"><span class="motto-text">${esc(state.household)} · ${new Intl.DateTimeFormat('nl-NL',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}</span><button class="quiet-link" data-action="settings" aria-label="Verbinding instellen">${syncLabel()}</button></div><main class="page" id="main">${ui.page==='home'?homePage():ui.page==='shopping'?shoppingPage():ui.page==='tasks'?tasksPage():peoplePage()}</main>${bottomNav()}</div>`;
}
function pageTitle(kicker,title,subtitle='',right=''){return `<div class="page-head"><div><div class="eyebrow">${kicker}</div><h1 class="page-title">${title}</h1>${subtitle?`<p class="page-subtitle">${subtitle}</p>`:''}</div>${right}</div>`;}
function shortTask(t,showPerson=true){return `<div class="home-item"><span class="mini-dot"></span><span class="home-item-title">${esc(t.name)}</span>${t.due?`<small>${esc(formatDate(t.due))}</small>`:''}${showPerson&&t.assignee?avatar(person(t.assignee),'tiny'):''}</div>`;}
function homePage(){
 const count=activeGroceries().length, tasks=activeTasks(), mine=tasks.filter(t=>t.assignee===activeId);
 const nearest=[...tasks].sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')).slice(0,3);
 const greeting = new Date().getHours()<11?'Goedemorgen':new Date().getHours()<17?'Goedemiddag':'Goedenavond';
 return `${pageTitle('WELKOM THUIS',`${greeting}, ${esc(me()?.name||'')}!`,'Een plekje voor de kleine dingen die samen het verschil maken.',ico('leaf','xl'))}
 <div class="intro-note"><span class="little-postmark">${ico('home','lg')}</span><p>Wat moeten we nog halen, wat ligt er klaar, en wat staat er voor jou op het lijstje?</p></div>
 <section class="panel basket-panel"><div class="panel-head"><h2>${ico('basket')} Ons boodschappenbriefje</h2><button class="mini-link" data-action="navigate" data-page="shopping">Open briefje ${ico('chevron','sm')}</button></div><div class="paper"><div class="paper-inset home-list">${activeGroceries().slice(0,4).map(g=>`<div class="home-item"><span class="mini-dot"></span><span class="home-item-title">${esc(g.name)}</span><span class="item-side">${esc(store(g.storeId)?.name||'Overal')}</span></div>`).join('')||'<div class="empty-text">Er hoeft niets gehaald te worden.</div>'}${count>4?`<div class="home-item" style="color:#a0896f">… en nog ${count-4} dingen</div>`:''}</div></div></section>
 <section class="panel task-panel"><div class="panel-head"><h2>${ico('checklist')} Nog even doen</h2><button class="mini-link" data-action="navigate" data-page="tasks">Alle taken ${ico('chevron','sm')}</button></div><div class="home-list">${nearest.map(t=>shortTask(t)).join('')||'<div class="empty-text">Heerlijk rustig, alle taken zijn klaar.</div>'}</div><div style="padding:0 13px 12px;font-size:11px;color:#8d9a83">${mine.length?`${mine.length} ${mine.length===1?'taak staat':'taken staan'} op jouw naam.`:'Er staat niets speciaal voor jou open.'}</div></section>
 <div class="section-divider">WIE ZIJN ER THUIS?</div><div class="home-profiles">${state.people.map(p=>`<button class="home-person" data-action="view-person" data-id="${attr(p.id)}">${avatar(p,'medium')}<span><strong>${esc(p.name)}</strong><small>${esc(p.mood||'Bekijk profiel')} · ${activeTasks().filter(t=>t.assignee===p.id).length} taken</small></span></button>`).join('')}</div>
 <section class="panel note-panel"><div class="panel-head"><h2>${ico('message')} Krabbeltjes</h2><button class="mini-link" data-action="view-person" data-id="${attr(activeId)}">Mijn hoekje ${ico('chevron','sm')}</button></div><div class="panel-body">${state.notes.slice(-2).reverse().map(n=>`<div class="scribble"><div class="scribble-head">Voor ${esc(person(n.to)?.name||'ons')}</div><p>${esc(n.message)}</p><div class="scribble-sign">${avatar(person(n.from),'tiny')} van ${esc(person(n.from)?.name||'iemand')}</div></div>`).join('')||'<p class="empty-text">Hier is nog ruimte voor een lief berichtje.</p>'}</div></section>`;
}
function groceryLine(g,history=false){return `<div class="item-row"> <button class="tick ${g.done?'checked':''}" data-action="toggle-grocery" data-id="${attr(g.id)}" aria-label="${g.done?'Zet terug op lijst':'Markeer als gekocht'}: ${attr(g.name)}">${g.done?ico('check'):''}</button>${photoFor(g)}<div class="item-text"><strong class="${g.done?'done':''}">${esc(g.name)}</strong><span class="meta">${g.quantity?esc(g.quantity):'1 stuk'}${g.storeId?`<span class="shop-tag">${esc(store(g.storeId)?.name||'Andere winkel')}</span>`:''}</span></div>${history?`<button class="item-more" title="Opnieuw op de lijst" data-action="again-grocery" data-id="${attr(g.id)}">${ico('undo')}</button>`:`<button class="item-more" title="Bewerken" aria-label="Bewerk ${attr(g.name)}" data-action="edit-grocery" data-id="${attr(g.id)}">${ico('chevron')}</button>`}</div>`;}
function catalogueCards(){const list=state.catalogue.slice().sort((a,b)=>(b.used||0)-(a.used||0)).slice(0,12);return `<div class="section-divider">VAAK GEKOCHT · MET ÉÉN TIK TERUG</div>${list.length?`<div class="catalogue-grid">${list.map(p=>`<button class="product-card" data-action="catalogue-add" data-id="${attr(p.id)}">${photoFor(p)}<strong>${esc(p.name)}</strong><small>${ico('plus','sm')} Voeg toe</small></button>`).join('')}</div>`:'<div class="notice">Producten die je toevoegt, onthouden we hier. Je kunt ze later in één tik opnieuw op het briefje zetten.</div>'}`;}
function shoppingPage(){
 const current=activeGroceries().filter(g=>ui.store==='all'||g.storeId===ui.store || (ui.store==='other'&&!g.storeId));
 const groupIds=ui.store==='all'?[...new Set(current.map(g=>g.storeId||'other'))]:[ui.store];
 const groups=groupIds.map(sid=>({id:sid,list:current.filter(g=>(g.storeId||'other')===sid)}));
 const history=state.groceries.filter(g=>g.done).slice().reverse();
 return `${pageTitle('OM MEE TE NEMEN','Het boodschappenbriefje',`${activeGroceries().length} dingen om te halen`,ico('basket','xl'))}
 <form class="add-inline" id="quick-grocery">${ico('plus')}<input name="name" maxlength="120" placeholder="Wat moeten we halen?" autocomplete="off" aria-label="Nieuwe boodschap" required><button type="submit">Zet erop ${ico('arrow','sm')}</button></form>
 <div class="under-input"><span>Alleen een naam is genoeg.</span><button class="quiet-link" data-action="new-grocery">+ Met details of foto</button></div>
 <div class="chip-row" aria-label="Winkels">${[{id:'all',name:'Alles'},...state.stores,{id:'other',name:'Zonder winkel'}].map(s=>`<button class="chip ${ui.store===s.id?'active':''}" data-action="filter-store" data-id="${attr(s.id)}">${s.id==='all'?ico('basket','sm'):s.id==='other'?ico('pin','sm'):ico('shop','sm')}${esc(s.name)}<em>${s.id==='all'?activeGroceries().length:activeGroceries().filter(g=>(g.storeId||'other')===s.id).length}</em></button>`).join('')}</div>
 ${current.length?groups.map(g=>`<div class="items-board" style="margin-top:10px"><div class="items-head">${ico('shop','sm')} ${esc(g.id==='other'?'Nog geen winkel':store(g.id)?.name||'Andere winkel')} <em>${g.list.length} ${g.list.length===1?'ding':'dingen'}</em></div>${g.list.map(x=>groceryLine(x)).join('')}</div>`).join(''):`<div class="empty-board">${ico('basket')}<strong>Dit briefje is leeg.</strong><p>Voeg iets toe, of kies hieronder een product dat je vaker haalt.</p></div>`}
 ${catalogueCards()}
 <div class="history-toggle"><button class="quiet-link" data-action="toggle-history-grocery">${ui.historyGroceries?'Verberg':'Bekijk'} gekochte dingen (${history.length})</button></div>
 ${ui.historyGroceries&&history.length?`<div class="items-board history-list">${history.slice(0,25).map(g=>groceryLine(g,true)).join('')}</div>`:''}`;
}
function taskLine(t,history=false){const p=person(t.assignee);return `<div class="item-row"><button class="tick ${t.done?'checked':''}" data-action="toggle-task" data-id="${attr(t.id)}" aria-label="${t.done?'Heropen':'Vink af'}: ${attr(t.name)}">${t.done?ico('check'):''}</button><div class="item-text"><strong class="${t.done?'done':''}">${esc(t.name)}</strong><span class="meta">${t.due?`<span class="due-pill ${t.due<today()&&!t.done?'overdue':''}">${ico('clock','sm')}${esc(formatDate(t.due))}${t.due<today()&&!t.done?' · voorbij':''}</span>`:'Wanneer het uitkomt'}${t.repeat&&t.repeat!=='none'?`<span>${ico('repeat','sm')} ${t.repeat==='daily'?'Elke dag':t.repeat==='weekly'?'Elke week':'Elke maand'}</span>`:''}</span></div>${!history?`<button class="assigned ${p?'':'none'}" data-action="assign-task" data-id="${attr(t.id)}" aria-label="${p?'Toegewezen aan '+attr(p.name):'Nog aan niemand toegewezen'}" title="${p?attr(p.name):'Nog niemand'}">${p?avatar(p,'tiny'):ico('plus')}</button>`:''}<button class="item-more" data-action="edit-task" data-id="${attr(t.id)}" aria-label="Bewerk ${attr(t.name)}">${ico('chevron')}</button></div>`;}
function taskFilterName(id){return id==='all'?'Alle taken':id==='none'?'Voor iedereen':id===activeId?'Voor mij':`Voor ${person(id)?.name||'iemand'}`;}
function tasksPage(){const tasks=activeTasks().filter(t=>ui.taskFilter==='all'||(ui.taskFilter==='none'?!t.assignee:t.assignee===ui.taskFilter));const sorted=tasks.slice().sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
 const history=state.tasks.filter(t=>t.done).slice().reverse();
 return `${pageTitle('KLEINE EN GROTE KLUSJES','Wat moet er gebeuren?',`${activeTasks().length} openstaande taken, voor ons allemaal.`,ico('checklist','xl'))}
 <form class="add-inline" id="quick-task">${ico('plus')}<input name="name" maxlength="140" placeholder="Even iets opschrijven…" autocomplete="off" aria-label="Nieuwe taak" required><button type="submit">Voeg toe ${ico('arrow','sm')}</button></form>
 <div class="under-input"><span>Geen deadline nodig.</span><button class="quiet-link" data-action="new-task">+ Met datum of persoon</button></div>
 <div class="chip-row">${[{id:'all',name:'Alles'},{id:activeId,name:'Voor mij'},...state.people.filter(p=>p.id!==activeId).map(p=>({id:p.id,name:p.name})),{id:'none',name:'Niet verdeeld'}].map(f=>`<button class="chip ${ui.taskFilter===f.id?'active':''}" data-action="filter-task" data-id="${attr(f.id)}">${esc(f.name)}<em>${activeTasks().filter(t=>f.id==='all'||(f.id==='none'?!t.assignee:t.assignee===f.id)).length}</em></button>`).join('')}</div>
 <div class="subhead"><h3>${esc(taskFilterName(ui.taskFilter))}</h3><span>${sorted.length} ${sorted.length===1?'taak':'taken'}</span></div>
 ${sorted.length?`<div class="items-board">${sorted.map(t=>taskLine(t)).join('')}</div>`:`<div class="empty-board">${ico('checklist')}<strong>Geen openstaande taken.</strong><p>Dat is mooi meegenomen.</p></div>`}
 <div class="notice">${ico('people','sm')} Iedereen ziet dezelfde taken. Tik op een profielfoto om een taak aan iemand toe te wijzen.</div>
 <div class="history-toggle"><button class="quiet-link" data-action="toggle-history-task">${ui.historyTasks?'Verberg':'Bekijk'} afgeronde taken (${history.length})</button></div>${ui.historyTasks&&history.length?`<div class="items-board history-list">${history.slice(0,25).map(t=>taskLine(t,true)).join('')}</div>`:''}`;
}
function peoplePage(){const chosen=person(ui.viewPerson);if(!chosen){ui.viewPerson=state.people[0]?.id;return peoplePage();}
 const myTasks=activeTasks().filter(t=>t.assignee===chosen.id);
 const myNotes=state.notes.filter(n=>n.to===chosen.id).slice().reverse();
 return `${pageTitle('DE MENSEN ACHTER DE LIJSTJES','Onze hoekjes','Iedereen z’n eigen sfeertje, alles blijft gezellig samen.',ico('people','xl'))}
 <div class="profile-grid">${state.people.map(p=>`<button class="profile-card theme-${attr(p.theme||'sage')}" data-action="view-person" data-id="${attr(p.id)}">${avatar(p,'medium')}<strong>${esc(p.name)}</strong><small>${esc(p.mood||'Mijn eigen plekje')}</small></button>`).join('')}</div>
 <div class="section-divider">HET PLEKJE VAN ${esc(chosen.name).toUpperCase()}</div>
 <section class="profile-hero theme-${attr(chosen.theme||'sage')}"><div class="row">${avatar(chosen,'big')}<div class="identity"><strong>${esc(chosen.name)}</strong><small>${esc(chosen.mood||'Een fijne dag')}</small></div></div><div class="bio">${esc(chosen.bio||'Nog niets over mezelf geschreven.')}</div><div class="hero-actions"><span style="color:var(--theme-deep);font-size:11px">${myTasks.length} openstaande ${myTasks.length===1?'taak':'taken'}</span><button class="gloss-btn secondary small" data-action="edit-person" data-id="${attr(chosen.id)}">${ico('edit','sm')} Dit plekje inrichten</button></div></section>
 <div class="wall-title"><span>Krabbelmuur</span><button class="gloss-btn secondary small" data-action="new-note" data-id="${attr(chosen.id)}">${ico('plus','sm')} Krabbeltje</button></div>
 ${myNotes.map(n=>`<article class="paper-note"><div class="note-content">${esc(n.message)}</div><footer><span class="note-sign">${avatar(person(n.from),'tiny')} ${esc(person(n.from)?.name||'Gezinslid')} · ${timeAgo(n.at)}</span><button class="icon-button" title="Krabbel verwijderen" aria-label="Verwijder krabbel" data-action="delete-note" data-id="${attr(n.id)}">${ico('trash','sm')}</button></footer></article>`).join('')||'<div class="empty-text">Hier mag iemand een eerste krabbeltje achterlaten.</div>'}
 <div class="wall-title"><span>Op het lijstje van ${esc(chosen.name)}</span><button class="gloss-btn secondary small" data-action="task-for-person" data-id="${attr(chosen.id)}">${ico('plus','sm')} Taak</button></div>
 <div class="items-board">${myTasks.slice(0,7).map(t=>taskLine(t)).join('')||'<div class="empty-text">Geen taken op dit moment.</div>'}</div>`;
}
function upsertCatalogue(s,g){
 const key=String(g.name||'').trim().toLocaleLowerCase('nl-NL');
 if(!key)return;
 let p=s.catalogue.find(p=>p.name.toLocaleLowerCase('nl-NL')===key);
 if(!p){p={id:mkid(),name:g.name,quantity:g.quantity||'',storeId:g.storeId||'',image:cleanImg(g.image),used:0};s.catalogue.push(p);}
 p.name=g.name;p.quantity=g.quantity||p.quantity||'';p.storeId=g.storeId||p.storeId||'';p.image=cleanImg(g.image)||p.image||'';p.used=(p.used||0)+1;
}
function applyOperation(s,op){
 const v=op.data||{};
 const now=op.at||new Date().toISOString();
 switch(op.type){
  case 'addGrocery': {
   const g={id:v.id,name:String(v.name||'').trim(),quantity:v.quantity||'',storeId:v.storeId||'',image:cleanImg(v.image),done:false,createdAt:now};
   if(g.name&&!s.groceries.some(x=>x.id===g.id)){s.groceries.push(g);upsertCatalogue(s,g);}break;
  }
  case 'editGrocery': {
   const g=s.groceries.find(x=>x.id===v.id);if(g){for(const k of ['name','quantity','storeId','image'])if(Object.hasOwn(v,k))g[k]=k==='image'?cleanImg(v[k]):v[k];upsertCatalogue(s,g);}break;
  }
  case 'toggleGrocery': {const g=s.groceries.find(x=>x.id===v.id);if(g){g.done=Boolean(v.done);g.doneAt=g.done?now:'';g.doneBy=g.done?op.actorId:'';}break;}
  case 'deleteGrocery': s.groceries=s.groceries.filter(x=>x.id!==v.id);break;
  case 'addTask': {
   const t={id:v.id,name:String(v.name||'').trim(),assignee:v.assignee||'',due:v.due||'',repeat:v.repeat||'none',done:false,createdAt:now};
   if(t.name&&!s.tasks.some(x=>x.id===t.id))s.tasks.push(t);break;
  }
  case 'editTask': {const t=s.tasks.find(x=>x.id===v.id);if(t)for(const k of ['name','assignee','due','repeat'])if(Object.hasOwn(v,k))t[k]=v[k];break;}
  case 'toggleTask': {
   const t=s.tasks.find(x=>x.id===v.id);if(!t)break;
   const wasDone=t.done;t.done=Boolean(v.done);t.doneAt=t.done?now:'';t.doneBy=t.done?op.actorId:'';
   if(!wasDone&&t.done&&t.repeat&&t.repeat!=='none'&&v.nextId&&!s.tasks.some(x=>x.id===v.nextId)){
    let due=nextRepeat(t.due||today(),t.repeat);
    for(let i=0;i<365 && due<today();i++)due=nextRepeat(due,t.repeat);
    s.tasks.push({id:v.nextId,name:t.name,assignee:t.assignee,due,repeat:t.repeat,done:false,createdAt:now});
   }break;
  }
  case 'deleteTask': s.tasks=s.tasks.filter(x=>x.id!==v.id);break;
  case 'addNote': if(v.message&&!s.notes.some(x=>x.id===v.id))s.notes.push({id:v.id,to:v.to,from:op.actorId,message:v.message,at:now});break;
  case 'deleteNote': s.notes=s.notes.filter(x=>x.id!==v.id);break;
  case 'editPerson': {const p=s.people.find(x=>x.id===v.id);if(p)for(const k of ['name','mood','bio','theme','avatar'])if(Object.hasOwn(v,k))p[k]=v[k];break;}
  case 'addStore': if(v.name&&!s.stores.some(x=>x.id===v.id))s.stores.push({id:v.id,name:v.name});break;
  case 'addPerson': if(v.name&&!s.people.some(x=>x.id===v.id))s.people.push({id:v.id,name:v.name,theme:'sage',mood:'Mijn eigen plekje',bio:'',avatar:''});break;
  case 'renameHouse': if(v.household)s.household=v.household;break;
 }
 return s;
}
function operation(type,data){
 const op={id:mkid(),type,data,actorId:activeId,at:new Date().toISOString()};
 applyOperation(state,op);
 if(mode==='online'||(mode==='locked'&&storage.getItem('bijons-was-online')==='1'))outbox.push(op);
 persist();render();
 if(mode==='online')flushQueue();
 return op;
}
async function api(action,options={}){
 const params = new URLSearchParams({action,...(options.query||{})});
 const res=await fetch(`api.php?${params}`,{method:options.body?'POST':'GET',headers:options.body?{'Content-Type':'application/json'}:undefined,credentials:'same-origin',body:options.body?JSON.stringify(options.body):undefined,cache:'no-store',signal:AbortSignal.timeout(10000)});
 let body;try{body=await res.json();}catch{throw Error('De server geeft geen geldig antwoord.');}
 if(!res.ok)throw Object.assign(Error(body.message||'Verbinding mislukt.'),{status:res.status,body});
 return body;
}
async function loadRemote(){
 try{
  const res=await api('state');
  if(res.needsSetup){mode='setup';render();return;}
  if(res.state){mode='online';storage.setItem('bijons-was-online','1');state=normalized(res.state);if(!outbox.length)persist();else outbox.forEach(op=>applyOperation(state,op));persist();render();if(outbox.length)flushQueue();}
 }catch(e){
  if(e.status===401){mode='locked';render();return;}
  if(mode==='online'){render();return;}
  mode='local';render();
 }
}
async function flushQueue(){
 if(flushBusy||mode!=='online'||!outbox.length)return;
 flushBusy=true;
 try{
  while(outbox.length){
   const op=outbox[0];
   const res=await api('mutate',{body:op});
   outbox.shift();
   state=normalized(res.state);
   outbox.forEach(p=>applyOperation(state,p));
   persist();render();
  }
 }catch(e){if(e.status===401){mode='locked';toast('Meld je opnieuw aan om te synchroniseren.');}else toast('Even geen verbinding. Je wijzigingen blijven bewaard.');}
 finally{flushBusy=false;render();}
}
async function refreshRemote(){
 if(mode!=='online'||flushBusy||outbox.length||!navigator.onLine)return;
 if(Date.now()-lastPollAt<5500)return;
 lastPollAt=Date.now();
 try{const res=await api('state',{query:{since:String(state.revision||0)}});if(res.state){state=normalized(res.state);persist();render();}}catch(e){if(e.status===401){mode='locked';render();}}
}
function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toastHandle);toastHandle=setTimeout(()=>el.classList.remove('show'),2700);}
function openModal(kind,data={}){modal={kind,...data};currentFileData='';renderOverlay();}
function closeModal(){modal=null;currentFileData='';renderOverlay();}
function renderOverlay(){
 const root=$('#overlay-root');
 if(!modal){root.innerHTML='';document.body.style.overflow='';return;}
 document.body.style.overflow='hidden';
 let title='',content='';
 if(modal.kind==='grocery'){
  const g=state.groceries.find(x=>x.id===modal.id)||null;
  title=g?'Boodschap aanpassen':'Op het briefje zetten';
  const pic=cleanImg(g?.image);
  content=`<form id="grocery-form"><div class="field"><label for="g-name">Wat moeten we halen?</label><input id="g-name" name="name" maxlength="120" required value="${attr(g?.name||modal.name||'')}" placeholder="Bijv. favoriete shampoo"></div>
  <div class="field-row"><div class="field"><label>Hoeveelheid</label><input name="quantity" maxlength="60" value="${attr(g?.quantity||'')}" placeholder="2 stuks"></div><div class="field"><label>Winkel</label><select name="storeId"><option value="">Maakt niet uit</option>${state.stores.map(s=>`<option value="${attr(s.id)}" ${(g?.storeId||'')===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div></div>
  <div class="field"><label>Of een nieuwe winkel toevoegen</label><input name="newStore" maxlength="60" placeholder="Bijv. HEMA"></div>
  <h3 class="form-heading">Een herkenbaar productfotootje</h3><div class="photo-tools"><span id="preview-image" class="product-thumbnail photo" style="width:79px;height:79px">${pic?`<img src="${attr(pic)}" alt="Voorbeeld">`:ico('image','lg')}</span><div><label class="photo-picker">${ico('camera','sm')} Kies een eigen foto<input type="file" id="grocery-photo-file" accept="image/*" hidden></label><p>We verkleinen de foto automatisch.<br>Je kunt ook hieronder een URL gebruiken.</p></div></div>
  <div class="field"><label>Afbeeldingsadres (https://)</label><input type="url" name="image" id="grocery-image-url" value="${attr(pic.startsWith('https:')?pic:'')}" placeholder="https://…/foto.jpg"></div>
  <div class="field"><label>Productfoto online zoeken</label><div class="inline-actions"><button type="button" class="gloss-btn secondary small" data-action="search-product">${ico('search','sm')} Zoek bij Open Food Facts</button><button type="button" class="gloss-btn secondary small" data-action="open-image-search">${ico('external','sm')} Web zoeken</button></div><div id="product-search-results" class="search-results"></div><div class="fineprint">Online zoeken werkt voor voedingsproducten; eigen foto of URL kan voor iedere winkel.</div></div>
  <div class="form-actions"><button type="submit" class="gloss-btn">${ico('check','sm')} ${g?'Bewaar wijzigingen':'Zet op lijst'}</button>${g?`<button type="button" class="gloss-btn danger" data-action="delete-grocery" data-id="${attr(g.id)}" aria-label="Verwijderen">${ico('trash','sm')}</button>`:''}</div></form>`;
 } else if(modal.kind==='task'){
  const t=state.tasks.find(x=>x.id===modal.id)||null;
  title=t?'Taak aanpassen':'Nieuwe taak';
  content=`<form id="task-form"><div class="field"><label>Wat moet er gebeuren?</label><input name="name" maxlength="140" required value="${attr(t?.name||'')}" placeholder="Bijv. lampje vervangen"></div>
  <div class="field"><label>Voor wie?</label><select name="assignee"><option value="">Voor iedereen</option>${state.people.map(p=>`<option value="${attr(p.id)}" ${(t?.assignee||modal.assignee||'')===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div>
  <div class="field-row"><div class="field"><label>Uiterlijk op (optioneel)</label><input name="due" type="date" value="${attr(t?.due||'')}"></div><div class="field"><label>Herhalen</label><select name="repeat"><option value="none">Niet herhalen</option>${[['daily','Elke dag'],['weekly','Elke week'],['monthly','Elke maand']].map(([v,n])=>`<option value="${v}" ${t?.repeat===v?'selected':''}>${n}</option>`).join('')}</select></div></div>
  <p class="fineprint">Iedereen kan de taak zien en afvinken, ook als je hem aan iemand toewijst.</p>
  <div class="form-actions"><button class="gloss-btn" type="submit">${ico('check','sm')} ${t?'Bewaren':'Toevoegen'}</button>${t?`<button type="button" class="gloss-btn danger" data-action="delete-task" data-id="${attr(t.id)}">${ico('trash','sm')}</button>`:''}</div></form>`;
 } else if(modal.kind==='assign'){
  const t=state.tasks.find(x=>x.id===modal.id);title='Wie pakt dit op?';
  content=`<p class="form-description">${esc(t?.name||'Deze taak')}</p><div class="search-results">${[{id:'',name:'Voor iedereen'},...state.people].map(p=>`<button class="search-result" data-action="assign-to" data-id="${attr(modal.id)}" data-person="${attr(p.id)}">${p.id?avatar(p,'tiny'):`<span class="avatar tiny" style="--tone:#aaa">${ico('people','sm')}</span>`}<strong>${esc(p.name)}</strong></button>`).join('')}</div>`;
 } else if(modal.kind==='profile'){
  const p=person(modal.id);title=`${p?.name||'Profiel'} · inrichten`;
  content=`<form id="profile-form"><div class="profile-edit-photo">${avatar(p,'big')}<label>${ico('camera','sm')} Andere profielfoto kiezen<input id="profile-photo-file" type="file" accept="image/*" hidden></label></div>
  <div class="field"><label>Naam</label><input name="name" value="${attr(p?.name)}" maxlength="35" required></div>
  <div class="field"><label>Kleine status</label><input name="mood" value="${attr(p?.mood)}" maxlength="60" placeholder="Wat houdt je bezig?"></div>
  <div class="field"><label>Over mij</label><textarea name="bio" maxlength="350" placeholder="Dit is mijn plekje">${esc(p?.bio)}</textarea></div>
  <h3 class="form-heading">Kies je eigen stijl</h3><div class="themes">${THEMES.map(t=>`<button class="theme-option theme-${t.id} ${p?.theme===t.id?'selected':''}" type="button" data-action="set-theme" data-theme="${t.id}"><span class="theme-sample"></span>${t.name}</button>`).join('')}</div><input type="hidden" name="theme" value="${attr(p?.theme||'sage')}">
  <div class="form-actions"><button class="gloss-btn" type="submit">${ico('check','sm')} Bewaar mijn hoekje</button></div></form>`;
 }else if(modal.kind==='note'){
  title=`Krabbelen bij ${person(modal.id)?.name||'iemand'}`;
  content=`<form id="note-form"><p class="form-description">Een lief bericht, een grapje of gewoon iets dat je kwijt wilt.</p><div class="field"><label>Jouw krabbeltje</label><textarea name="message" maxlength="500" required placeholder="Schrijf iets gezelligs…"></textarea></div><div class="form-actions"><button type="submit" class="gloss-btn">${ico('message','sm')} Plaats krabbeltje</button></div></form>`;
 }else if(modal.kind==='settings'){
  title='Ons hoekje instellen';
  content=`<h3 class="form-heading">Het gezin</h3><form id="house-form"><div class="field"><label>Naam van jullie plekje</label><input name="household" maxlength="55" required value="${attr(state.household)}"></div><button type="submit" class="gloss-btn secondary small">${ico('check','sm')} Naam bewaren</button></form>
  <h3 class="form-heading" style="margin-top:24px">Gezinsleden</h3><div class="inline-actions" style="margin-bottom:11px">${state.people.map(p=>`<span style="display:flex;gap:5px;align-items:center;font-size:12px;color:#88725c">${avatar(p,'tiny')}${esc(p.name)}</span>`).join('')}</div><form id="person-add-form" class="add-inline">${ico('plus')}<input name="name" maxlength="35" placeholder="Nieuw gezinslid" aria-label="Nieuw gezinslid" required><button type="submit">Toevoegen</button></form>
  <h3 class="form-heading" style="margin-top:24px">Samen synchroniseren</h3><div class="setup-card"><div class="status-row">${ico(mode==='online'?'cloud':'lock','sm')} ${mode==='online'?'Verbonden met de gezinsserver':mode==='locked'?'Gezinsserver gevonden — aanmelden':mode==='setup'?'Server is klaar voor de eerste installatie':'Lokaal op dit toestel'}</div>
  <p>${mode==='online'?'Alle gezinsleden gebruiken dezelfde boodschappen, taken en profielen. Bij tijdelijk geen bereik worden wijzigingen later verstuurd.':mode==='locked'?'Log opnieuw in met jullie gezamenlijke gezinswachtwoord.':mode==='setup'?'Deze website heeft een PHP-backend. Maak één keer een gezinsruimte aan om jullie telefoons te koppelen. De voorbeeldgegevens worden daarbij vervangen.':'Je kunt de app nu al proberen. Als je hem op je PHP-hosting plaatst, kun je één gedeelde gezinsruimte instellen.'}</p>
  ${mode==='setup'?`<form id="setup-form"><div class="field"><label>Naam van jullie plekje</label><input name="household" value="Ons gezin" maxlength="55" required></div><div class="field-row"><div class="field"><label>Jouw naam</label><input name="owner" maxlength="35" required placeholder="Jij"></div><div class="field"><label>Naam van je partner</label><input name="partner" maxlength="35" required placeholder="Partner"></div></div><div class="field"><label>Installatiesleutel (staat in config.php)</label><input type="text" name="setupKey" required autocomplete="off" placeholder="Eenmalige installatiesleutel"></div><div class="field"><label>Gezamenlijk wachtwoord (minimaal 10 tekens)</label><input type="password" name="password" minlength="10" required autocomplete="new-password"></div><button type="submit" class="gloss-btn full">Maak ons gezin aan</button></form>`:mode==='locked'?`<form id="login-form"><div class="field"><label>Gezinswachtwoord</label><input type="password" name="password" required autocomplete="current-password"></div><button class="gloss-btn full" type="submit">Aanmelden</button></form>`:mode==='online'?`<button class="gloss-btn secondary small" data-action="logout">Afmelden van dit toestel</button>`:`<button class="gloss-btn secondary small" data-action="retry-server">${ico('cloud','sm')} Zoek gezinsserver</button>`}</div>
  ${updatePanel()}
  <h3 class="form-heading" style="margin-top:23px">Even weten</h3><p class="fineprint">Dit is versie 0.4. Foto's blijven klein; er is geen reclame en geen externe analyse. Gegevens staan lokaal op je telefoon en, zodra verbonden, als JSON op je eigen server. Gebruik HTTPS bij publicatie. Maak ook regelmatig een back-up.</p>`;
 }
 $('#overlay-root').innerHTML=`<div class="modal-shade" data-action="shade-close"><section class="modal-window" role="dialog" aria-modal="true" aria-label="${attr(title)}"><div class="modal-titlebar"><h2>${esc(title)}</h2><button class="icon-button close-modal" aria-label="Sluiten" data-action="close-modal">${ico('close')}</button></div><div class="modal-inner">${content}</div></section></div>`;
 const autofocus=modal.kind==='task'||modal.kind==='grocery';
 if(autofocus)setTimeout(()=>$('.modal-inner input[name="name"]')?.focus({preventScroll:true}),90);
}
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
// Android updateverzoeken lopen alleen via de kleine native bridge.
const androidUpdateAvailable = Boolean(window.SchattepatatjesUpdater);
let updaterInfo = {status:'idle', version:'0.4'};
function updatePanel(){
  if(!androidUpdateAvailable) return '';
  const u=updaterInfo;
  const messages={idle:'Controleer wanneer je wilt of er een nieuwe Android-versie klaarstaat.',checking:'Even kijken of er iets nieuws is…',current:'Je hebt de nieuwste versie.',downloading:`Nieuwe versie ophalen… ${u.progress||0}%`,installing:'Android opent de installatie. Bevestig de update op je telefoon.',permission:'Sta Schattepatatjes toe om een update te installeren; kom daarna terug naar de app.',error:u.message||'Controleren lukte niet. Probeer het later opnieuw.'};
  const text=u.status==='available'?`Versie ${esc(u.version)} is beschikbaar. ${esc(u.notes||'')}`:messages[u.status]||messages.idle;
  return `<h3 class="form-heading" style="margin-top:24px">App bijwerken</h3><div class="setup-card" id="updater-card">
    <div class="status-row">${ico('info','sm')} Schattepatatjes voor Android · versie 0.4</div>
    <p id="updater-message" aria-live="polite">${text}</p>
    ${u.status==='available'?`<button class="gloss-btn" data-action="install-app-update">Download en installeer ${esc(u.version)}</button>`:''}
    ${u.status==='downloading'?`<progress style="width:100%" max="100" value="${Number(u.progress)||0}"></progress>`:''}
    <button class="gloss-btn secondary small" data-action="check-app-update" ${u.status==='checking'||u.status==='downloading'?'disabled':''}>${ico('cloud','sm')} Controleren op updates</button>
    <p class="fineprint" style="margin-top:11px">Je gegevens blijven staan. Android vraagt altijd zelf om toestemming voor de installatie.</p>
  </div>`;
}
window.schattepatatjesUpdateEvent=function(raw){
  try{
    const next=JSON.parse(raw);
    const previous=updaterInfo.status;
    updaterInfo=next;
    const card=document.querySelector('#updater-card');
    if(card){const tmp=document.createElement('div');tmp.innerHTML=updatePanel();card.replaceWith(tmp.querySelector('#updater-card'));}
    if(next.status==='available' && previous!=='available' && !card) toast(`Schattepatatjes ${next.version} is beschikbaar bij instellingen.`);
    if(next.status==='error' && previous==='downloading') toast(next.message||'Bijwerken is niet gelukt.');
  }catch(e){console.warn('Updatebericht kon niet worden gelezen',e);}
};

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
 if(a==='retry-server'){closeModal();await loadRemote();toast(mode==='online'?'Verbonden.':'Nog geen gezinsserver gevonden.');return;}
 if(a==='logout'){
  try{await api('logout',{body:{}});}catch{}
  mode='locked';closeModal();render();toast('Afgemeld van dit toestel.');return;
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
   if(result.state){state=normalized(result.state);mode='online';storage.setItem('bijons-was-online','1');outbox=[];activeId=state.people[0]?.id;storage.setItem('bijons-active-person',activeId);persist();ui.page='home';closeModal();render();toast('Jullie eigen plekje is aangemaakt.');}
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
window.addEventListener('online',()=>{if(mode==='online')flushQueue();refreshRemote();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){flushQueue();refreshRemote();}});
window.setInterval(refreshRemote,12000);
if(!window.SCHATTEPATATJES_NATIVE && 'serviceWorker' in navigator && location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
render();
loadRemote();

if(androidUpdateAvailable){try{const last=Number(localStorage.getItem('sp-last-update-check')||0);if(Date.now()-last>12*60*60*1000){localStorage.setItem('sp-last-update-check',String(Date.now()));setTimeout(()=>window.SchattepatatjesUpdater.checkUpdates(),1200);}}catch(e){}}
