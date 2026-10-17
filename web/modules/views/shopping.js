import {esc,attr,ico,today,formatDate,timeAgo} from '../common.js';

export function createShoppingViews(getContext) {
function groceryLine(g,history=false){
 const {store,photoFor} = getContext();return `<div class="item-row"> <button class="tick ${g.done?'checked':''}" data-action="toggle-grocery" data-id="${attr(g.id)}" aria-label="${g.done?'Zet terug op lijst':'Markeer als gekocht'}: ${attr(g.name)}">${g.done?ico('check'):''}</button>${photoFor(g)}<div class="item-text"><strong class="${g.done?'done':''}">${esc(g.name)}</strong><span class="meta">${g.quantity?esc(g.quantity):'1 stuk'}${g.storeId?`<span class="shop-tag">${esc(store(g.storeId)?.name||'Andere winkel')}</span>`:''}</span></div>${history?`<button class="item-more" title="Opnieuw op de lijst" data-action="again-grocery" data-id="${attr(g.id)}">${ico('undo')}</button>`:`<button class="item-more" title="Bewerken" aria-label="Bewerk ${attr(g.name)}" data-action="edit-grocery" data-id="${attr(g.id)}">${ico('chevron')}</button>`}</div>`;}
function catalogueCards(){
 const {state,photoFor} = getContext();const list=state.catalogue.slice().sort((a,b)=>(b.used||0)-(a.used||0)).slice(0,12);return `<div class="section-divider">VAAK GEKOCHT · MET ÉÉN TIK TERUG</div>${list.length?`<div class="catalogue-grid">${list.map(p=>`<button class="product-card" data-action="catalogue-add" data-id="${attr(p.id)}">${photoFor(p)}<strong>${esc(p.name)}</strong><small>${ico('plus','sm')} Voeg toe</small></button>`).join('')}</div>`:'<div class="notice">Producten die je toevoegt, onthouden we hier. Je kunt ze later in één tik opnieuw op het briefje zetten.</div>'}`;}
function shoppingPage(){
 const {state,ui,store,activeGroceries,pageTitle} = getContext();
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
return {shoppingPage};
}
