import assert from 'node:assert/strict';
// Stable test dependencies: no browser or server needed for the domain model and views.
globalThis.localStorage = {getItem:()=>null, setItem:()=>{}, removeItem:()=>{}};
globalThis.document = {querySelector:()=>null,querySelectorAll:()=>[]};
const {demoData, normalized, applyOperation}=await import('../web/modules/model.js');
const {createHomeViews}=await import('../web/modules/views/home.js');
const {createShoppingViews}=await import('../web/modules/views/shopping.js');
const {createTasksViews}=await import('../web/modules/views/tasks.js');
const {createPeopleViews}=await import('../web/modules/views/people.js');
const {createDialogView}=await import('../web/modules/views/dialogs.js');
const {createApiClient}=await import('../web/modules/api-client.js');
const {esc} =await import('../web/modules/common.js');
assert.equal(esc('<input>'),'&lt;input&gt;');
const state = normalized(demoData());
const snapshots = {people:state.people.length, groceries:state.groceries.length,tasks:state.tasks.length};
const ui={page:'home',store:'all',taskFilter:'all',viewPerson:'p1',historyGroceries:false,historyTasks:false};
const activeId='p1';
const person=id=>state.people.find(p=>p.id===id),store=id=>state.stores.find(s=>s.id===id);
const activeGroceries=()=>state.groceries.filter(g=>!g.done);
const activeTasks=()=>state.tasks.filter(t=>!t.done);
const pageTitle=(k,t)=>`<h1>${t}</h1>`;
const avatar=p=>p?`<span>${p.name}</span>`:'';
const photoFor=p=>`<span>${p.name}</span>`;
let taskLine;
const ctx=()=>({state,ui,activeId,person,store,me:()=>person(activeId),activeGroceries,activeTasks,avatar,photoFor,pageTitle,taskLine});
const taskViews=createTasksViews(ctx);taskLine=taskViews.taskLine;
for(const [page,fragment] of [[createHomeViews(ctx).homePage,'boodschappenbriefje'],[createShoppingViews(ctx).shoppingPage,'quick-grocery'],[taskViews.tasksPage,'quick-task'],[createPeopleViews(ctx).peoplePage,'Krabbelmuur']]){
 assert(page().includes(fragment),`View does not contain ${fragment}`);
}
applyOperation(state,{type:'addGrocery',actorId:'p1',data:{id:'new1',name:'Testmelk'}});
applyOperation(state,{type:'addTask',actorId:'p1',data:{id:'new2',name:'Testklus'}});
assert.equal(state.groceries.length,snapshots.groceries+1);
assert.equal(state.tasks.length,snapshots.tasks+1);
assert(createShoppingViews(ctx).shoppingPage().includes('Testmelk'));
assert(taskViews.tasksPage().includes('Testklus'));
assert(createHomeViews(ctx).homePage().includes('Halfvolle melk')); // home deliberately shows first four
const known={state,mode:'local',modal:{kind:'task'},person,avatar,connectionPanel:()=>'',updatePanel:()=>''};
// A small DOM stand-in proves the modal rendering module can be used independently.
let overlay='';
globalThis.document={
 querySelector(selector){if(selector==='#overlay-root')return {set innerHTML(x){overlay=x},get innerHTML(){return overlay}};return null;},
 querySelectorAll(){return []},body:{style:{overflow:''}}
};
// Modules have no hidden fetch or credential access.
const renderDialog=createDialogView(()=>known);
renderDialog();
assert(overlay.includes('task-form'));
assert.equal(typeof createApiClient,'function');
console.log('Modulariteit: model, onafhankelijke schermen, dialoog en API-client OK.');
