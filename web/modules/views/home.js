import {esc,attr,ico,today,formatDate,timeAgo} from '../common.js';

export function createHomeViews(getContext) {
function shortTask(t,showPerson=true){
 const {person,avatar} = getContext();return `<div class="home-item"><span class="mini-dot"></span><span class="home-item-title">${esc(t.name)}</span>${t.due?`<small>${esc(formatDate(t.due))}</small>`:''}${showPerson&&t.assignee?avatar(person(t.assignee),'tiny'):''}</div>`;}
function homePage(){
 const {state,activeId,person,store,me,activeGroceries,activeTasks,avatar,pageTitle} = getContext();
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
return {homePage};
}
