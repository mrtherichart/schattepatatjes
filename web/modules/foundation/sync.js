import {project,nextSendable,resolveQueue} from './model.js';
import {validateSnapshot} from './transport.js';

export function createSync({database,transport,uuid=()=>crypto.randomUUID(),clock=()=>Date.now()}) {
 const listeners=new Set();const owner=uuid();let busy=false;let stopped=false;let retry=0;let timer=null;let lastError=null;let cached=null;
 const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('sp-foundation-v2'):null;
 async function publish(){cached=await database.read();for(const fn of listeners)fn(view());}
 function view(){return {state:project(cached?.snapshot,cached?.outbox||[]),outbox:cached?.outbox||[],uploads:cached?.uploads||[],identity:cached?.identity,profileId:cached?.profileId,calendar:cached?.calendar,error:lastError,busy};}
 function schedule(){clearTimeout(timer);if(!stopped)timer=setTimeout(()=>{flush().catch(report);},Math.min(30000,1000*2**Math.min(retry++,5))*(0.8+Math.random()*0.4));}
 function report(e){lastError=e.message;publish().catch(()=>{});}
 async function dispatch(type,entityId,data,actorId){
  const id=uuid();await database.edit(w=>{
   if(!w.identity||!w.snapshot)throw Error('DEVICE_REQUIRED');
   const state=project(w.snapshot,w.outbox);const key=type.split('.')[0]+':'+entityId;
   w.outbox.push({sequence:++w.sequence,status:'queued',frozen:null,operation:{id,type,entityId,actorId,expectedVersion:state.records[key]?.version||0,data:structuredClone(data)}});
  });await publish();channel?.postMessage('changed');flush().catch(report);return id;
 }
 async function stageImage(blob){
  if(!(blob instanceof Blob)||blob.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(blob.type))throw Error('INVALID_IMAGE');
  const localId='local-'+uuid();await database.edit(w=>{if(!w.identity)throw Error('DEVICE_REQUIRED');w.uploads.push({id:uuid(),localId,blob,status:'queued',mediaId:null});});await publish();return localId;
 }
 async function refresh(){
  const snapshot=validateSnapshot(await transport.request('state'));
  await database.edit(w=>{if(!w.snapshot||snapshot.revision>=w.snapshot.revision)w.snapshot=snapshot;});await publish();return snapshot;
 }
 async function flush(){
  if(stopped||busy)return;busy=true;
  try {
   const got=await database.edit(w=>{if(!w.identity)return false;if(w.lease&&w.lease.owner!==owner&&w.lease.until>clock())return false;w.lease={owner,until:clock()+120000};return true;});
   if(!got)return;
   for(let i=0;i<100&&!stopped;i++){
    await database.edit(w=>{if(w.lease?.owner!==owner)throw Error('LEASE_LOST');w.lease.until=clock()+120000;});
    const w=await database.read();
    const upload=w.uploads.find(u=>!u.mediaId&&u.status!=='blocked'&&w.outbox.some(q=>Object.values(q.operation.data).includes(u.localId)));
    if(upload){
     try {
      const form=new FormData();form.set('id',upload.id);form.set('file',upload.blob,'image');
      const result=await transport.request('upload',form);if(typeof result.mediaId!=='string')throw Error('INVALID_UPLOAD_RESPONSE');
      await database.edit(x=>{const item=x.uploads.find(u=>u.id===upload.id);if(item){item.mediaId=result.mediaId;item.status='uploaded';}});
     }catch(e){if(e.status>=400&&e.status<500&&![401,429].includes(e.status)){await database.edit(x=>{const item=x.uploads.find(u=>u.id===upload.id);if(item){item.status='blocked';item.error=e.message;}for(const q of x.outbox)if(Object.values(q.operation.data).includes(upload.localId)){q.status='blocked';q.error=e.message;}});}else throw e;}
     continue;
    }
    const q=nextSendable(w.outbox);if(!q)break;
    if(q.status==='acknowledged'){
     const snapshot=validateSnapshot(await transport.request('state'));
     if(snapshot.revision<q.receipt.revision)throw Error('STALE_SNAPSHOT');
     await database.edit(x=>{if(!x.snapshot||snapshot.revision>=x.snapshot.revision)x.snapshot=snapshot;x.outbox=x.outbox.filter(a=>a.operation.id!==q.operation.id);x.uploads=x.uploads.filter(u=>x.outbox.some(a=>Object.values(a.operation.data).includes(u.localId))||!u.mediaId);});continue;
    }
    const frozen=await database.edit(x=>{
     const item=x.outbox.find(a=>a.operation.id===q.operation.id);if(!item)return null;
     if(!item.frozen){const op=structuredClone(item.operation);for(const [key,value] of Object.entries(op.data)){if(typeof value==='string'&&value.startsWith('local-')){const media=x.uploads.find(u=>u.localId===value);if(!media?.mediaId)throw Error('MEDIA_NOT_READY');op.data[key]=media.mediaId;}}item.frozen=op;}
     item.status='sending';return item.frozen;
    });
    if(!frozen)continue;
    try {
     const receipt=await transport.request('mutate',frozen);
     if(receipt.operationId!==frozen.id||!Number.isSafeInteger(receipt.revision)||!Number.isSafeInteger(receipt.version))throw Error('INVALID_RECEIPT');
     await database.edit(x=>{const item=x.outbox.find(a=>a.operation.id===frozen.id);if(item){item.status='acknowledged';item.receipt=receipt;}});
    }catch(e){
     if(e.status===409||e.status===422||e.status===404||e.status===403){
      await database.edit(x=>{const item=x.outbox.find(a=>a.operation.id===frozen.id);if(item){item.status=e.code==='VERSION_CONFLICT'?'conflict':'blocked';item.error=e.message;}});await refresh();
     }else throw e;
    }
   }
   await refresh();retry=0;lastError=null;
  }catch(e){
   if(e.status===401){await database.edit(w=>{w.identity=null;});lastError='DEVICE_REQUIRED';}
   else {lastError=e.message;schedule();}
  }finally{
   busy=false;await database.edit(w=>{if(w.lease?.owner===owner)w.lease=null;});await publish();channel?.postMessage('synced');
  }
 }
 async function resolve(id,choice){await database.edit(w=>resolveQueue(w,id,choice,uuid));await publish();flush().catch(report);}
 async function setIdentity(identity){await database.edit(w=>{w.identity=identity;});await publish();}
 async function selectProfile(profileId){await database.edit(w=>{if(!w.snapshot?.records[`person:${profileId}`])throw Error('PROFILE_NOT_FOUND');w.profileId=profileId;});await publish();channel?.postMessage('changed');}
 async function clear(){if(busy)throw Error('SYNC_BUSY');await database.edit(w=>{if(w.outbox.length)throw Error('PENDING_CHANGES');Object.assign(w,{snapshot:null,identity:null,profileId:null,calendar:null,uploads:[],lease:null});});await publish();}
 function stop(){stopped=true;clearTimeout(timer);channel?.close();listeners.clear();}
 if(channel)channel.onmessage=()=>{publish().catch(report);};
 return {dispatch,stageImage,refresh,flush,resolve,setIdentity,selectProfile,clear,stop,view,initialize:publish,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
}
