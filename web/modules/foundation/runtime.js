import {openDatabase} from './database.js';
import {createTransport} from './transport.js';
import {createSync} from './sync.js';
import {createFamily} from '../features/family.js';
import {createLocation,nearbyShops} from '../features/location.js';
import {createNotifications} from '../features/notifications.js';

export async function createFamilyRuntime({endpoint='/sp/api.php',databaseName='schattepatatjes-foundation-v2'}={}) {
const database=await openDatabase(databaseName);
const transport=createTransport(endpoint);
const sync=createSync({database,transport});
const family=createFamily(sync);const location=createLocation();const notifications=createNotifications(transport);
let capabilities={};
await sync.initialize();
const app={sync,family,location,notifications,transport,nearbyShops,
 get capabilities(){return capabilities;},
 stop(){location.stop();sync.stop();database.close();},
 async connect(){const b=await transport.request('bootstrap');capabilities=b.capabilities;await sync.setIdentity(b.deviceId?{deviceId:b.deviceId}:null);if(b.deviceId){await sync.flush();if(!sync.view().profileId){const person=family.records('person')[0];if(person)await sync.selectProfile(person.id);}}return b;},
 async login(password,name){const legacy=JSON.parse(localStorage.getItem('bijons-outbox-v1')||'[]');if(Array.isArray(legacy)&&legacy.length)throw Error('Er staan nog wijzigingen in de oude app. Synchroniseer of exporteer die eerst via de oude interface.');const b=await transport.request('login',{password,name});await sync.setIdentity({deviceId:b.deviceId});globalThis.SchattepatatjesDevice?.flushCookies();await sync.flush();if(!sync.view().profileId){const p=family.records('person')[0];if(p)await sync.selectProfile(p.id);}},
 async logout(){if(sync.view().busy)throw Error('Wacht tot synchronisatie is afgerond.');if(sync.view().outbox.length)throw Error('Synchroniseer of verwijder eerst de wachtende wijzigingen.');await notifications.disable();await transport.request('logout',{});await sync.clear();},
 async calendar(){const result=await transport.request('calendar');await database.edit(w=>{w.calendar=result;});await sync.initialize();return result;},
 async setup(data){const response=await fetch('/sp/api.php?action=setup',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw Error(result.message||'SETUP_FAILED');await this.login(data.password,'Eerste apparaat');}
};
return app;
}
