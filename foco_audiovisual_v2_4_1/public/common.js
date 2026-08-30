const letters=['A','B','C','D'];
const difficultyLabels={easy:'Fácil',medium:'Medio',hard:'Difícil',impossible:'Imposible'};
let serverClockOffset=0;

function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function money(v){return new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(v||0))}
function formatMs(ms,{tenths=true}={}){if(ms==null||!Number.isFinite(Number(ms)))return'—';const n=Math.max(0,Number(ms));if(n<1000)return`${Math.round(n)} ms`;return tenths?`${(n/1000).toFixed(n<10000?2:1)} s`:`${Math.ceil(n/1000)} s`}
function syncClock(s){if(s&&Number.isFinite(Number(s.serverTime)))serverClockOffset=Number(s.serverTime)-Date.now()}
function serverNow(){return Date.now()+serverClockOffset}
function timerRemaining(s){if(!s||!s.config||!s.config.timerSeconds)return null;if(s.timerEndsAt)return Math.max(0,Number(s.timerEndsAt)-serverNow());if(s.timerRemainingMs!=null)return Math.max(0,Number(s.timerRemainingMs));return Number(s.config.timerSeconds)*1000}
function timerLabel(s){const ms=timerRemaining(s);if(ms==null)return'∞';return `${Math.ceil(ms/1000)}`}

function accessCode(){const q=new URLSearchParams(location.search).get('code');if(q){localStorage.setItem('focoAccessCode',q);return q}return localStorage.getItem('focoAccessCode')||''}
function hostPin(){return sessionStorage.getItem('focoHostPin')||''}
function qs(obj={}){const p=new URLSearchParams(obj),c=accessCode();if(c)p.set('code',c);return p.toString()}

const API={
 async state(role='display',player=''){const p={role};if(player)p.player=player;if(role==='host'&&hostPin())p.pin=hostPin();const r=await fetch(`/api/state?${qs(p)}`,{cache:'no-store'}),j=await r.json();if(!r.ok)throw new Error(j.error||'Error');syncClock(j);return j},
 async post(path,body={},host=false){const p={};if(host&&hostPin())p.pin=hostPin();const q=qs(p),u=path+(path.includes('?')?'&':'?')+q;const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Error');if(j?.serverTime)syncClock(j);return j},
 stream(role,player,onState,onError){const p={role};if(player)p.player=player;if(role==='host'&&hostPin())p.pin=hostPin();const es=new EventSource(`/api/stream?${qs(p)}`);es.addEventListener('state',e=>{try{const s=JSON.parse(e.data);syncClock(s);onState(s)}catch(err){onError?.(err)}});es.onerror=e=>onError?.(e);return es}
};

let toastTimer;
function toast(m){let e=document.getElementById('toast');if(!e){e=document.createElement('div');e.id='toast';e.className='toast';document.body.appendChild(e)}e.textContent=m;e.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('show'),2200)}
if('serviceWorker'in navigator){
  let reloadingForSW=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(reloadingForSW)return;
    reloadingForSW=true;
    location.reload();
  });
  navigator.serviceWorker.register('/sw.js?v=2.4.1',{updateViaCache:'none'})
    .then(reg=>reg.update().catch(()=>{}))
    .catch(()=>{});
}
