import {list} from '../foundation/model.js';
export function designFor(state,viewerId,page){
 const profilePage=page.startsWith('profile:');const ownerId=profilePage?page.slice(8):viewerId;const surface=profilePage?'profile':'app';
 const appearance=state?.records[`appearance:${ownerId}-${surface}`];
 return {ownerId,appearance:appearance&&!appearance.deleted?appearance.data:{background:'#f5efdf',accent:'#356f91',font:'system',paper:'plain'},decorations:list(state,'decoration').filter(r=>r.data.ownerId===ownerId&&r.data.page===page).sort((a,b)=>a.data.z-b.data.z||a.id.localeCompare(b.id))};
}
export function transformGesture(start,initial,current,bounds){
 if(initial.length!==2||current.length!==2||bounds.width<=0||bounds.height<=0)throw Error('TWO_POINTERS_REQUIRED');
 const mid=p=>({x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2});const distance=p=>Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y);const angle=p=>Math.atan2(p[1].y-p[0].y,p[1].x-p[0].x);
 const a=mid(initial),b=mid(current);const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
 return {...start,x:clamp(start.x+(b.x-a.x)/bounds.width,0,1),y:clamp(start.y+(b.y-a.y)/bounds.height,0,1),scale:clamp(start.scale*distance(current)/Math.max(1,distance(initial)),0.2,5),rotation:((start.rotation+(angle(current)-angle(initial))*180/Math.PI+540)%360)-180};
}
/** Renderer-independent two-touch editing. Commit once at gesture end; undo is a new versioned action. */
export function attachEditor(element,{getPlacement,preview,commit,onError}){
 let selected=false;let pointers=new Map();let initial=null;let start=null;let latest=null;let previous=null;let saving=false;
 const down=e=>{if(!selected)return;if(pointers.size>=2)return;element.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){initial=[...pointers.values()];start=structuredClone(getPlacement());latest=null;}};
 const move=e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(initial&&pointers.size===2&&!saving){const bounds=element.parentElement.getBoundingClientRect();latest=transformGesture(start,initial,[...pointers.values()],bounds);preview(latest);}};
 const finish=async e=>{pointers.delete(e.pointerId);if(!initial)return;initial=null;if(latest){saving=true;const target=latest;previous=start;latest=null;try{await commit(target);}catch(error){preview(start);onError(error);}finally{saving=false;}}};
 const cancel=()=>{pointers.clear();initial=null;latest=null;if(start)preview(start);};
 element.addEventListener('pointerdown',down);element.addEventListener('pointermove',move);element.addEventListener('pointerup',finish);element.addEventListener('pointercancel',cancel);
 return {select(value){selected=value;element.style.touchAction=value?'none':'';if(!value)cancel();},async undo(){if(previous&&!saving){await commit(previous);preview(previous);previous=null;}},dispose(){element.removeEventListener('pointerdown',down);element.removeEventListener('pointermove',move);element.removeEventListener('pointerup',finish);element.removeEventListener('pointercancel',cancel);}};
}
