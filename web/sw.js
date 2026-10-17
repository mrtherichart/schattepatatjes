// This is served by /sp/sw.php, substituting a verified 40-character revision.
const VERSION='__WEB_REVISION__';
const CACHE='schattepatatjes-web-'+VERSION;
const PREFIX='/sp/static/revisions/'+VERSION+'/';
const SHELL=['/sp/',PREFIX+'index.html',PREFIX+'app.js',PREFIX+'styles.css',PREFIX+'styles/base.css',PREFIX+'styles/components.css',PREFIX+'styles/connection.css',PREFIX+'styles/dialogs.css',PREFIX+'styles/responsive.css',PREFIX+'modules/api-client.js',PREFIX+'modules/common.js',PREFIX+'modules/model.js',PREFIX+'modules/update-ui.js',PREFIX+'modules/views/dialogs.js',PREFIX+'modules/views/home.js',PREFIX+'modules/views/people.js',PREFIX+'modules/views/shopping.js',PREFIX+'modules/views/tasks.js',PREFIX+'assets/icon.svg',PREFIX+'assets/icon-192.png',PREFIX+'assets/icon-512.png',PREFIX+'manifest.webmanifest'];
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
