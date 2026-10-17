/** Durable household workspace. One IDB transaction commits state and queue together. */
export function openDatabase(name='schattepatatjes-foundation-v2') {
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(name,1);
  request.onupgradeneeded=()=>request.result.createObjectStore('workspace');
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{
   const db=request.result; db.onversionchange=()=>db.close();
   function edit(fn){return new Promise((yes,no)=>{
    const tx=db.transaction('workspace','readwrite');const store=tx.objectStore('workspace');const get=store.get('family');let result;
    tx.onabort=()=>no(tx.error||Error('LOCAL_STORAGE_FAILED'));tx.onerror=()=>{};tx.oncomplete=()=>yes(result);
    get.onsuccess=()=>{try{const state=get.result||emptyWorkspace();if(state.schemaVersion!==2)throw Error('LOCAL_SCHEMA_UNSUPPORTED');result=fn(state);if(result?.then)throw Error('IDB_CALLBACK_MUST_BE_SYNCHRONOUS');store.put(state,'family');}catch(error){tx.abort();no(error);}};
   });}
   resolve({edit,read:()=>edit(s=>structuredClone(s)),close:()=>db.close()});
  };
 });
}
export function emptyWorkspace(){return {schemaVersion:2,snapshot:null,outbox:[],uploads:[],calendar:null,identity:null,profileId:null,sequence:0,lease:null};}
