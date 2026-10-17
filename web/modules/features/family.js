import {list} from '../foundation/model.js';
export function createFamily(sync,uuid=()=>crypto.randomUUID()){
 const send=(kind,verb,id,data={})=>sync.dispatch(`${kind}.${verb}`,id,data,sync.view().profileId);
 return {
  records:(kind,options)=>list(sync.view().state,kind,options),
  create(kind,data){const id=uuid();return send(kind,'create',id,data).then(()=>id);},
  patch:(kind,id,data)=>send(kind,'patch',id,data),trash:(kind,id)=>send(kind,'trash',id),restore:(kind,id)=>send(kind,'restore',id),archive:(kind,id,archived=true)=>send(kind,'archive',id,{archived}),
  completeTask:(id,completed)=>send('task','patch',id,{completed}),checkShopping:(id,checked)=>send('shopping','patch',id,{checked}),
  pinKrabbel:(id,pinned)=>send('krabbel','patch',id,{pinned}),
  krabbelsFor:(profile)=>list(sync.view().state,'krabbel').filter(r=>r.data.recipientId===profile).sort((a,b)=>Number(b.data.pinned)-Number(a.data.pinned)||(b.createdAt||'').localeCompare(a.createdAt||'')),
  recentKrabbels:()=>list(sync.view().state,'krabbel').sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')),
  addProduct(productId){const product=sync.view().state.records[`product:${productId}`];if(!product||product.deleted)throw Error('NOT_FOUND');const {name,quantity,shopId,category,imageId}=product.data;return this.create('shopping',{name,quantity,shopId,category,imageId,checked:false,position:0});},
  async appearance(surface,data){const ownerId=sync.view().profileId;const id=`${ownerId}-${surface}`;const old=sync.view().state.records[`appearance:${id}`];return send('appearance',old?'patch':'create',id,{...data,ownerId,surface});},
  async notificationPreferences(data){const ownerId=sync.view().profileId;return send('notificationPreference',sync.view().state.records[`notificationPreference:${ownerId}`]?'patch':'create',ownerId,{...data,ownerId});}
 };
}
