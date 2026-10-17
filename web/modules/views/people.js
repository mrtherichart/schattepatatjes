import {esc,attr,ico,today,formatDate,timeAgo} from '../common.js';

export function createPeopleViews(getContext) {
function peoplePage(){
 const {state,ui,person,activeTasks,avatar,pageTitle,taskLine} = getContext();const chosen=person(ui.viewPerson);if(!chosen){ui.viewPerson=state.people[0]?.id;return peoplePage();}
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
return {peoplePage};
}
