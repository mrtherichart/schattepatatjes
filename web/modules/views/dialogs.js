import {$,esc,attr,ico,cleanImg,THEMES} from '../common.js';

// Modal markup only. Submission and editing are controlled by app.js.
export function createDialogView(getContext) {
function renderOverlay(){
 const {modal,state,mode,person,avatar,connectionPanel,updatePanel}=getContext();
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
  content=`<h3 class="form-heading">Verbinding en synchronisatie</h3><div id="connection-details">${connectionPanel()}</div>
  <h3 class="form-heading" style="margin-top:24px">Het gezin</h3><form id="house-form"><div class="field"><label>Naam van jullie plekje</label><input name="household" maxlength="55" required value="${attr(state.household)}"></div><button type="submit" class="gloss-btn secondary small">${ico('check','sm')} Naam bewaren</button></form>
  <h3 class="form-heading" style="margin-top:24px">Gezinsleden</h3><div class="inline-actions" style="margin-bottom:11px">${state.people.map(p=>`<span style="display:flex;gap:5px;align-items:center;font-size:12px;color:#88725c">${avatar(p,'tiny')}${esc(p.name)}</span>`).join('')}</div><form id="person-add-form" class="add-inline">${ico('plus')}<input name="name" maxlength="35" placeholder="Nieuw gezinslid" aria-label="Nieuw gezinslid" required><button type="submit">Toevoegen</button></form>
  <h3 class="form-heading" style="margin-top:24px">Gezinsserver instellen</h3><div class="setup-card"><div class="status-row">${ico(mode==='online'?'cloud':'lock','sm')} ${mode==='online'?'Verbonden met de gezinsserver':mode==='locked'?'Gezinsserver gevonden — aanmelden':mode==='setup'?'Server is klaar voor de eerste installatie':'Lokaal op dit toestel'}</div>
  <p>${mode==='online'?'Alle gezinsleden gebruiken dezelfde boodschappen, taken en profielen. Bij tijdelijk geen bereik worden wijzigingen later verstuurd.':mode==='locked'?'Log opnieuw in met jullie gezamenlijke gezinswachtwoord.':mode==='setup'?'Deze website heeft een PHP-backend. Maak één keer een gezinsruimte aan om jullie telefoons te koppelen. De voorbeeldgegevens worden daarbij vervangen.':'Je kunt de app nu al proberen. Als je hem op je PHP-hosting plaatst, kun je één gedeelde gezinsruimte instellen.'}</p>
  ${mode==='setup'?`<form id="setup-form"><div class="field"><label>Naam van jullie plekje</label><input name="household" value="Ons gezin" maxlength="55" required></div><div class="field-row"><div class="field"><label>Jouw naam</label><input name="owner" maxlength="35" required placeholder="Jij"></div><div class="field"><label>Naam van je partner</label><input name="partner" maxlength="35" required placeholder="Partner"></div></div><div class="field"><label>Installatiesleutel (staat in config.php)</label><input type="text" name="setupKey" required autocomplete="off" placeholder="Eenmalige installatiesleutel"></div><div class="field"><label>Gezamenlijk wachtwoord (minimaal 10 tekens)</label><input type="password" name="password" minlength="10" required autocomplete="new-password"></div><button type="submit" class="gloss-btn full">Maak ons gezin aan</button></form>`:mode==='locked'?`<form id="login-form"><div class="field"><label>Gezinswachtwoord</label><input type="password" name="password" required autocomplete="current-password"></div><button class="gloss-btn full" type="submit">Aanmelden</button></form>`:mode==='online'?`<button class="gloss-btn secondary small" data-action="logout">Afmelden van dit toestel</button>`:`<button class="gloss-btn secondary small" data-action="retry-server">${ico('cloud','sm')} Zoek gezinsserver</button>`}</div>
  ${updatePanel()}
  <h3 class="form-heading" style="margin-top:23px">Even weten</h3><p class="fineprint">Dit is versie 0.5.1. Foto's blijven klein; er is geen reclame en geen externe analyse. Gegevens staan lokaal op je telefoon en, zodra verbonden, als JSON op je eigen server. Gebruik HTTPS bij publicatie. Maak ook regelmatig een back-up.</p>`;
 }
 $('#overlay-root').innerHTML=`<div class="modal-shade" data-action="shade-close"><section class="modal-window" role="dialog" aria-modal="true" aria-label="${attr(title)}"><div class="modal-titlebar"><h2>${esc(title)}</h2><button class="icon-button close-modal" aria-label="Sluiten" data-action="close-modal">${ico('close')}</button></div><div class="modal-inner">${content}</div></section></div>`;
 const autofocus=modal.kind==='task'||modal.kind==='grocery';
 if(autofocus)setTimeout(()=>$('.modal-inner input[name="name"]')?.focus({preventScroll:true}),90);
}
return renderOverlay;
}
