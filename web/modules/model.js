import {mkid,cleanImg,today,addDays,nextRepeat,STORE_PRESETS} from './common.js';

export function demoData(){
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
export function normalized(input){
 const seed = demoData();
 const out = { ...seed, ...input };
 for (const k of ['people','stores','groceries','tasks','notes','catalogue']) if (!Array.isArray(out[k])) out[k] = [];
 return out;
}

function upsertCatalogue(s,g){
 const key=String(g.name||'').trim().toLocaleLowerCase('nl-NL');
 if(!key)return;
 let p=s.catalogue.find(p=>p.name.toLocaleLowerCase('nl-NL')===key);
 if(!p){p={id:mkid(),name:g.name,quantity:g.quantity||'',storeId:g.storeId||'',image:cleanImg(g.image),used:0};s.catalogue.push(p);}
 p.name=g.name;p.quantity=g.quantity||p.quantity||'';p.storeId=g.storeId||p.storeId||'';p.image=cleanImg(g.image)||p.image||'';p.used=(p.used||0)+1;
}
export function applyOperation(s,op){
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
