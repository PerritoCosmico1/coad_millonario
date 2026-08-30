const CACHE='foco-v241-shell-1';
const SHELL=[
  '/?v=2.4.1',
  '/styles.css?v=2.4.1',
  '/common.js?v=2.4.1',
  '/broadcast.html?v=2.4.1',
  '/player.html?v=2.4.1',
  '/host.html?v=2.4.1',
  '/manifest.webmanifest?v=2.4.1'
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
    }).catch(()=>caches.match(req).then(hit=>hit||caches.match('/?v=2.4.1')))
  );
});
