import {esc,attr,ico,today,formatDate,timeAgo} from '../common.js';

export function createTasksViews(getContext) {
function taskLine(t,history=false){
 const {person,avatar} = getContext();const p=person(t.assignee);return `<div class="item-row"><button class="tick ${t.done?'checked':''}" data-action="toggle-task" data-id="${attr(t.id)}" aria-label="${t.done?'Heropen':'Vink af'}: ${attr(t.name)}">${t.done?ico('check'):''}</button><div class="item-text"><strong class="${t.done?'done':''}">${esc(t.name)}</strong><span class="meta">${t.due?`<span class="due-pill ${t.due<today()&&!t.done?'overdue':''}">${ico('clock','sm')}${esc(formatDate(t.due))}${t.due<today()&&!t.done?' · voorbij':''}</span>`:'Wanneer het uitkomt'}${t.repeat&&t.repeat!=='none'?`<span>${ico('repeat','sm')} ${t.repeat==='daily'?'Elke dag':t.repeat==='weekly'?'Elke week':'Elke maand'}</span>`:''}</span></div>${!history?`<button class="assigned ${p?'':'none'}" data-action="assign-task" data-id="${attr(t.id)}" aria-label="${p?'Toegewezen aan '+attr(p.name):'Nog aan niemand toegewezen'}" title="${p?attr(p.name):'Nog niemand'}">${p?avatar(p,'tiny'):ico('plus')}</button>`:''}<button class="item-more" data-action="edit-task" data-id="${attr(t.id)}" aria-label="Bewerk ${attr(t.name)}">${ico('chevron')}</button></div>`;}
function taskFilterName(id){
 const {activeId,person} = getContext();return id==='all'?'Alle taken':id==='none'?'Voor iedereen':id===activeId?'Voor mij':`Voor ${person(id)?.name||'iemand'}`;}
function tasksPage(){
 const {state,ui,activeId,activeTasks,pageTitle,taskLine} = getContext();const tasks=activeTasks().filter(t=>ui.taskFilter==='all'||(ui.taskFilter==='none'?!t.assignee:t.assignee===ui.taskFilter));const sorted=tasks.slice().sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
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
return {taskLine, tasksPage};
}
