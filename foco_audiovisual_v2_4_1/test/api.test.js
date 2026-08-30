const {spawn}=require('child_process');
const fs=require('fs'),path=require('path'),os=require('os');
const ROOT=path.join(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'foco-v24-'));
const port=18765,base=`http://127.0.0.1:${port}`;let child,currentPin='0000';
const ok=(x,m)=>{if(!x)throw Error(m)};
async function req(p,{method='GET',body,host=false,pin=currentPin}={}){const u=new URL(p,base);if(host)u.searchParams.set('pin',pin);const r=await fetch(u,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined}),j=await r.json().catch(()=>({}));if(!r.ok){const e=Error(`${p}: ${j.error||r.status}`);e.status=r.status;throw e}return j}
const action=(a,x={})=>req('/api/action',{method:'POST',host:true,body:{action:a,...x}});
async function ready(){for(let i=0;i<70;i++){try{if((await fetch(base+'/api/health')).ok)return}catch{}await new Promise(r=>setTimeout(r,100))}throw Error('server timeout')}
async function cfg(extra={}){return req('/api/config',{method:'POST',host:true,body:{showTitle:'FOCO',showSubtitle:'Test',playerAName:'Martín',playerBName:'Camila',mode:'classic',activePlayer:'A',duelRule:'fastest',timerSeconds:0,selectionMode:'random',categoryChoice:'off',avoidRecentCount:0,classicLivesEnabled:true,classicStartingLives:3,classicZeroLivesMode:'end',duelPointsEnabled:true,duelPrizePot:10000000,pointMap:{easy:1,medium:2,hard:3,impossible:5},roundPlan:{easy:1,medium:0,hard:0,impossible:0},...extra}})}
async function hostState(pin=currentPin){return req('/api/state?role=host',{host:true,pin})}
async function prepare(){await action('prepareShow');await action('startShow');let s=await hostState();if(s.phase==='category'){const c=s.availableCategories[0];await req('/api/category',{method:'POST',body:{player:'A',category:c}});await action('confirmCategory')}return hostState()}
async function answer(p,index){return req('/api/answer',{method:'POST',body:{player:p,answer:index}})}
async function resolveClassic(correct=true){let s=await hostState();await action('revealAllOptions');await action('openAnswers');const idx=correct?s.question.correctIndex:(s.question.correctIndex+1)%4;await answer('A',idx);await action('lockAnswers');await action('revealPlayerAnswer',{player:'A'});await action('revealCorrect');return hostState()}
async function resolveDuel(winner='A'){let s=await hostState();await action('revealAllOptions');await action('openAnswers');const c=s.question.correctIndex,w=(c+1)%4;if(winner==='A'){await answer('A',c);await answer('B',w)}else if(winner==='B'){await answer('A',w);await answer('B',c)}else if(winner==='both'){await answer('A',c);await new Promise(r=>setTimeout(r,30));await answer('B',c)}else{await answer('A',w);await answer('B',(w+1)%4)}await action('lockAnswers');await action('revealPlayerAnswer',{player:'A'});await action('revealPlayerAnswer',{player:'B'});await action('revealCorrect');return hostState()}

(async()=>{try{
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...process.env,PORT:String(port),HOST_PIN:'',ACCESS_CODE:'',DATA_DIR:tmp},stdio:'ignore'});
  await ready();
  let h=await req('/api/health');ok(h.version==='2.4.1','health version');

  // PIN predeterminado 0000 y cambio persistente desde configuración.
  let s=await hostState();ok(s.security?.hostPinIsDefault===true,'fresh install should use default PIN 0000');
  let unauthorized=false;try{await hostState('2468')}catch(e){unauthorized=e.status===401}ok(unauthorized,'old V2 pin must not work on fresh install');
  let r=await req('/api/config',{method:'POST',host:true,body:{hostPin:'1357'}});ok(r.pinChanged===true,'PIN should be changeable in settings');
  unauthorized=false;try{await hostState('0000')}catch(e){unauthorized=e.status===401}ok(unauthorized,'old PIN must stop working after change');
  currentPin='1357';s=await hostState();ok(s.security?.hostPinIsDefault===false,'custom PIN should be reported without exposing it');

  // Pool: 144 preguntas, cada categoría 6/6/4/2.
  ok(s.questions.length>=144,'seed bank should contain at least 144 questions');
  const cats=Object.keys(s.questionInventory);ok(cats.length>=8,'expected eight categories');
  for(const cat of cats){const inv=s.questionInventory[cat];ok(inv.easy>=6&&inv.medium>=6&&inv.hard>=4&&inv.impossible>=2,`${cat} pool too small`)}
  ok(s.roundCapacity.easy>=6&&s.roundCapacity.medium>=6&&s.roundCapacity.hard>=4&&s.roundCapacity.impossible>=2,'round capacities should allow configuration margin');

  // Categoría en vivo sigue funcionando.
  await action('resetGame');await cfg({categoryChoice:'perDifficulty'});await action('prepareShow');s=await hostState();ok(s.phase==='intro','prepareShow -> intro');await action('startShow');s=await hostState();ok(s.phase==='category','first difficulty asks category');const cat=s.availableCategories[0];ok(!!cat,'category available');await req('/api/category',{method:'POST',body:{player:'A',category:cat}});await action('confirmCategory');s=await hostState();ok(s.question.category===cat,'selected category applied');

  // Cambiar pregunta toma otra de la misma pool, no repite ID.
  await action('resetGame');await cfg({categoryChoice:'off'});await prepare();s=await hostState();const oldId=s.question.id,oldCat=s.question.category,oldDiff=s.question.difficulty;await action('revealAllOptions');await action('openAnswers');await action('useLifeline',{player:'A',type:'swap'});s=await hostState();ok(s.question.id!==oldId,'swap should change question ID');ok(s.question.category===oldCat&&s.question.difficulty===oldDiff,'swap stays in same category/difficulty');ok(s.discardedQuestionIds.includes(oldId),'swapped question becomes discarded');

  // Clásico: dinero es escalón, no suma acumulativa.
  await action('resetGame');await cfg({roundPlan:{easy:2,medium:1,hard:0,impossible:0},classicLivesEnabled:true,classicStartingLives:3});await prepare();s=await resolveClassic(true);ok(s.winnings.A===250000,'first easy reaches 250k');await action('nextQuestion');s=await resolveClassic(true);ok(s.winnings.A===250000,'second easy must not add another 250k');await action('nextQuestion');s=await resolveClassic(true);ok(s.winnings.A===500000,'medium raises ladder to 500k');

  // Perder una vida y última vida/game over.
  await action('resetGame');await cfg({roundPlan:{easy:3,medium:0,hard:0,impossible:0},classicLivesEnabled:true,classicStartingLives:3,classicZeroLivesMode:'end'});await prepare();s=await resolveClassic(false);ok(s.lives.A===2&&s.lifeEvent?.after===2,'wrong answer loses one life');await action('nextQuestion');s=await resolveClassic(false);ok(s.lives.A===1&&s.lifeEvent?.lastLife===true,'second miss enters last life');await action('nextQuestion');s=await resolveClassic(false);ok(s.lives.A===0&&s.eliminated.A&&s.gameOver,'third miss eliminates player');await action('nextQuestion');s=await hostState();ok(s.phase==='summary','game over routes to summary instead of another round');

  // Continuar fuera de competencia preserva duración pero no entrega premio.
  await action('resetGame');await cfg({roundPlan:{easy:2,medium:0,hard:0,impossible:0},classicLivesEnabled:true,classicStartingLives:1,classicZeroLivesMode:'continue'});await prepare();s=await resolveClassic(false);ok(s.eliminated.A&&!s.gameOver,'continue mode eliminates without ending');await action('nextQuestion');s=await resolveClassic(true);ok(s.winnings.A===0,'eliminated contestant cannot win later prize');

  // Vidas desactivables.
  await action('resetGame');await cfg({roundPlan:{easy:1,medium:0,hard:0,impossible:0},classicLivesEnabled:false,classicStartingLives:1});await prepare();s=await resolveClassic(false);ok(s.lives.A===1&&!s.eliminated.A,'disabled lives must not decrement');

  // Duelo por puntos: 1+2+3 supera una Imposible de 5.
  await action('resetGame');await cfg({mode:'duel',categoryChoice:'off',duelPointsEnabled:true,duelPrizePot:10000000,pointMap:{easy:1,medium:2,hard:3,impossible:5},roundPlan:{easy:1,medium:1,hard:1,impossible:1}});await prepare();s=await resolveDuel('A');ok(s.points.A===1,'easy awards 1 point');await action('nextQuestion');s=await resolveDuel('A');ok(s.points.A===3,'medium adds 2');await action('nextQuestion');s=await resolveDuel('A');ok(s.points.A===6,'hard adds 3');await action('nextQuestion');s=await resolveDuel('B');ok(s.points.B===5,'impossible awards 5');ok(s.winnings.A===0&&s.winnings.B===0,'money is not accumulated when point mode is enabled');await action('nextQuestion');s=await hostState();ok(s.phase==='summary','duel reaches summary');ok(s.summary.outcome.winners[0]==='A','A should win 6-5 despite B winning impossible');ok(s.summary.prizePot===10000000,'duel exposes the single 10M pot');ok(s.summary.stats.A.prizeWon===10000000&&s.summary.stats.B.prizeWon===0,'point winner receives the entire duel pot');

  // Puntos personalizables y desactivables.
  await action('resetGame');await cfg({mode:'duel',duelPointsEnabled:true,duelPrizePot:12500000,pointMap:{easy:7,medium:8,hard:9,impossible:10},roundPlan:{easy:1,medium:0,hard:0,impossible:0}});await prepare();s=await resolveDuel('B');ok(s.points.B===7,'custom easy points must apply');await action('nextQuestion');s=await hostState();ok(s.summary.stats.B.prizeWon===12500000,'custom duel pot must be awarded to the point winner');
  await action('resetGame');await cfg({mode:'duel',duelPointsEnabled:false,roundPlan:{easy:0,medium:1,hard:0,impossible:0}});await prepare();s=await resolveDuel('A');ok(s.points.A===0&&s.winnings.A===500000,'disabling points restores prize scoring');

  // Duelo fastest conserva delta de tiempo.
  await action('resetGame');await cfg({mode:'duel',duelPointsEnabled:true,duelRule:'fastest',roundPlan:{easy:0,medium:1,hard:0,impossible:0}});await prepare();await action('revealAllOptions');await action('openAnswers');s=await hostState();const c=s.question.correctIndex;await answer('A',c);await new Promise(r=>setTimeout(r,45));await answer('B',c);await action('lockAnswers');await action('revealPlayerAnswer',{player:'A'});await action('revealPlayerAnswer',{player:'B'});await action('revealCorrect');s=await hostState();ok(s.duelResult.winners[0]==='A'&&Number(s.duelResult.deltaMs)>=25,'fastest duel records winner and delta');ok(s.points.A===2,'medium fastest winner gets configured points');

  // Comodines continúan protegidos fuera de la ventana legal.
  await action('resetGame');await cfg({mode:'classic',categoryChoice:'off'});await prepare();let blocked=false;try{await action('useLifeline',{player:'A',type:'hint'})}catch(e){blocked=e.status===409}ok(blocked,'lifeline before open must fail');await action('revealAllOptions');await action('openAnswers');s=await hostState();await answer('A',s.question.correctIndex);blocked=false;try{await action('useLifeline',{player:'A',type:'hint'})}catch(e){blocked=e.status===409}ok(blocked,'lifeline after answer must fail');

  // 50/50 publishes an animation event and removes exactly two wrong answers.
  await action('resetGame');await cfg({mode:'classic',categoryChoice:'off',timerSeconds:0});await prepare();await action('revealAllOptions');await action('openAnswers');await action('useLifeline',{player:'A',type:'fifty'});s=await hostState();ok(s.hiddenOptions.A.length===2,'50/50 should hide exactly two options');ok(s.lifelineEvent?.type==='fifty'&&s.lifelineEvent?.player==='A','50/50 should emit a broadcast motion event');ok(!s.hiddenOptions.A.includes(s.question.correctIndex),'50/50 must never hide the correct answer');

  // Timer auto-lock.
  await action('resetGame');await cfg({timerSeconds:3,categoryChoice:'off'});await prepare();await action('revealAllOptions');await action('openAnswers');s=await hostState();ok(s.timerEndsAt!=null,'timer starts');await new Promise(r=>setTimeout(r,3150));s=await hostState();ok(s.phase==='locked'&&s.timerExpired===true,'timer auto locks');

  // V2.4.1: assets críticos no pueden quedar mezclados entre deployments.
  let asset=await fetch(base+'/styles.css?v=2.4.1');ok((asset.headers.get('cache-control')||'').includes('no-store'),'styles must not be persistently browser-cached');
  const cssText=await asset.text();ok(cssText.includes('.broadcast-answer.player-picked::after')&&cssText.includes('background:var(--gold)'),'polygon selection border fix must be present');
  asset=await fetch(base+'/broadcast.html?v=2.4.1');const broadcastHtml=await asset.text();ok(broadcastHtml.includes('/styles.css?v=2.4.1')&&broadcastHtml.includes('/common.js?v=2.4.1'),'broadcast must request versioned CSS/JS');
  asset=await fetch(base+'/sw.js?v=2.4.1');const swText=await asset.text();ok(swText.includes("foco-v241-shell-1")&&swText.includes("caches.delete"),'service worker must use a new cache and delete old generations');

  console.log('FOCO V2.4.1 tests: PASS');
}catch(e){console.error('FOCO V2.4.1 tests: FAIL');console.error(e.stack||e);process.exitCode=1}
finally{child?.kill('SIGTERM');fs.rmSync(tmp,{recursive:true,force:true})}})();
