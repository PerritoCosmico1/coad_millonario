const CACHE='app-shell-__APP_VERSION__';
const SHELL=[
  '/?v=__APP_VERSION__',
  '/styles.css?v=__APP_VERSION__',
  '/common.js?v=__APP_VERSION__',
  '/broadcast.html?v=__APP_VERSION__',
  '/player.html?v=__APP_VERSION__',
  '/host.html?v=__APP_VERSION__',
  '/manifest.webmanifest?v=__APP_VERSION__'
];
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).catch(()=>{}));
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
  ]));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||req.url.includes('/api/'))return;
  event.respondWith(
    fetch(req,{cache:'no-store'}).then(response=>{
      if(response&&response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});
      }
      return response;
    }).catch(()=>caches.match(req).then(hit=>hit||caches.match('/?v=__APP_VERSION__')))
  );
});
