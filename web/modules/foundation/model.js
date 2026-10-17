/** Pure optimistic projection; no network, DOM, randomness or clock. */
export function project(snapshot,outbox){
 if(!snapshot)return null;
 const next=structuredClone(snapshot);
 for(const q of outbox){
  if(['conflict','blocked'].includes(q.status))continue;
  const op=q.operation;const [kind,verb]=op.type.split('.');const key=`${kind}:${op.entityId}`;
  let r=next.records[key];
  if(verb==='create'){r={id:op.entityId,kind,version:0,authorId:op.actorId,data:{},deleted:false,archived:false};next.records[key]=r;}
  if(!r)continue;
  if(['create','patch'].includes(verb))r.data={...r.data,...op.data};
  if(verb==='trash')r.deleted=true;
  if(verb==='restore')r.deleted=false;
  if(verb==='archive')r.archived=op.data.archived;
  r.version++;r.pending=true;
 }
 return next;
}
export function list(state,kind,{trash=false,archive=false}={}){return Object.values(state?.records||{}).filter(r=>r.kind===kind&&r.deleted===trash&&(trash||Boolean(r.archived)===archive));}
export function nextSendable(outbox){
 const blocked=new Set();
 for(const q of outbox){const key=q.operation.type.split('.')[0]+':'+q.operation.entityId;if(['conflict','blocked'].includes(q.status)){blocked.add(key);continue;}if(!blocked.has(key))return q;}
 return null;
}
export function resolveQueue(work,id,choice,newId){
 const index=work.outbox.findIndex(q=>q.operation.id===id);if(index<0)throw Error('NOT_FOUND');
 const item=work.outbox[index];if(!['conflict','blocked'].includes(item.status))throw Error('NOT_RESOLVABLE');
 const kind=item.operation.type.split('.')[0];const entity=item.operation.entityId;
 const chain=work.outbox.filter(q=>q.operation.entityId===entity&&q.operation.type.startsWith(kind+'.'));
 if(chain.some(q=>q!==item&&q.frozen))throw Error('IN_FLIGHT_CHAIN');
 if(choice==='discard'){work.outbox=work.outbox.filter(q=>!chain.includes(q));return;}
 if(choice!=='reapply')throw Error('INVALID_CHOICE');
 let version=work.snapshot.records[`${kind}:${entity}`]?.version||0;
 for(const q of chain){q.operation={...q.operation,id:newId(),expectedVersion:version++};if(q.operation.type.endsWith('.create')&&q.operation.expectedVersion>0)q.operation.type=kind+'.patch';q.status='queued';q.frozen=null;delete q.error;}
}
