/** Foreground only. Coordinates never persist or leave this adapter. */
export function createLocation(geolocation=globalThis.navigator?.geolocation){
 let watchId=null;let latest=null;
 function normalize(p){latest={latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp};return latest;}
 function failure(e){return Object.assign(Error(({1:'LOCATION_DENIED',2:'LOCATION_UNAVAILABLE',3:'LOCATION_TIMEOUT'})[e.code]||'LOCATION_UNAVAILABLE'),{code:e.code});}
 function stop(){if(watchId!==null)geolocation.clearWatch(watchId);watchId=null;latest=null;}
 return {current:()=>new Promise((resolve,reject)=>{if(!geolocation)return reject(Error('LOCATION_UNSUPPORTED'));geolocation.getCurrentPosition(p=>resolve(normalize(p)),e=>reject(failure(e)),{enableHighAccuracy:true,timeout:15000,maximumAge:30000});}),
 watch(onLocation,onError){if(!geolocation)throw Error('LOCATION_UNSUPPORTED');stop();watchId=geolocation.watchPosition(p=>onLocation(normalize(p)),e=>onError(failure(e)),{enableHighAccuracy:true,timeout:15000,maximumAge:30000});return stop;},stop,last:()=>latest};
}
export function nearbyShops(fix,shops,now=Date.now()){
 if(!fix||now-fix.timestamp>60000||!Number.isFinite(fix.accuracy)||fix.accuracy>100)return [];
 const rad=n=>n*Math.PI/180;
 return shops.filter(s=>Number.isFinite(s.data.latitude)&&Number.isFinite(s.data.longitude)).map(s=>{
  const a=Math.sin(rad(s.data.latitude-fix.latitude)/2)**2+Math.cos(rad(fix.latitude))*Math.cos(rad(s.data.latitude))*Math.sin(rad(s.data.longitude-fix.longitude)/2)**2;
  const distance=6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));return {shop:s,distance,confident:distance+fix.accuracy<=s.data.radius};
 }).filter(s=>s.distance<=s.shop.data.radius+fix.accuracy).sort((a,b)=>a.distance-b.distance);
}
