// This is served by /sp/sw.php, substituting a verified 40-character revision.
const VERSION='__WEB_REVISION__';
const CACHE='schattepatatjes-web-'+VERSION;
const PREFIX='/sp/static/revisions/'+VERSION+'/';
const SHELL=['/sp/',PREFIX+'index.html',PREFIX+'app.js',PREFIX+'styles.css',PREFIX+'styles/base.css',PREFIX+'styles/components.css',PREFIX+'styles/connection.css',PREFIX+'styles/dialogs.css',PREFIX+'styles/responsive.css',PREFIX+'modules/api-client.js',PREFIX+'modules/common.js',PREFIX+'modules/model.js',PREFIX+'modules/update-ui.js',PREFIX+'modules/views/dialogs.js',PREFIX+'modules/views/home.js',PREFIX+'modules/views/people.js',PREFIX+'modules/views/shopping.js',PREFIX+'modules/views/tasks.js',PREFIX+'assets/icon.svg',PREFIX+'assets/icon-192.png',PREFIX+'assets/icon-512.png',PREFIX+'manifest.webmanifest',PREFIX+'modules/foundation/transport.js',PREFIX+'modules/foundation/database.js',PREFIX+'modules/foundation/model.js',PREFIX+'modules/foundation/sync.js',PREFIX+'modules/entry.js',PREFIX+'modules/foundation/runtime.js',PREFIX+'modules/foundation/bootstrap.js',PREFIX+'modules/features/customization.js',PREFIX+'modules/features/family.js',PREFIX+'modules/features/location.js',PREFIX+'modules/features/notifications.js',PREFIX+'modules/features/workbench.js',PREFIX+'styles/foundation.css'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('schattepatatjes-web-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  const url=new URL(request.url);
  if(url.pathname.startsWith('/sp/api.php')||url.pathname.startsWith('/sp/web-update.php')||url.pathname.startsWith('/sp/.web-state/'))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).catch(()=>caches.match('/sp/')));
    return;
  }
  if(!url.pathname.startsWith('/sp/static/revisions/'))return;
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
});

self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{};}catch{}
 const url=typeof data.url==='string'&&data.url.startsWith('/sp/?')?data.url:'/sp/';
 event.waitUntil(self.registration.showNotification(data.title||'Schattepatatjes',{body:data.body||'Nieuwe gezinsmelding',tag:data.tag||'family',data:{url},icon:'/sp/assets/icon-192.png'}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const url=new URL(event.notification.data?.url||'/sp/',self.location.origin);
 if(url.origin!==self.location.origin)return;
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{const client=clients.find(c=>new URL(c.url).pathname.startsWith('/sp/'));if(client){await client.navigate(url.href);return client.focus();}return self.clients.openWindow(url.href);}));
});
