import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {openDatabase} from '../web/modules/foundation/database.js';
import {createSync} from '../web/modules/foundation/sync.js';
import {project,resolveQueue,nextSendable} from '../web/modules/foundation/model.js';
import {designFor,transformGesture} from '../web/modules/features/customization.js';
import {nearbyShops} from '../web/modules/features/location.js';
import {validateSnapshot} from '../web/modules/foundation/transport.js';
const base=()=>({schemaVersion:2,revision:1,household:'Test',records:{'person:p1':{id:'p1',kind:'person',version:1,deleted:false,data:{name:'One'}}}});
async function setup(name){const db=await openDatabase(name);await db.edit(w=>{w.identity={deviceId:'d1'};w.snapshot=base();w.profileId='p1';});return db;}
test('IndexedDB failures do not publish an uncommitted edit; reload retains queue and Blob',async()=>{
 const db=await setup('persistence');await assert.rejects(db.edit(w=>{w.outbox.push({bad:true});throw Error('forced');}));assert.equal((await db.read()).outbox.length,0);
 await db.edit(w=>{w.uploads.push({blob:new Blob(['abc'],{type:'image/png'})});w.outbox.push({id:'kept'});});db.close();const reopened=await openDatabase('persistence');assert.equal((await reopened.read()).outbox[0].id,'kept');assert.equal(await (await reopened.read()).uploads[0].blob.text(),'abc');reopened.close();
});
test('lost mutation response retries the identical frozen operation and commits once',async()=>{
 const db=await setup('retry');let state=base();let lost=true;const calls=[];const receipts=new Map();
 const transport={async request(route,op){if(route==='state')return structuredClone(state);calls.push(structuredClone(op));if(!receipts.has(op.id)){const r={operationId:op.id,version:1,revision:++state.revision};receipts.set(op.id,r);state.records['task:t1']={id:'t1',kind:'task',version:1,deleted:false,data:op.data};}if(lost){lost=false;throw Error('connection lost after commit');}return receipts.get(op.id);}};
 const sync=createSync({database:db,transport});await sync.initialize();await sync.dispatch('task.create','t1',{title:'Survives'},'p1');
 // Dispatch starts synchronization in the background; wait until its durable transition completes.
 for(let i=0;i<30&&(!calls.length||sync.view().busy);i++)await new Promise(r=>setTimeout(r,5));
 assert.equal((await db.read()).outbox.length,1);await sync.flush();assert.equal((await db.read()).outbox.length,0);assert.equal(state.revision,2);assert.deepEqual(calls[0],calls[1]);sync.stop();db.close();
});
test('independent records continue past a conflict and reapply gets fresh IDs',()=>{
 const q=(id,entity,version,status='queued')=>({status,frozen:null,operation:{id,type:'task.patch',entityId:entity,expectedVersion:version,data:{title:id}}});
 const w={snapshot:{records:{'task:a':{version:4}}},outbox:[q('1','a',1,'conflict'),q('2','a',2),q('3','b',1)]};
 assert.equal(nextSendable(w.outbox).operation.id,'3');let n=0;resolveQueue(w,'1','reapply',()=>`new-${++n}`);assert.deepEqual(w.outbox.slice(0,2).map(q=>q.operation.expectedVersion),[4,5]);assert.equal(w.outbox[0].operation.id,'new-1');
});
test('visited profile uses owner design and global pages use viewer design',()=>{
 const state=base();for(const [id,accent]of [['p1-app','#111111'],['p2-app','#222222'],['p2-profile','#333333']])state.records['appearance:'+id]={id,kind:'appearance',version:1,deleted:false,data:{accent}};
 assert.equal(designFor(state,'p1','shopping').appearance.accent,'#111111');assert.equal(designFor(state,'p1','profile:p2').appearance.accent,'#333333');
});
test('two-pointer transforms stay within bounds and GPS ambiguity is preserved',()=>{
 const t=transformGesture({x:.5,y:.5,scale:1,rotation:0},[{x:0,y:0},{x:10,y:0}],[{x:100,y:100},{x:120,y:100}],{width:100,height:100});assert.equal(t.x,1);assert.equal(t.y,1);assert.equal(t.scale,2);
 const shops=[{data:{latitude:52,longitude:5,radius:100}}];assert.equal(nearbyShops({latitude:52,longitude:5,accuracy:5,timestamp:100},shops,100)[0].confident,true);assert.equal(nearbyShops({latitude:52,longitude:5,accuracy:500,timestamp:100},shops,100).length,0);
});
test('projection preserves original and malformed snapshot is rejected',()=>{const s=base();project(s,[{operation:{type:'person.patch',entityId:'p1',data:{name:'Other'}}}]);assert.equal(s.records['person:p1'].data.name,'One');assert.throws(()=>validateSnapshot({schemaVersion:2,revision:'1',records:{}}));});
