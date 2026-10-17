import {createFamilyRuntime} from './runtime.js';
import {mountWorkbench} from '../features/workbench.js';
const app=await createFamilyRuntime();
const {sync,location}=app;
globalThis.schattepatatjesUpdateEvent=event=>{try{const update=typeof event==='string'?JSON.parse(event):event;const status=document.getElementById('foundation-status');if(status)status.textContent=update.message||update.status;if(update.status==='available'&&confirm(update.message+' Installeren?'))globalThis.SchattepatatjesUpdater.installUpdate();}catch(error){console.error(error);}};
const dispose=mountWorkbench(document.getElementById('app'),app);
try{await app.connect();}catch(e){document.getElementById('foundation-status').textContent=sync.view().identity?'Offline: opgeslagen gegevens beschikbaar.':e.message;}
const requested=new URLSearchParams(globalThis.location.search).get('profile');if(requested&&sync.view().state?.records[`person:${requested}`]){await sync.selectProfile(requested);globalThis.dispatchEvent(new CustomEvent('family-profile',{detail:requested}));}
const poll=()=>{if(!document.hidden&&sync.view().identity)sync.flush().catch(console.error);};
const online=()=>app.connect().catch(console.error);
const visibility=()=>{if(document.hidden)location.stop();else poll();};
window.addEventListener('online',online);document.addEventListener('visibilitychange',visibility);const timer=setInterval(poll,30000);
window.addEventListener('pagehide',()=>{location.stop();});
window.addEventListener('unload',()=>{clearInterval(timer);window.removeEventListener('online',online);document.removeEventListener('visibilitychange',visibility);dispose();app.stop();});
if(!globalThis.SchattepatatjesUpdater&&'serviceWorker' in navigator&&globalThis.location.protocol==='https:')navigator.serviceWorker.register('/sp/sw.php',{scope:'/sp/'}).catch(console.error);
