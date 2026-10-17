export function createNotifications(transport){
 const native=globalThis.SchattepatatjesDevice;
 return {
  async enable(profileId,vapidPublicKey){
   if(native){native.enableNotifications(profileId);return {platform:'android',requested:true};}
   if(!('serviceWorker' in navigator)||!('PushManager' in globalThis)||!('Notification' in globalThis))throw Error('PUSH_UNSUPPORTED');
   if(!vapidPublicKey)throw Error('PUSH_NOT_CONFIGURED');
   if(await Notification.requestPermission()!=='granted')throw Error('NOTIFICATIONS_DENIED');
   const registration=await navigator.serviceWorker.ready;
   const key=Uint8Array.from(atob(vapidPublicKey.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(vapidPublicKey.length/4)*4,'=')),c=>c.charCodeAt(0));
   const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
   await transport.request('subscribe',{profileId,subscription:subscription.toJSON()});return {platform:'web',enabled:true};
  },
  async disable(){if(native)native.disableNotifications();else {await transport.request('unsubscribe',{});const reg=await navigator.serviceWorker.getRegistration('/sp/');await (await reg?.pushManager.getSubscription())?.unsubscribe();}},
  async list(profileId){const result=await transport.request('notifications');return result.notifications.filter(n=>n.recipientId===profileId);}
 };
}
