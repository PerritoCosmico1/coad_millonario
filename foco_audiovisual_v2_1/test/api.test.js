const {spawn}=require('child_process'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),Q=path.join(ROOT,'data/questions.json'),C=path.join(ROOT,'data/config.json');
const bq=fs.readFileSync(Q,'utf8'),bc=fs.readFileSync(C,'utf8'),port=18765,base=`http://127.0.0.1:${port}`;
let child;
const ok=(x,m)=>{if(!x)throw Error(m)};
async function req(p,{method='GET',body,host=false}={}){const u=new URL(p,base);if(host)u.searchParams.set('pin','2468');const r=await fetch(u,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined}),j=await r.json().catch(()=>({}));if(!r.ok)throw Error(`${p}: ${j.error||r.status}`);return j}
const action=(a,x={})=>req('/api/action',{method:'POST',host:true,body:{action:a,...x}});
async function ready(){for(let i=0;i<50;i++){try{if((await fetch(base+'/api/health')).ok)return}catch{}await new Promise(r=>setTimeout(r,100))}throw Error('server timeout')}
async function cfg(extra={}){return req('/api/config',{method:'POST',host:true,body:{showTitle:'FOCO',showSubtitle:'Test',playerAName:'A',playerBName:'B',mode:'classic',activePlayer:'A',duelRule:'fastest',timerSeconds:0,...extra}})}
async function answerCorrect(player='A'){const s=await req('/api/state?role=host&pin=2468');await req('/api/answer',{method:'POST',body:{player,answer:s.question.correctIndex}})}
async function playCorrect(index=0,player='A'){await action('showQuestion',{index});await action('revealAllOptions');await action('openAnswers');await answerCorrect(player);await action('lockAnswers');await action('revealCorrect');return req('/api/state?role=host&pin=2468')}

(async()=>{try{
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...process.env,PORT:String(port),HOST_PIN:'2468'},stdio:'ignore'});
  await ready();

  // Intro + premio fácil nuevo + protección doble.
  await action('resetGame'); await cfg();
  await action('prepareShow');
  let s=await req('/api/state?role=host&pin=2468');
  ok(s.phase==='intro','prepareShow should show intro');
  s=await playCorrect(0,'A');
  ok(s.winnings.A===250000,'easy prize should be 250k');
  await action('revealCorrect');
  s=await req('/api/state?role=host&pin=2468');
  ok(s.winnings.A===250000,'no double score');

  // Cambiar pregunta descarta la original y no permite cobrarla después.
  await action('resetGame'); await cfg();
  await action('showQuestion',{index:0});
  const original=(await req('/api/state?role=host&pin=2468')).question.id;
  await action('useLifeline',{player:'A',type:'swap'});
  s=await req('/api/state?role=host&pin=2468');
  ok(s.question.id!==original,'swap must choose another question');
  ok(s.usedQuestionIds.includes(original),'swapped question must be consumed');
  ok(s.discardedQuestionIds.includes(original),'swapped question must be marked discarded');
  await action('revealAllOptions'); await action('openAnswers'); await answerCorrect('A'); await action('lockAnswers'); await action('revealCorrect');
  s=await req('/api/state?role=host&pin=2468');
  ok(s.winnings.A===250000,'replacement easy question awards once');
  await action('showQuestion',{index:0});
  s=await req('/api/state?role=host&pin=2468');
  ok(s.roundAwardable===false,'discarded question is non-awardable');
  await action('revealAllOptions'); await action('openAnswers'); await answerCorrect('A'); await action('lockAnswers'); await action('revealCorrect');
  s=await req('/api/state?role=host&pin=2468');
  ok(s.winnings.A===250000,'discarded question cannot pay twice');

  // Duelo: ambos correctos, gana el más rápido y se informa delta.
  await action('resetGame'); await cfg({mode:'duel',duelRule:'fastest'});
  await action('showQuestion',{index:2}); await action('revealAllOptions'); await action('openAnswers');
  s=await req('/api/state?role=host&pin=2468'); const c=s.question.correctIndex;
  await req('/api/answer',{method:'POST',body:{player:'A',answer:c}});
  await new Promise(r=>setTimeout(r,35));
  await req('/api/answer',{method:'POST',body:{player:'B',answer:c}});
  await action('lockAnswers'); await action('revealPlayerAnswer',{player:'A'}); await action('revealPlayerAnswer',{player:'B'}); await action('revealCorrect');
  s=await req('/api/state?role=host&pin=2468');
  ok(s.winnings.A===500000&&s.winnings.B===0,'duel fastest gets medium prize');
  ok(s.duelResult?.winners?.[0]==='A','duel winner should be A');
  ok(s.duelResult?.bothCorrect===true,'both correct should be recorded');
  ok(Number(s.duelResult?.deltaMs)>=20,'duel delta should be visible');

  // Cuenta atrás: al llegar a cero bloquea.
  await action('resetGame'); await cfg({timerSeconds:3});
  await action('showQuestion',{index:0}); await action('revealAllOptions'); await action('openAnswers');
  s=await req('/api/state?role=host&pin=2468');
  ok(s.timerEndsAt!=null,'timer should start when answers open');
  await new Promise(r=>setTimeout(r,3150));
  s=await req('/api/state?role=host&pin=2468');
  ok(s.phase==='locked'&&s.timerExpired===true,'timer should auto-lock at zero');

  console.log('FOCO V2.1 tests: PASS');
}catch(e){console.error('FOCO V2.1 tests: FAIL');console.error(e.stack||e);process.exitCode=1}
finally{child?.kill('SIGTERM');fs.writeFileSync(Q,bq);fs.writeFileSync(C,bc)}})();
