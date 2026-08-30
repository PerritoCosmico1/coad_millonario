const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.env.PORT || 8765);
const HOST_PIN = String(process.env.HOST_PIN || '2468');
const ACCESS_CODE = String(process.env.ACCESS_CODE || '').trim();
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : (process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(ROOT, 'data'));
const QFILE = path.join(DATA, 'questions.json');
const CFILE = path.join(DATA, 'config.json');
const HFILE = path.join(DATA, 'history.json');
const SEED_QFILE = path.join(ROOT, 'seed', 'questions.json');

fs.mkdirSync(DATA, { recursive: true });

const PRIZES = { easy: 250000, medium: 500000, hard: 1000000, impossible: 10000000 };
const DIFFS = ['easy', 'medium', 'hard', 'impossible'];
const clone = x => JSON.parse(JSON.stringify(x));

const defaultConfig = {
  showTitle: 'FOCO AUDIOVISUAL',
  showSubtitle: 'Concurso de conocimientos audiovisuales',
  playerAName: 'Concursante A',
  playerBName: 'Concursante B',
  mode: 'classic',
  activePlayer: 'A',
  duelRule: 'fastest',
  timerSeconds: 30,
  selectionMode: 'random',
  categoryChoice: 'perDifficulty',
  avoidRecentCount: 24,
  roundPlan: { easy: 3, medium: 3, hard: 2, impossible: 1 },
  prizeMap: PRIZES
};

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return clone(fallback); }
}
function save(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

function normDiff(v) {
  v = String(v || '').toLowerCase();
  if (DIFFS.includes(v)) return v;
  if (v.startsWith('f') || v.startsWith('e')) return 'easy';
  if (v.startsWith('m')) return 'medium';
  if (v.startsWith('d') || v.startsWith('h')) return 'hard';
  if (v.startsWith('i')) return 'impossible';
  return 'medium';
}
function cleanTimer(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(3, Math.min(300, Math.round(n)));
}
function cleanRoundPlan(v) {
  const out = {};
  for (const d of DIFFS) {
    const n = Number(v?.[d]);
    out[d] = Number.isFinite(n) ? Math.max(0, Math.min(20, Math.round(n))) : defaultConfig.roundPlan[d];
  }
  if (!DIFFS.some(d => out[d] > 0)) out.easy = 1;
  return out;
}
function cleanAlternate(a) {
  if (!a || !String(a.text || '').trim()) return null;
  const options = Array.from({length:4}, (_,i) => String((a.options || [])[i] || '').slice(0,220));
  if (!options.every(Boolean)) return null;
  return {
    text: String(a.text).slice(0,700),
    options,
    correctIndex: Math.max(0, Math.min(3, Number(a.correctIndex) || 0)),
    hint: String(a.hint || '').slice(0,400)
  };
}
function cleanQ(q, i = 0) {
  return {
    id: String(q.id || `q_${Date.now()}_${i}`).slice(0,80),
    category: String(q.category || 'General').trim().slice(0,60) || 'General',
    difficulty: normDiff(q.difficulty),
    text: String(q.text || '').trim().slice(0,700),
    options: Array.from({length:4}, (_,j) => String((q.options || [])[j] || '').trim().slice(0,220)),
    correctIndex: Math.max(0, Math.min(3, Number(q.correctIndex) || 0)),
    hint: String(q.hint || '').trim().slice(0,400),
    alternate: cleanAlternate(q.alternate)
  };
}
function cleanConfig(raw = {}) {
  return {
    ...defaultConfig,
    ...raw,
    showTitle: String(raw.showTitle || defaultConfig.showTitle).slice(0,80),
    showSubtitle: String(raw.showSubtitle || defaultConfig.showSubtitle).slice(0,140),
    playerAName: String(raw.playerAName || defaultConfig.playerAName).slice(0,60),
    playerBName: String(raw.playerBName || defaultConfig.playerBName).slice(0,60),
    mode: raw.mode === 'duel' ? 'duel' : 'classic',
    activePlayer: raw.activePlayer === 'B' ? 'B' : 'A',
    duelRule: raw.duelRule === 'all' ? 'all' : 'fastest',
    timerSeconds: cleanTimer(raw.timerSeconds ?? defaultConfig.timerSeconds),
    selectionMode: raw.selectionMode === 'manual' ? 'manual' : 'random',
    categoryChoice: ['off','start','perDifficulty'].includes(raw.categoryChoice) ? raw.categoryChoice : 'perDifficulty',
    avoidRecentCount: Math.max(0, Math.min(200, Math.round(Number(raw.avoidRecentCount ?? 24) || 0))),
    roundPlan: cleanRoundPlan(raw.roundPlan),
    prizeMap: PRIZES
  };
}

let seedQuestions = readJSON(SEED_QFILE, []).map(cleanQ).filter(q => q.text && q.options.every(Boolean));
let storedQuestions = readJSON(QFILE, []).map(cleanQ).filter(q => q.text && q.options.every(Boolean));
const legacyAlternates = {
  q1:{text:'¿Qué control determina cuánto tiempo queda expuesto cada fotograma?',options:['ISO','Velocidad de obturación','Ganancia','Balance de blancos'],correctIndex:1,hint:'Suele expresarse como 1/50, 1/100, etc.'},
  q2:{text:'¿Qué accesorio ayuda a reducir ruido de viento fuerte en un micrófono de pértiga?',options:['Pop filter','Blimp o zeppelin','DI box','Patchbay'],correctIndex:1,hint:'Rodea físicamente al micrófono.'},
  q3:{text:'¿Qué tipo de corte conecta dos planos por una similitud visual o de movimiento?',options:['Match cut','L-cut','J-cut','Fade'],correctIndex:0,hint:'La continuidad nace de una correspondencia entre ambos planos.'},
  q4:{text:'Si pasas de ISO 400 a ISO 800 manteniendo lo demás, ¿cuántos pasos aumentas la sensibilidad nominal?',options:['Medio paso','Un paso','Dos pasos','Cuatro pasos'],correctIndex:1,hint:'Duplicar ISO equivale aproximadamente a un paso.'},
  q5:{text:'¿Qué es un proxy en postproducción?',options:['Una copia ligera para facilitar edición','Una LUT','Un archivo de audio','Una máscara'],correctIndex:0,hint:'Se reconecta después con el material de mayor calidad.'},
  q6:{text:'¿Qué diferencia esencial existe entre dolly-in y zoom-in?',options:['El dolly mueve físicamente la cámara; el zoom cambia la focal','Son idénticos','El zoom mueve al actor','El dolly cambia ISO'],correctIndex:0,hint:'Uno cambia la posición de cámara y el otro la óptica.'},
  q7:{text:'En una señal 4:2:0, respecto de 4:4:4, ¿qué información se reduce principalmente?',options:['Frecuencia de cuadro','Resolución de crominancia','Profundidad de bits','Rango dinámico'],correctIndex:1,hint:'El submuestreo afecta principalmente la información de color.'}
};
for (const q of storedQuestions) if (!q.alternate && legacyAlternates[q.id]) q.alternate = legacyAlternates[q.id];
if (!storedQuestions.length) storedQuestions = clone(seedQuestions);
const ids = new Set(storedQuestions.map(q => q.id));
for (const q of seedQuestions) if (!ids.has(q.id)) storedQuestions.push(clone(q));
let questions = storedQuestions;
save(QFILE, questions);

let config = cleanConfig(readJSON(CFILE, defaultConfig));
save(CFILE, config);

let recentHistory = readJSON(HFILE, []);
if (!Array.isArray(recentHistory)) recentHistory = [];
recentHistory = recentHistory.filter(x => x && typeof x.id === 'string').slice(-200);
save(HFILE, recentHistory);

const freshLifelines = () => ({
  A: { fifty: true, hint: true, swap: true },
  B: { fifty: true, hint: true, swap: true }
});
function buildRoundSequence() {
  const out = [];
  for (const d of DIFFS) for (let i=0;i<config.roundPlan[d];i++) out.push(d);
  return out;
}
function freshState() {
  return {
    revision: 1,
    phase: 'idle',
    previousPhase: 'idle',
    roundIndex: -1,
    roundSequence: buildRoundSequence(),
    pendingDifficulty: null,
    selectedCategory: null,
    lockedCategory: null,
    currentQuestionId: null,
    questionVariant: 'main',
    revealedOptions: 0,
    answers: { A: null, B: null },
    answerTimes: { A: null, B: null },
    answerWindowOpenedAt: null,
    timerEndsAt: null,
    timerRemainingMs: null,
    timerExpired: false,
    revealedPlayerAnswers: { A: false, B: false },
    correctRevealed: false,
    scoreApplied: false,
    roundAwardable: true,
    roundRecorded: false,
    winnings: { A: 0, B: 0 },
    lifelines: freshLifelines(),
    hiddenOptions: { A: [], B: [] },
    hintVisible: { A: false, B: false },
    sessionQuestionIds: [],
    discardedQuestionIds: [],
    roundHistory: [],
    duelResult: null,
    message: 'Esperando para comenzar'
  };
}
let state = freshState();
let timerHandle = null;
const clients = new Set();

function baseQuestion() { return questions.find(q => q.id === state.currentQuestionId) || null; }
function currentQuestion() {
  const q = baseQuestion();
  if (!q) return null;
  if (state.questionVariant === 'alternate' && q.alternate) {
    return { ...q, ...q.alternate, id: q.id, category: q.category, difficulty: q.difficulty, variant: 'alternate', alternate: q.alternate };
  }
  return { ...q, variant: 'main' };
}
function currentPrize() {
  const q = currentQuestion();
  return q ? PRIZES[q.difficulty] : 0;
}
const player = v => v === 'B' ? 'B' : 'A';

function stopTimer(freeze = true) {
  if (timerHandle) { clearTimeout(timerHandle); timerHandle = null; }
  if (freeze && state.timerEndsAt) state.timerRemainingMs = Math.max(0, state.timerEndsAt - Date.now());
  state.timerEndsAt = null;
}
function resetQuestionRuntime({preserveAwardable = false} = {}) {
  stopTimer(false);
  state.revealedOptions = 0;
  state.answers = { A: null, B: null };
  state.answerTimes = { A: null, B: null };
  state.answerWindowOpenedAt = null;
  state.timerEndsAt = null;
  state.timerRemainingMs = config.timerSeconds > 0 ? config.timerSeconds * 1000 : null;
  state.timerExpired = false;
  state.revealedPlayerAnswers = { A: false, B: false };
  state.correctRevealed = false;
  state.scoreApplied = false;
  state.roundRecorded = false;
  state.duelResult = null;
  state.hiddenOptions = { A: [], B: [] };
  state.hintVisible = { A: false, B: false };
  if (!preserveAwardable) state.roundAwardable = true;
}
function startTimer() {
  stopTimer(false);
  state.answerWindowOpenedAt = Date.now();
  state.timerExpired = false;
  if (config.timerSeconds <= 0) {
    state.timerEndsAt = null;
    state.timerRemainingMs = null;
    return;
  }
  state.timerRemainingMs = config.timerSeconds * 1000;
  state.timerEndsAt = state.answerWindowOpenedAt + state.timerRemainingMs;
  timerHandle = setTimeout(() => {
    if (state.phase !== 'open') return;
    state.phase = 'locked';
    state.timerExpired = true;
    state.timerRemainingMs = 0;
    state.timerEndsAt = null;
    state.message = 'Tiempo agotado';
    timerHandle = null;
    bump('Tiempo agotado');
  }, state.timerRemainingMs + 20);
}
function responseMs(p) {
  if (state.answerTimes[p] == null || state.answerWindowOpenedAt == null) return null;
  return Math.max(0, state.answerTimes[p] - state.answerWindowOpenedAt);
}
function nameOf(p) { return p === 'A' ? config.playerAName : config.playerBName; }

function authorized(req, url, host = false) {
  const code = String(req.headers['x-access-code'] || url.searchParams.get('code') || '');
  if (ACCESS_CODE && code !== ACCESS_CODE) return false;
  if (!host) return true;
  return String(req.headers['x-host-pin'] || url.searchParams.get('pin') || '') === HOST_PIN;
}
function json(res, status, body) {
  const d = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type':'application/json; charset=utf-8',
    'Content-Length':Buffer.byteLength(d),
    'Cache-Control':'no-store',
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Headers':'Content-Type, X-Host-Pin, X-Access-Code'
  });
  res.end(d);
}
function readBody(req) {
  return new Promise((resolve,reject) => {
    let b='';
    req.on('data', c => { b += c; if (b.length > 2e6) req.destroy(); });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch(e){ reject(e); } });
    req.on('error', reject);
  });
}
function broadcast() {
  for (const c of [...clients]) {
    try { c.res.write(`event: state\ndata: ${JSON.stringify(publicState(c.role, c.player))}\n\n`); }
    catch { clients.delete(c); }
  }
}
function bump(msg) {
  state.revision++;
  if (msg) state.message = msg;
  broadcast();
}

function recentIds() {
  return new Set(recentHistory.slice(-config.avoidRecentCount).map(x => x.id));
}
function candidatesFor(difficulty, category = null, {ignoreRecent = false} = {}) {
  const rec = recentIds();
  return questions.filter(q => {
    if (q.difficulty !== difficulty) return false;
    if (category && q.category !== category) return false;
    if (state.sessionQuestionIds.includes(q.id)) return false;
    if (!ignoreRecent && rec.has(q.id)) return false;
    return true;
  });
}
function chooseQuestion(difficulty, category = null) {
  let pool = candidatesFor(difficulty, category);
  if (!pool.length) pool = candidatesFor(difficulty, category, {ignoreRecent:true});
  if (!pool.length && category) {
    pool = candidatesFor(difficulty, null);
    if (!pool.length) pool = candidatesFor(difficulty, null, {ignoreRecent:true});
  }
  if (!pool.length) return null;
  let q;
  if (config.selectionMode === 'manual') {
    q = pool.slice().sort((a,b) => questions.indexOf(a)-questions.indexOf(b))[0];
  } else {
    q = pool[Math.floor(Math.random() * pool.length)];
  }
  return q;
}
function availableCategories(difficulty) {
  if (!difficulty) return [];
  const allCats = [...new Set(questions.map(q => q.category))].sort((a,b) => a.localeCompare(b,'es'));
  const availableCount = (cat, diff) => questions.filter(q => q.category === cat && q.difficulty === diff && !state.sessionQuestionIds.includes(q.id)).length;
  if (config.mode === 'classic' && config.categoryChoice === 'start' && state.roundIndex === 0) {
    return allCats.filter(cat => DIFFS.every(d => availableCount(cat, d) >= (config.roundPlan[d] || 0)));
  }
  if (config.mode === 'classic' && config.categoryChoice === 'perDifficulty') {
    let needed = 0;
    for (let i = Math.max(0, state.roundIndex); i < state.roundSequence.length && state.roundSequence[i] === difficulty; i++) needed++;
    needed = Math.max(1, needed);
    return allCats.filter(cat => availableCount(cat, difficulty) >= needed);
  }
  return allCats.filter(cat => availableCount(cat, difficulty) >= 1);
}
function askCategoryFor(roundIndex, difficulty) {
  if (config.mode !== 'classic' || config.categoryChoice === 'off') return false;
  if (config.categoryChoice === 'start') return roundIndex === 0 && !state.lockedCategory;
  if (config.categoryChoice === 'perDifficulty') {
    if (roundIndex === 0) return true;
    return state.roundSequence[roundIndex - 1] !== difficulty;
  }
  return false;
}
function setQuestion(q, {awardable = true} = {}) {
  state.currentQuestionId = q?.id || null;
  state.questionVariant = 'main';
  state.selectedCategory = q?.category || state.selectedCategory;
  resetQuestionRuntime();
  state.roundAwardable = awardable;
  state.phase = q ? 'question' : 'idle';
  state.message = q ? 'Pregunta preparada' : 'No hay pregunta disponible';
}
function advanceRound() {
  const nextIndex = state.roundIndex + 1;
  if (nextIndex >= state.roundSequence.length) {
    stopTimer(false);
    state.phase = 'summary';
    state.message = 'Resumen final';
    return true;
  }
  state.roundIndex = nextIndex;
  const diff = state.roundSequence[nextIndex];
  state.pendingDifficulty = diff;
  state.selectedCategory = null;
  state.currentQuestionId = null;
  state.questionVariant = 'main';
  resetQuestionRuntime();
  if (askCategoryFor(nextIndex, diff)) {
    state.phase = 'category';
    state.message = 'Elige una categoría';
    return true;
  }
  const category = config.categoryChoice !== 'off' ? state.lockedCategory : null;
  const q = chooseQuestion(diff, category);
  if (!q) {
    state.phase = 'summary';
    state.message = `No quedan preguntas disponibles de nivel ${diff}`;
    return false;
  }
  setQuestion(q);
  return true;
}
function chooseLiveCategory(category) {
  const cats = availableCategories(state.pendingDifficulty);
  if (!cats.includes(category)) return false;
  state.selectedCategory = category;
  if (config.categoryChoice !== 'off') state.lockedCategory = category;
  state.phase = 'categoryChosen';
  state.message = `Categoría elegida: ${category}`;
  return true;
}
function confirmCategorySelection() {
  if (!state.selectedCategory || !state.pendingDifficulty) return false;
  const q = chooseQuestion(state.pendingDifficulty, state.selectedCategory);
  if (!q) return false;
  setQuestion(q);
  return true;
}
function rememberQuestion(id) {
  if (!id) return;
  recentHistory.push({id, at: Date.now()});
  recentHistory = recentHistory.slice(-200);
  save(HFILE, recentHistory);
}

function applyScore() {
  if (state.scoreApplied) return;
  const q = currentQuestion();
  if (!q) return;
  const prize = PRIZES[q.difficulty] || 0;
  const correct = p => state.answers[p] === q.correctIndex;
  const canAward = state.roundAwardable;
  state.duelResult = null;

  if (config.mode === 'classic') {
    if (canAward && correct(config.activePlayer)) state.winnings[config.activePlayer] += prize;
  } else {
    const aCorrect = correct('A'), bCorrect = correct('B');
    const aMs = responseMs('A'), bMs = responseMs('B');
    const bothCorrect = aCorrect && bCorrect;
    const deltaMs = bothCorrect && aMs != null && bMs != null ? Math.abs(aMs - bMs) : null;
    let winners = [], reason = 'none';
    if (config.duelRule === 'all') {
      winners = ['A','B'].filter(correct);
      reason = winners.length ? 'all' : 'none';
    } else if (aCorrect && !bCorrect) { winners=['A']; reason='correct'; }
    else if (bCorrect && !aCorrect) { winners=['B']; reason='correct'; }
    else if (bothCorrect) {
      if (aMs == null && bMs == null) { winners=['A','B']; reason='tie'; }
      else if (aMs == null) { winners=['B']; reason='fastest'; }
      else if (bMs == null) { winners=['A']; reason='fastest'; }
      else if (aMs < bMs) { winners=['A']; reason='fastest'; }
      else if (bMs < aMs) { winners=['B']; reason='fastest'; }
      else { winners=['A','B']; reason='tie'; }
    }
    if (canAward) for (const p of winners) state.winnings[p] += prize;
    state.duelResult = { winners, reason, deltaMs, bothCorrect, correct:{A:aCorrect,B:bCorrect}, responseMs:{A:aMs,B:bMs}, awardable:canAward };
  }
  state.scoreApplied = true;
}
function recordRound() {
  if (state.roundRecorded) return;
  const q = currentQuestion();
  if (!q) return;
  const correct = { A: state.answers.A === q.correctIndex, B: state.answers.B === q.correctIndex };
  state.roundHistory.push({
    round: state.roundIndex + 1,
    questionId: q.id,
    variant: q.variant,
    category: q.category,
    difficulty: q.difficulty,
    prize: PRIZES[q.difficulty],
    answers: clone(state.answers),
    correct,
    responseMs: {A:responseMs('A'), B:responseMs('B')},
    winners: state.duelResult?.winners ? [...state.duelResult.winners] : (config.mode === 'classic' && correct[config.activePlayer] ? [config.activePlayer] : []),
    awardable: state.roundAwardable
  });
  state.roundRecorded = true;
}
function gameSummary() {
  const rounds = state.roundHistory;
  const stats = {};
  for (const p of ['A','B']) {
    stats[p] = {
      played: config.mode === 'duel' ? rounds.length : (p === config.activePlayer ? rounds.length : 0),
      correct: rounds.filter(r => r.correct?.[p]).length,
      roundWins: rounds.filter(r => r.winners?.includes(p)).length,
      winnings: state.winnings[p],
      avgResponseMs: null
    };
    const times = rounds.map(r => r.responseMs?.[p]).filter(v => Number.isFinite(v));
    if (times.length) stats[p].avgResponseMs = Math.round(times.reduce((a,b)=>a+b,0)/times.length);
  }
  let outcome = {type:'completed', winners:[]};
  if (config.mode === 'duel') {
    if (state.winnings.A > state.winnings.B) outcome={type:'victory',winners:['A']};
    else if (state.winnings.B > state.winnings.A) outcome={type:'victory',winners:['B']};
    else if (stats.A.roundWins > stats.B.roundWins) outcome={type:'victory',winners:['A']};
    else if (stats.B.roundWins > stats.A.roundWins) outcome={type:'victory',winners:['B']};
    else outcome={type:'tie',winners:['A','B']};
  } else {
    const p = config.activePlayer;
    const last = rounds[rounds.length-1];
    outcome = last && last.difficulty === 'impossible' && last.correct?.[p]
      ? {type:'victory',winners:[p]}
      : {type:'defeat',winners:[]};
  }
  return { roundsPlayed:rounds.length, totalRounds:state.roundSequence.length, stats, outcome };
}

function lifelineAllowed(p) {
  return config.mode === 'classic'
    && p === config.activePlayer
    && state.phase === 'open'
    && state.revealedOptions === 4
    && state.answers[p] === null
    && !state.correctRevealed
    && !!currentQuestion();
}
function swapQuestion(p) {
  const q = baseQuestion();
  if (!q) return {ok:false,error:'No hay pregunta'};
  stopTimer(false);
  if (q.alternate && state.questionVariant === 'main') {
    state.questionVariant = 'alternate';
    resetQuestionRuntime({preserveAwardable:true});
    state.phase = 'question';
    state.message = 'Pregunta alternativa preparada';
    return {ok:true};
  }
  let pool = candidatesFor(q.difficulty, q.category);
  if (!pool.length) pool = candidatesFor(q.difficulty, q.category, {ignoreRecent:true});
  if (!pool.length) return {ok:false,error:'No hay pregunta alternativa disponible en esta categoría'};
  if (!state.sessionQuestionIds.includes(q.id)) state.sessionQuestionIds.push(q.id);
  if (!state.discardedQuestionIds.includes(q.id)) state.discardedQuestionIds.push(q.id);
  rememberQuestion(q.id);
  const replacement = config.selectionMode === 'random' ? pool[Math.floor(Math.random()*pool.length)] : pool[0];
  state.currentQuestionId = replacement.id;
  state.questionVariant = 'main';
  resetQuestionRuntime({preserveAwardable:true});
  state.phase = 'question';
  state.message = 'Pregunta cambiada';
  return {ok:true};
}

function publicQuestion(role, p) {
  const q = currentQuestion();
  if (!q) return null;
  const out = {
    id:q.id, variant:q.variant, category:q.category, difficulty:q.difficulty,
    text:q.text, options:q.options, prize:PRIZES[q.difficulty]
  };
  if (role === 'host') { out.correctIndex=q.correctIndex; out.hint=q.hint; }
  if (state.correctRevealed) out.correctIndex=q.correctIndex;
  if (role === 'player') {
    out.hiddenOptions = state.hiddenOptions[p] || [];
    out.hint = state.hintVisible[p] ? q.hint : '';
  } else if (role === 'display' && config.mode === 'classic') {
    const a = config.activePlayer;
    out.hiddenOptions = state.hiddenOptions[a] || [];
    out.hint = state.hintVisible[a] ? q.hint : '';
  }
  return out;
}
function publicState(role='display', p='A') {
  const out = {
    ...state,
    responseTimes:{A:responseMs('A'),B:responseMs('B')},
    config:{...config,prizeMap:PRIZES},
    questionCount:questions.length,
    question:publicQuestion(role,p),
    currentPrize:currentPrize(),
    availableCategories:availableCategories(state.pendingDifficulty),
    summary:gameSummary(),
    serverTime:Date.now()
  };
  if (role === 'host') {
    out.questions = questions.map(q => ({
      ...q,
      prize:PRIZES[q.difficulty],
      used:state.sessionQuestionIds.includes(q.id),
      discarded:state.discardedQuestionIds.includes(q.id),
      recent:recentIds().has(q.id)
    }));
    out.recentHistoryCount = recentHistory.length;
  } else {
    delete out.sessionQuestionIds;
    delete out.discardedQuestionIds;
  }
  return out;
}

async function api(req,res,url) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204,{
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Headers':'Content-Type, X-Host-Pin, X-Access-Code',
      'Access-Control-Allow-Methods':'GET, POST, OPTIONS'
    });
    return res.end();
  }
  if (req.method === 'GET' && url.pathname === '/api/health') return json(res,200,{ok:true,version:'2.2.0'});

  if (req.method === 'GET' && url.pathname === '/api/state') {
    const role = url.searchParams.get('role') === 'host' ? 'host' : url.searchParams.get('role') === 'player' ? 'player' : 'display';
    if (!authorized(req,url,role==='host')) return json(res,401,{error:'Acceso incorrecto'});
    return json(res,200,publicState(role,player(url.searchParams.get('player'))));
  }
  if (req.method === 'GET' && url.pathname === '/api/stream') {
    const role = url.searchParams.get('role') === 'host' ? 'host' : url.searchParams.get('role') === 'player' ? 'player' : 'display';
    if (!authorized(req,url,role==='host')) return json(res,401,{error:'Acceso incorrecto'});
    const p = player(url.searchParams.get('player'));
    res.writeHead(200,{
      'Content-Type':'text/event-stream; charset=utf-8',
      'Cache-Control':'no-cache, no-transform',
      'Connection':'keep-alive',
      'Access-Control-Allow-Origin':'*',
      'X-Accel-Buffering':'no'
    });
    res.write(`retry: 1000\nevent: state\ndata: ${JSON.stringify(publicState(role,p))}\n\n`);
    const c={res,role,player:p}; clients.add(c);
    const k=setInterval(()=>{try{res.write(': keep-alive\n\n')}catch{}},15000);
    req.on('close',()=>{clearInterval(k);clients.delete(c)});
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/answer') {
    if (!authorized(req,url,false)) return json(res,401,{error:'Código de acceso incorrecto'});
    const b=await readBody(req), p=player(b.player), a=Number(b.answer);
    if (state.phase !== 'open') return json(res,409,{error:'Las respuestas no están habilitadas'});
    if (config.mode === 'classic' && p !== config.activePlayer) return json(res,409,{error:'Este concursante no está jugando esta pregunta'});
    if (!Number.isInteger(a)||a<0||a>3) return json(res,400,{error:'Respuesta inválida'});
    if ((state.hiddenOptions[p]||[]).includes(a)) return json(res,409,{error:'Esa opción fue eliminada'});
    if (state.answers[p] !== a) state.answerTimes[p] = Date.now();
    state.answers[p] = a;
    bump(`${nameOf(p)} respondió`);
    return json(res,200,{ok:true});
  }

  if (req.method === 'POST' && url.pathname === '/api/category') {
    if (!authorized(req,url,false)) return json(res,401,{error:'Código de acceso incorrecto'});
    const b=await readBody(req), p=player(b.player), category=String(b.category||'');
    if (config.mode !== 'classic' || p !== config.activePlayer) return json(res,409,{error:'Este concursante no elige la categoría'});
    if (state.phase !== 'category') return json(res,409,{error:'No es momento de elegir categoría'});
    if (!chooseLiveCategory(category)) return json(res,409,{error:'Categoría no disponible'});
    bump('category');
    return json(res,200,{ok:true});
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/') && !authorized(req,url,true)) {
    return json(res,401,{error:'PIN o código incorrecto'});
  }

  if (req.method === 'POST' && url.pathname === '/api/action') {
    const b=await readBody(req), action=String(b.action||'');
    const q=currentQuestion();

    switch(action) {
      case 'prepareShow': {
        stopTimer(false);
        const rev=state.revision+1;
        state=freshState(); state.revision=rev;
        state.phase='intro'; state.message='Presentación de apertura';
        broadcast();
        return json(res,200,publicState('host'));
      }
      case 'startShow':
        if (state.phase!=='intro') return json(res,409,{error:'La apertura no está activa'});
        advanceRound();
        break;
      case 'chooseCategory':
        if (state.phase!=='category') return json(res,409,{error:'No es momento de elegir categoría'});
        if (!chooseLiveCategory(String(b.category||''))) return json(res,409,{error:'Categoría no disponible'});
        break;
      case 'confirmCategory':
        if (state.phase!=='categoryChosen') return json(res,409,{error:'Primero elige una categoría'});
        if (!confirmCategorySelection()) return json(res,409,{error:'No quedan preguntas para esa categoría'});
        break;
      case 'showQuestion': {
        const i=Number(b.index);
        if (!Number.isInteger(i)||i<0||i>=questions.length) return json(res,400,{error:'Pregunta inválida'});
        state.currentQuestionId=questions[i].id;
        state.questionVariant='main';
        state.pendingDifficulty=questions[i].difficulty;
        state.selectedCategory=questions[i].category;
        resetQuestionRuntime();
        state.roundAwardable=!state.sessionQuestionIds.includes(questions[i].id);
        state.phase='question';
        state.message=state.roundAwardable?'Pregunta preparada':'Pregunta ya usada: sin premio';
        break;
      }
      case 'revealNextOption':
        if (!q) return json(res,400,{error:'No hay pregunta'});
        if (!['question'].includes(state.phase)) return json(res,409,{error:'No puedes revelar alternativas ahora'});
        state.revealedOptions=Math.min(4,state.revealedOptions+1);
        break;
      case 'revealAllOptions':
        if (!q) return json(res,400,{error:'No hay pregunta'});
        if (state.phase!=='question') return json(res,409,{error:'No puedes revelar alternativas ahora'});
        state.revealedOptions=4;
        break;
      case 'openAnswers':
        if (!q) return json(res,400,{error:'No hay pregunta'});
        if (state.revealedOptions<4) return json(res,409,{error:'Revela las cuatro alternativas primero'});
        if (state.phase!=='question') return json(res,409,{error:'La pregunta no está lista para responder'});
        state.phase='open'; startTimer(); break;
      case 'lockAnswers':
        if (state.phase!=='open') return json(res,409,{error:'Las respuestas no están abiertas'});
        stopTimer(true); state.phase='locked'; break;
      case 'revealPlayerAnswer': {
        if (!['locked','result'].includes(state.phase)) return json(res,409,{error:'Bloquea las respuestas antes de revelarlas'});
        const p=player(b.player);
        if (config.mode==='classic'&&p!==config.activePlayer) return json(res,409,{error:'Ese concursante no está activo'});
        state.revealedPlayerAnswers[p]=true; break;
      }
      case 'revealCorrect':
        if (!q) return json(res,400,{error:'No hay pregunta'});
        if (!['locked','result'].includes(state.phase)) return json(res,409,{error:'Bloquea las respuestas antes de revelar la correcta'});
        state.correctRevealed=true; state.phase='result';
        applyScore();
        if (!state.sessionQuestionIds.includes(q.id)) state.sessionQuestionIds.push(q.id);
        rememberQuestion(q.id);
        recordRound();
        break;
      case 'useLifeline': {
        const p=player(b.player), type=String(b.type||'');
        if (!['fifty','hint','swap'].includes(type)) return json(res,400,{error:'Comodín inválido'});
        if (!state.lifelines[p]?.[type]) return json(res,409,{error:'Comodín no disponible'});
        if (!lifelineAllowed(p)) return json(res,409,{error:'Los comodines solo se pueden usar con respuestas abiertas y antes de responder'});
        state.lifelines[p][type]=false;
        if (type==='fifty') {
          const wrong=[0,1,2,3].filter(i=>i!==q.correctIndex);
          for (let i=wrong.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[wrong[i],wrong[j]]=[wrong[j],wrong[i]]}
          state.hiddenOptions[p]=wrong.slice(0,2);
        } else if (type==='hint') state.hintVisible[p]=true;
        else {
          const r=swapQuestion(p);
          if (!r.ok) { state.lifelines[p][type]=true; return json(res,409,{error:r.error}); }
        }
        break;
      }
      case 'nextQuestion':
        if (state.phase==='result') advanceRound();
        else return json(res,409,{error:'Termina la ronda antes de avanzar'});
        break;
      case 'showSummary':
        stopTimer(false); state.phase='summary'; state.message='Resumen final'; break;
      case 'showFinal':
        if (state.phase!=='summary') return json(res,409,{error:'Muestra primero el resumen'});
        state.phase='final'; state.message='Cierre del juego'; break;
      case 'commercial':
        if (state.phase!=='commercial') {
          if (state.phase==='open') stopTimer(true);
          state.previousPhase=state.phase; state.phase='commercial';
        } else {
          state.phase=state.previousPhase||'idle';
          if (state.phase==='open') state.phase='locked';
        }
        break;
      case 'resetRound':
        if (!q) return json(res,409,{error:'No hay pregunta activa'});
        resetQuestionRuntime({preserveAwardable:true}); state.phase='question'; break;
      case 'setActivePlayer':
        if (config.mode!=='classic') return json(res,409,{error:'Solo en modo clásico'});
        if (!['idle','intro'].includes(state.phase)) return json(res,409,{error:'Cambia el concursante activo antes de comenzar'});
        config.activePlayer=player(b.player); save(CFILE,config); break;
      case 'setTimer':
        if (state.phase==='open') return json(res,409,{error:'No cambies el tiempo con respuestas abiertas'});
        config.timerSeconds=cleanTimer(b.seconds); save(CFILE,config);
        state.timerRemainingMs=config.timerSeconds>0?config.timerSeconds*1000:null; break;
      case 'adjustScore': {
        const p=player(b.player), d=Number(b.delta||0);
        if (!Number.isFinite(d)) return json(res,400,{error:'Ajuste inválido'});
        state.winnings[p]=Math.max(0,state.winnings[p]+Math.trunc(d)); break;
      }
      case 'clearRecentHistory':
        recentHistory=[]; save(HFILE,recentHistory); break;
      case 'resetGame': {
        stopTimer(false);
        const rev=state.revision+1; state=freshState(); state.revision=rev;
        broadcast(); return json(res,200,publicState('host'));
      }
      default: return json(res,400,{error:'Acción desconocida'});
    }
    bump(action);
    return json(res,200,publicState('host'));
  }

  if (req.method === 'POST' && url.pathname === '/api/config') {
    const b=await readBody(req);
    config=cleanConfig({...config,...b});
    save(CFILE,config);
    if (['idle','intro'].includes(state.phase)) state.roundSequence=buildRoundSequence();
    bump('config');
    return json(res,200,{ok:true,config});
  }

  if (req.method === 'POST' && url.pathname === '/api/questions') {
    const b=await readBody(req);
    if (!Array.isArray(b.questions)) return json(res,400,{error:'Formato inválido'});
    const c=b.questions.map(cleanQ).filter(q=>q.text&&q.options.every(Boolean));
    if (!c.length) return json(res,400,{error:'Debe existir al menos una pregunta'});
    questions=c; save(QFILE,questions);
    if (state.currentQuestionId && !questions.some(q=>q.id===state.currentQuestionId)) state.currentQuestionId=null;
    bump('questions');
    return json(res,200,{ok:true});
  }

  if (req.method === 'GET' && url.pathname === '/api/export') {
    if (!authorized(req,url,true)) return json(res,401,{error:'Acceso incorrecto'});
    const d=JSON.stringify({version:2.2,config,questions},null,2);
    res.writeHead(200,{'Content-Type':'application/json','Content-Disposition':'attachment; filename="foco-show-pack-v22.json"'});
    return res.end(d);
  }
  if (req.method === 'POST' && url.pathname === '/api/import') {
    const b=await readBody(req);
    if (!Array.isArray(b.questions)) return json(res,400,{error:'Archivo inválido'});
    const c=b.questions.map(cleanQ).filter(q=>q.text&&q.options.every(Boolean));
    if (!c.length) return json(res,400,{error:'No hay preguntas válidas'});
    questions=c; save(QFILE,questions);
    if (b.config) { config=cleanConfig({...config,...b.config}); save(CFILE,config); }
    const rev=state.revision+1; state=freshState(); state.revision=rev;
    broadcast(); return json(res,200,{ok:true});
  }

  return json(res,404,{error:'No encontrado'});
}

const MIME = {
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.webmanifest':'application/manifest+json; charset=utf-8'
};
function staticFile(req,res,url) {
  let pn=decodeURIComponent(url.pathname);
  if (pn==='/') pn='/index.html';
  if (pn==='/game'||pn==='/game.html') pn='/broadcast.html';
  const file=path.normalize(path.join(PUBLIC,pn));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(file,(e,st)=>{
    if (e||!st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200,{
      'Content-Type':MIME[path.extname(file)]||'application/octet-stream',
      'Cache-Control':path.extname(file)==='.html'?'no-cache':'public, max-age=300'
    });
    fs.createReadStream(file).pipe(res);
  });
}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await api(req,res,url);
    return staticFile(req,res,url);
  } catch(e) {
    console.error(e);
    if (!res.headersSent) return json(res,500,{error:'Error interno'});
    res.end();
  }
});
server.listen(PORT,'0.0.0.0',()=>{
  console.log(`FOCO V2.2: http://localhost:${PORT}`);
  for (const es of Object.values(os.networkInterfaces())) for (const n of es||[]) {
    if (n.family==='IPv4'&&!n.internal) console.log(`Red: http://${n.address}:${PORT}`);
  }
  console.log(`PIN host: ${HOST_PIN}`);
});
