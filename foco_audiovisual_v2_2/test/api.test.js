const {spawn}=require('child_process');
const fs=require('fs'),path=require('path'),os=require('os');
const ROOT=path.join(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'foco-v22-'));
const port=18765,base=`http://127.0.0.1:${port}`;let child;
const ok=(x,m)=>{if(!x)throw Error(m)};
async function req(p,{method='GET',body,host=false}={}){const u=new URL(p,base);if(host)u.searchParams.set('pin','2468');const r=await fetch(u,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined}),j=await r.json().catch(()=>({}));if(!r.ok){const e=Error(`${p}: ${j.error||r.status}`);e.status=r.status;throw e}return j}
const action=(a,x={})=>req('/api/action',{method:'POST',host:true,body:{action:a,...x}});
async function ready(){for(let i=0;i<70;i++){try{if((await fetch(base+'/api/health')).ok)return}catch{}await new Promise(r=>setTimeout(r,100))}throw Error('server timeout')}
async function cfg(extra={}){return req('/api/config',{method:'POST',host:true,body:{showTitle:'FOCO',showSubtitle:'Test',playerAName:'Martín',playerBName:'Camila',mode:'classic',activePlayer:'A',duelRule:'fastest',timerSeconds:0,selectionMode:'random',categoryChoice:'off',avoidRecentCount:24,roundPlan:{easy:1,medium:0,hard:0,impossible:0},...extra}})}
async function hostState(){return req('/api/state?role=host&pin=2468')}
async function answerCorrect(p='A'){const s=await hostState();await req('/api/answer',{method:'POST',body:{player:p,answer:s.question.correctIndex}})}
async function finishCorrect(p='A'){await action('revealAllOptions');await action('openAnswers');await answerCorrect(p);await action('lockAnswers');await action('revealPlayerAnswer',{player:p});await action('revealCorrect');return hostState()}

(async()=>{try{
  child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...process.env,PORT:String(port),HOST_PIN:'2468',DATA_DIR:tmp},stdio:'ignore'});
  await ready();
  let h=await req('/api/health');ok(h.version==='2.2.0','health version');

  let s=await hostState();
  ok(s.questions.length>=32,'seed bank should contain at least 32 questions');
  ok(s.questions.filter(q=>q.alternate).length>=32,'seed questions need alternates');

  // Categoría en vivo al comenzar.
  await action('resetGame');await cfg({categoryChoice:'perDifficulty'});
  await action('prepareShow');s=await hostState();ok(s.phase==='intro','prepareShow -> intro');
  await action('startShow');s=await hostState();ok(s.phase==='category','first difficulty should request category');
  const cat=s.availableCategories[0];ok(!!cat,'category should be available');
  await req('/api/category',{method:'POST',body:{player:'A',category:cat}});
  s=await hostState();ok(s.phase==='categoryChosen'&&s.selectedCategory===cat,'player selects category');
  await action('confirmCategory');s=await hostState();ok(s.phase==='question'&&s.question.category===cat,'confirmed category selects matching question');

  // La categoría elegida persiste dentro del bloque de dificultad.
  await action('resetGame');await cfg({categoryChoice:'perDifficulty',roundPlan:{easy:2,medium:0,hard:0,impossible:0}});
  await action('prepareShow');await action('startShow');s=await hostState();
  const blockCat=s.availableCategories[0];ok(!!blockCat,'block category should exist');
  await req('/api/category',{method:'POST',body:{player:'A',category:blockCat}});await action('confirmCategory');
  s=await finishCorrect('A');await action('nextQuestion');s=await hostState();
  ok(s.phase==='question'&&s.question.category===blockCat,'category should persist inside same difficulty block');

  // Comodines solo en ventana legal.
  await action('resetGame');await cfg({categoryChoice:'off'});
  await action('prepareShow');await action('startShow');
  let blocked=false;try{await action('useLifeline',{player:'A',type:'hint'})}catch(e){blocked=e.status===409}ok(blocked,'lifeline before open must fail');
  await action('revealAllOptions');await action('openAnswers');
  await answerCorrect('A');
  blocked=false;try{await action('useLifeline',{player:'A',type:'hint'})}catch(e){blocked=e.status===409}ok(blocked,'lifeline after answer must fail');
  await action('lockAnswers');await action('revealCorrect');
  blocked=false;try{await action('useLifeline',{player:'A',type:'hint'})}catch(e){blocked=e.status===409}ok(blocked,'lifeline after result must fail');

  // Cambiar usa alternativa de la misma pregunta y no paga doble.
  await action('resetGame');await cfg({categoryChoice:'off'});
  await action('prepareShow');await action('startShow');s=await hostState();ok(s.phase==='question','question prepared');
  const qid=s.question.id;
  await action('revealAllOptions');await action('openAnswers');
  await action('useLifeline',{player:'A',type:'swap'});
  s=await hostState();ok(s.question.id===qid&&s.question.variant==='alternate','swap should use paired alternate');
  s=await finishCorrect('A');ok(s.winnings.A===250000,'alternate easy question awards once');
  await action('revealCorrect');s=await hostState();ok(s.winnings.A===250000,'reveal cannot double score');

  // Fin en dos fases.
  await action('nextQuestion');s=await hostState();ok(s.phase==='summary','after final round show summary');
  await action('showFinal');s=await hostState();ok(s.phase==='final','summary -> final');

  // Duelo: ambos aciertan; gana el más rápido con delta.
  await action('resetGame');await cfg({mode:'duel',duelRule:'fastest',categoryChoice:'off',roundPlan:{easy:0,medium:1,hard:0,impossible:0}});
  await action('prepareShow');await action('startShow');await action('revealAllOptions');await action('openAnswers');
  s=await hostState();const c=s.question.correctIndex;
  await req('/api/answer',{method:'POST',body:{player:'A',answer:c}});
  await new Promise(r=>setTimeout(r,45));
  await req('/api/answer',{method:'POST',body:{player:'B',answer:c}});
  await action('lockAnswers');await action('revealPlayerAnswer',{player:'A'});await action('revealPlayerAnswer',{player:'B'});await action('revealCorrect');
  s=await hostState();ok(s.duelResult?.winners?.[0]==='A','A should win fastest duel');ok(Number(s.duelResult?.deltaMs)>=25,'duel delta should be recorded');ok(s.winnings.A===500000&&s.winnings.B===0,'medium prize to fastest');

  // Timer auto-lock.
  await action('resetGame');await cfg({timerSeconds:3,categoryChoice:'off'});
  await action('prepareShow');await action('startShow');await action('revealAllOptions');await action('openAnswers');
  s=await hostState();ok(s.timerEndsAt!=null,'timer starts');
  await new Promise(r=>setTimeout(r,3150));s=await hostState();ok(s.phase==='locked'&&s.timerExpired===true,'timer auto locks');

  // History is persisted after a resolved round.
  const histFile=path.join(tmp,'history.json');ok(fs.existsSync(histFile),'history file exists');
  const hist=JSON.parse(fs.readFileSync(histFile,'utf8'));ok(hist.length>0,'history records used questions');

  console.log('FOCO V2.2 tests: PASS');
}catch(e){console.error('FOCO V2.2 tests: FAIL');console.error(e.stack||e);process.exitCode=1}
finally{child?.kill('SIGTERM');fs.rmSync(tmp,{recursive:true,force:true})}})();
