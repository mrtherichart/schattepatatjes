import assert from 'node:assert/strict';
// Run the real entrypoint and click routes without a browser/network. This intentionally
// doesn't pretend to test native Android rendering or CSS layout.
let appMarkup='',overlayMarkup='';
const handlers={};
const storage=new Map();
globalThis.localStorage={
 getItem:k=>storage.get(k)||null,
 setItem:(k,v)=>storage.set(k,String(v)),
 removeItem:k=>storage.delete(k)
};
globalThis.window={SchattepatatjesUpdater:undefined,addEventListener(){},scrollTo(){},setInterval(){}};
Object.defineProperty(globalThis,'navigator',{value:{onLine:false},configurable:true});
globalThis.document={
 body:{style:{overflow:''}},hidden:false,
 addEventListener(name,fn){handlers[name]=fn;},
 querySelector(selector){
  if(selector==='#app')return {set innerHTML(x){appMarkup=x},get innerHTML(){return appMarkup}};
  if(selector==='#overlay-root')return {set innerHTML(x){overlayMarkup=x},get innerHTML(){return overlayMarkup}};
  if(selector==='#connection-trigger')return null;
  if(selector==='#connection-details')return null;
  return null;
 },querySelectorAll(){return []}
};
globalThis.fetch=async()=>{throw new Error('offline test')};
const oldSetInterval=globalThis.setInterval;
globalThis.setInterval=()=>0;
await import('../web/app.js');
assert(appMarkup.includes('Het boodschappenbriefje')||appMarkup.includes('Ons boodschappenbriefje'));
async function click(action,id){
 await handlers.click({target:{closest:()=>({dataset:{action,page:id,id}})}});
 await new Promise(resolve=>setTimeout(resolve,0));
}
await click('navigate','shopping');assert(appMarkup.includes('id="quick-grocery"'));
await click('navigate','tasks');assert(appMarkup.includes('id="quick-task"'));
await click('navigate','people');assert(appMarkup.includes('class="profile-grid"'));
await click('settings');assert(overlayMarkup.includes('Verbinding en synchronisatie'));
await click('close-modal');assert.equal(overlayMarkup,'');
globalThis.setInterval=oldSetInterval;
console.log('Controller smoke: app boot, shopping, tasks, profiles, settings OK.');
