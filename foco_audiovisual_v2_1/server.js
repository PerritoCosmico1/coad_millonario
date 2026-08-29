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

fs.mkdirSync(DATA, { recursive: true });

const PRIZES = { easy: 250000, medium: 500000, hard: 1000000, impossible: 10000000 };
const DIFFS = ['easy', 'medium', 'hard', 'impossible'];

const defaultQuestions = [
  {id:'q1',category:'Cámara',difficulty:'easy',text:'¿Qué ajuste controla directamente la cantidad de luz que entra a través del lente?',options:['ISO','Apertura','Balance de blancos','Frame rate'],correctIndex:1,hint:'Piensa en el tamaño físico de la abertura dentro del lente.'},
  {id:'q2',category:'Sonido',difficulty:'easy',text:'¿Cuál de estos micrófonos suele ser más direccional?',options:['Lavalier omnidireccional','Shotgun','Micrófono de contacto','Boundary'],correctIndex:1,hint:'Suele montarse sobre cámara o pértiga y apunta hacia la fuente.'},
  {id:'q3',category:'Montaje',difficulty:'medium',text:'¿Qué principio ayuda a mantener la coherencia espacial entre dos personajes que conversan?',options:['Regla de 180°','Ley del inverso del cuadrado','Regla de tercios','Efecto Kuleshov'],correctIndex:0,hint:'Imagina una línea imaginaria que une a ambos personajes.'},
  {id:'q4',category:'Fotografía',difficulty:'medium',text:'Si mantienes ISO y apertura, ¿qué ocurre al pasar de 1/50 s a 1/100 s?',options:['Entra el doble de luz','Entra la mitad de luz','No cambia la exposición','Aumenta la profundidad de campo'],correctIndex:1,hint:'El obturador permanece abierto durante menos tiempo.'},
  {id:'q5',category:'Postproducción',difficulty:'hard',text:'¿Qué espacio de color de trabajo se usa comúnmente para una entrega SDR de televisión HD?',options:['Rec. 709','DCI-P3 D65','ACEScg','Adobe RGB'],correctIndex:0,hint:'Es el estándar de referencia habitual para HDTV SDR.'},
  {id:'q6',category:'Cine',difficulty:'hard',text:'¿Qué término describe una toma muy larga ejecutada sin cortes visibles?',options:['Plano secuencia','Jump cut','Insert','Match cut'],correctIndex:0,hint:'La acción y el movimiento de cámara continúan dentro de una sola toma.'},
  {id:'q7',category:'Audiovisual',difficulty:'impossible',text:'En una señal de video 4:2:2 de 10 bits, ¿qué describe principalmente la notación 4:2:2?',options:['La profundidad de bits','El submuestreo de crominancia','La relación de aspecto','La frecuencia de cuadro'],correctIndex:1,hint:'Se refiere a cuánta información de color se conserva respecto de la luminancia.'}
];

const defaultConfig = {
  showTitle: 'FOCO AUDIOVISUAL',
  showSubtitle: 'Concurso de conocimientos audiovisuales',
  playerAName: 'Concursante A',
  playerBName: 'Concursante B',
  mode: 'classic',
  activePlayer: 'A',
  duelRule: 'fastest',
  timerSeconds: 30,
  prizeMap: PRIZES
};

const clone = x => JSON.parse(JSON.stringify(x));
function load(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
    return clone(fallback);
  }
}
const save = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

function normDiff(v) {
  v = String(v || '').toLowerCase();
  if (DIFFS.includes(v)) return v;
  if (v.startsWith('f')) return 'easy';
  if (v.startsWith('m')) return 'medium';
  if (v.startsWith('d') || v.startsWith('h')) return 'hard';
  if (v.startsWith('i')) return 'impossible';
  return 'medium';
}
function cleanQ(q, i = 0) {
  return {
    id: String(q.id || `q_${Date.now()}_${i}`).slice(0, 80),
    category: String(q.category || 'General').slice(0, 60),
    difficulty: normDiff(q.difficulty),
    text: String(q.text || '').slice(0, 700),
    options: Array.from({ length: 4 }, (_, j) => String((q.options || [])[j] || '').slice(0, 220)),
    correctIndex: Math.max(0, Math.min(3, Number(q.correctIndex) || 0)),
    hint: String(q.hint || '').slice(0, 400)
  };
}
function cleanTimer(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(3, Math.min(300, Math.round(n)));
}

let questions = load(QFILE, defaultQuestions).map(cleanQ).filter(q => q.text && q.options.every(Boolean));
if (!questions.length) questions = clone(defaultQuestions);

let config = { ...defaultConfig, ...load(CFILE, defaultConfig), prizeMap: PRIZES };
config.mode = config.mode === 'duel' ? 'duel' : 'classic';
config.activePlayer = config.activePlayer === 'B' ? 'B' : 'A';
config.duelRule = config.duelRule === 'all' ? 'all' : 'fastest';
config.timerSeconds = cleanTimer(config.timerSeconds ?? 30);

const freshLifelines = () => ({
  A: { fifty: true, hint: true, swap: true },
  B: { fifty: true, hint: true, swap: true }
});

function freshState() {
  return {
    revision: 1,
    phase: 'idle',
    previousPhase: 'idle',
    currentQuestionIndex: 0,
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
    winnings: { A: 0, B: 0 },
    lifelines: freshLifelines(),
    hiddenOptions: { A: [], B: [] },
    hintVisible: { A: false, B: false },
    usedQuestionIds: [],
    discardedQuestionIds: [],
    duelResult: null,
    message: 'Esperando para comenzar'
  };
}

let state = freshState();
let timerHandle = null;
const clients = new Set();

const currentQuestion = () => questions[state.currentQuestionIndex] || null;
const currentPrize = () => currentQuestion() ? PRIZES[currentQuestion().difficulty] : 0;
const player = v => v === 'B' ? 'B' : 'A';

function stopTimer(freeze = true) {
  if (timerHandle) {
    clearTimeout(timerHandle);
    timerHandle = null;
  }
  if (freeze && state.timerEndsAt) state.timerRemainingMs = Math.max(0, state.timerEndsAt - Date.now());
  state.timerEndsAt = null;
}

function resetQuestionRuntime({ keepReveal = false } = {}) {
  stopTimer(false);
  state.answers = { A: null, B: null };
  state.answerTimes = { A: null, B: null };
  state.answerWindowOpenedAt = null;
  state.timerEndsAt = null;
  state.timerRemainingMs = config.timerSeconds > 0 ? config.timerSeconds * 1000 : null;
  state.timerExpired = false;
  state.revealedPlayerAnswers = { A: false, B: false };
  state.correctRevealed = false;
  state.scoreApplied = false;
  state.duelResult = null;
  state.hiddenOptions = { A: [], B: [] };
  state.hintVisible = { A: false, B: false };
  const q = currentQuestion();
  state.roundAwardable = !!q && !state.usedQuestionIds.includes(q.id);
  if (!keepReveal) state.revealedOptions = 0;
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

function authorized(req, url, host = false) {
  const code = String(req.headers['x-access-code'] || url.searchParams.get('code') || '');
  if (ACCESS_CODE && code !== ACCESS_CODE) return false;
  if (!host) return true;
  return String(req.headers['x-host-pin'] || url.searchParams.get('pin') || '') === HOST_PIN;
}

function json(res, status, body) {
  const d = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(d),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Host-Pin, X-Access-Code'
  });
  res.end(d);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', c => {
      b += c;
      if (b.length > 2e6) req.destroy();
    });
    req.on('end', () => {
      try { resolve(b ? JSON.parse(b) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function publicQuestion(role, p) {
  const q = currentQuestion();
  if (!q) return null;
  const out = {
    id: q.id,
    category: q.category,
    difficulty: q.difficulty,
    text: q.text,
    options: q.options,
    prize: PRIZES[q.difficulty]
  };
  if (role === 'host') {
    out.correctIndex = q.correctIndex;
    out.hint = q.hint;
  }
  if (state.correctRevealed) out.correctIndex = q.correctIndex;
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

function publicState(role = 'display', p = 'A') {
  const out = {
    ...state,
    responseTimes: { A: responseMs('A'), B: responseMs('B') },
    config: { ...config, prizeMap: PRIZES },
    questionCount: questions.length,
    question: publicQuestion(role, p),
    currentPrize: currentPrize(),
    serverTime: Date.now()
  };
  if (role === 'host') out.questions = questions.map(q => ({ ...q, prize: PRIZES[q.difficulty], used: state.usedQuestionIds.includes(q.id), discarded: state.discardedQuestionIds.includes(q.id) }));
  else {
    delete out.usedQuestionIds;
    delete out.discardedQuestionIds;
  }
  return out;
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
    const aCorrect = correct('A');
    const bCorrect = correct('B');
    const aMs = responseMs('A');
    const bMs = responseMs('B');
    const bothCorrect = aCorrect && bCorrect;
    const deltaMs = bothCorrect && aMs != null && bMs != null ? Math.abs(aMs - bMs) : null;
    let winners = [];
    let reason = 'none';

    if (config.duelRule === 'all') {
      winners = ['A', 'B'].filter(correct);
      reason = winners.length ? 'all' : 'none';
    } else if (aCorrect && !bCorrect) {
      winners = ['A'];
      reason = 'correct';
    } else if (bCorrect && !aCorrect) {
      winners = ['B'];
      reason = 'correct';
    } else if (bothCorrect) {
      if (aMs == null && bMs == null) {
        winners = ['A', 'B'];
        reason = 'tie';
      } else if (aMs == null) {
        winners = ['B'];
        reason = 'fastest';
      } else if (bMs == null) {
        winners = ['A'];
        reason = 'fastest';
      } else if (aMs < bMs) {
        winners = ['A'];
        reason = 'fastest';
      } else if (bMs < aMs) {
        winners = ['B'];
        reason = 'fastest';
      } else {
        winners = ['A', 'B'];
        reason = 'tie';
      }
    }

    if (canAward) for (const p of winners) state.winnings[p] += prize;
    state.duelResult = {
      winners,
      reason,
      deltaMs,
      bothCorrect,
      correct: { A: aCorrect, B: bCorrect },
      responseMs: { A: aMs, B: bMs },
      awardable: canAward
    };
  }
  state.scoreApplied = true;
}

function swapIndex() {
  const q = currentQuestion();
  if (!q) return -1;
  const pool = questions
    .map((item, index) => ({ item, index }))
    .filter(x => x.index !== state.currentQuestionIndex && x.item.difficulty === q.difficulty && !state.usedQuestionIds.includes(x.item.id));
  if (!pool.length) return -1;
  const after = pool.find(x => x.index > state.currentQuestionIndex);
  return (after || pool[0]).index;
}

function nextAvailableIndex() {
  for (let i = state.currentQuestionIndex + 1; i < questions.length; i++) {
    if (!state.usedQuestionIds.includes(questions[i].id)) return i;
  }
  for (let i = 0; i < questions.length; i++) {
    if (!state.usedQuestionIds.includes(questions[i].id)) return i;
  }
  return Math.min(questions.length - 1, state.currentQuestionIndex + 1);
}

async function api(req, res, url) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-Host-Pin, X-Access-Code',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    return res.end();
  }

  if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true, version: '2.1.0' });

  if (req.method === 'GET' && url.pathname === '/api/state') {
    const role = url.searchParams.get('role') === 'host' ? 'host' : url.searchParams.get('role') === 'player' ? 'player' : 'display';
    if (!authorized(req, url, role === 'host')) return json(res, 401, { error: 'Acceso incorrecto' });
    return json(res, 200, publicState(role, player(url.searchParams.get('player'))));
  }

  if (req.method === 'GET' && url.pathname === '/api/stream') {
    const role = url.searchParams.get('role') === 'host' ? 'host' : url.searchParams.get('role') === 'player' ? 'player' : 'display';
    if (!authorized(req, url, role === 'host')) return json(res, 401, { error: 'Acceso incorrecto' });
    const p = player(url.searchParams.get('player'));
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no'
    });
    res.write(`retry: 1000\nevent: state\ndata: ${JSON.stringify(publicState(role, p))}\n\n`);
    const c = { res, role, player: p };
    clients.add(c);
    const k = setInterval(() => {
      try { res.write(': keep-alive\n\n'); }
      catch {}
    }, 15000);
    req.on('close', () => {
      clearInterval(k);
      clients.delete(c);
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/answer') {
    if (!authorized(req, url, false)) return json(res, 401, { error: 'Código de acceso incorrecto' });
    const b = await readBody(req);
    const p = player(b.player);
    const a = Number(b.answer);
    if (state.phase !== 'open') return json(res, 409, { error: 'Las respuestas no están habilitadas' });
    if (config.mode === 'classic' && p !== config.activePlayer) return json(res, 409, { error: 'Este concursante no está jugando esta pregunta' });
    if (!Number.isInteger(a) || a < 0 || a > 3) return json(res, 400, { error: 'Respuesta inválida' });
    if ((state.hiddenOptions[p] || []).includes(a)) return json(res, 409, { error: 'Esa opción fue eliminada' });
    if (state.answers[p] !== a) state.answerTimes[p] = Date.now();
    state.answers[p] = a;
    bump(`${p} respondió`);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/') && !authorized(req, url, true)) {
    return json(res, 401, { error: 'PIN o código incorrecto' });
  }

  if (req.method === 'POST' && url.pathname === '/api/action') {
    const b = await readBody(req);
    const action = String(b.action || '');
    const q = currentQuestion();

    switch (action) {
      case 'prepareShow':
        state.currentQuestionIndex = 0;
        resetQuestionRuntime();
        state.phase = 'intro';
        state.message = 'Presentación de apertura';
        break;

      case 'showQuestion': {
        const i = Number(b.index);
        if (Number.isInteger(i) && i >= 0 && i < questions.length) state.currentQuestionIndex = i;
        resetQuestionRuntime();
        state.phase = 'question';
        state.message = state.roundAwardable ? 'Pregunta preparada' : 'Pregunta ya consumida: sin premio';
        break;
      }

      case 'revealNextOption':
        if (!currentQuestion()) return json(res, 400, { error: 'No hay pregunta' });
        state.phase = 'question';
        state.revealedOptions = Math.min(4, state.revealedOptions + 1);
        break;

      case 'revealAllOptions':
        state.phase = 'question';
        state.revealedOptions = 4;
        break;

      case 'openAnswers':
        if (state.revealedOptions < 4) return json(res, 409, { error: 'Revela las cuatro alternativas primero' });
        state.phase = 'open';
        startTimer();
        break;

      case 'lockAnswers':
        if (state.phase !== 'open') return json(res, 409, { error: 'Las respuestas no están abiertas' });
        stopTimer(true);
        state.phase = 'locked';
        break;

      case 'revealPlayerAnswer': {
        if (state.phase !== 'locked' && state.phase !== 'result') return json(res, 409, { error: 'Bloquea las respuestas antes de revelarlas' });
        const p = player(b.player);
        if (config.mode === 'classic' && p !== config.activePlayer) return json(res, 409, { error: 'Ese concursante no está activo' });
        state.revealedPlayerAnswers[p] = true;
        break;
      }

      case 'revealCorrect':
        if (!q) return json(res, 400, { error: 'No hay pregunta' });
        if (state.phase !== 'locked' && state.phase !== 'result') return json(res, 409, { error: 'Bloquea las respuestas antes de revelar la correcta' });
        state.correctRevealed = true;
        state.phase = 'result';
        applyScore();
        if (!state.usedQuestionIds.includes(q.id)) state.usedQuestionIds.push(q.id);
        break;

      case 'setActivePlayer':
        if (config.mode !== 'classic') return json(res, 409, { error: 'Solo en modo clásico' });
        config.activePlayer = player(b.player);
        save(CFILE, config);
        resetQuestionRuntime({ keepReveal: true });
        state.phase = state.phase === 'idle' ? 'idle' : 'question';
        break;

      case 'setTimer':
        if (state.phase === 'open') return json(res, 409, { error: 'No cambies el temporizador con respuestas abiertas' });
        config.timerSeconds = cleanTimer(b.seconds);
        save(CFILE, config);
        state.timerRemainingMs = config.timerSeconds > 0 ? config.timerSeconds * 1000 : null;
        break;

      case 'adjustScore': {
        const p = player(b.player);
        const d = Number(b.delta || 0);
        if (!Number.isFinite(d)) return json(res, 400, { error: 'Ajuste inválido' });
        state.winnings[p] = Math.max(0, state.winnings[p] + Math.trunc(d));
        break;
      }

      case 'useLifeline': {
        const p = player(b.player);
        const type = String(b.type || '');
        if (config.mode !== 'classic') return json(res, 409, { error: 'Los comodines se usan en modo clásico' });
        if (p !== config.activePlayer) return json(res, 409, { error: 'Solo el concursante activo puede usar comodines' });
        if (!['fifty', 'hint', 'swap'].includes(type) || !state.lifelines[p][type]) return json(res, 409, { error: 'Comodín no disponible' });
        if (!q) return json(res, 400, { error: 'No hay pregunta' });

        if (type === 'swap') {
          const n = swapIndex();
          if (n < 0) return json(res, 409, { error: 'No hay otra pregunta sin usar de la misma dificultad' });
          state.lifelines[p].swap = false;
          if (!state.usedQuestionIds.includes(q.id)) state.usedQuestionIds.push(q.id);
          if (!state.discardedQuestionIds.includes(q.id)) state.discardedQuestionIds.push(q.id);
          state.currentQuestionIndex = n;
          resetQuestionRuntime();
          state.phase = 'question';
          state.message = 'Pregunta cambiada';
        } else {
          state.lifelines[p][type] = false;
          if (type === 'fifty') {
            state.hiddenOptions[p] = [0, 1, 2, 3].filter(i => i !== q.correctIndex).slice(0, 2);
          } else if (type === 'hint') {
            state.hintVisible[p] = true;
          }
        }
        break;
      }

      case 'commercial':
        if (state.phase !== 'commercial') {
          if (state.phase === 'open') stopTimer(true);
          state.previousPhase = state.phase;
          state.phase = 'commercial';
        } else {
          state.phase = state.previousPhase || 'idle';
          if (state.phase === 'open') {
            // Al volver de comerciales, el reloj no se reanuda automáticamente.
            state.phase = 'locked';
          }
        }
        break;

      case 'nextQuestion':
        state.currentQuestionIndex = nextAvailableIndex();
        resetQuestionRuntime();
        state.phase = 'question';
        break;

      case 'previousQuestion':
        state.currentQuestionIndex = Math.max(0, state.currentQuestionIndex - 1);
        resetQuestionRuntime();
        state.phase = 'question';
        break;

      case 'resetRound':
        resetQuestionRuntime();
        state.phase = 'question';
        break;

      case 'resetGame': {
        stopTimer(false);
        const r = state.revision + 1;
        state = freshState();
        state.revision = r;
        broadcast();
        return json(res, 200, publicState('host'));
      }

      default:
        return json(res, 400, { error: 'Acción desconocida' });
    }

    bump(action);
    return json(res, 200, publicState('host'));
  }

  if (req.method === 'POST' && url.pathname === '/api/config') {
    const b = await readBody(req);
    config = {
      ...config,
      showTitle: String(b.showTitle || defaultConfig.showTitle).slice(0, 80),
      showSubtitle: String(b.showSubtitle || '').slice(0, 140),
      playerAName: String(b.playerAName || 'Concursante A').slice(0, 60),
      playerBName: String(b.playerBName || 'Concursante B').slice(0, 60),
      mode: b.mode === 'duel' ? 'duel' : 'classic',
      activePlayer: b.activePlayer === 'B' ? 'B' : 'A',
      duelRule: b.duelRule === 'all' ? 'all' : 'fastest',
      timerSeconds: cleanTimer(b.timerSeconds ?? config.timerSeconds),
      prizeMap: PRIZES
    };
    save(CFILE, config);
    resetQuestionRuntime({ keepReveal: true });
    bump('config');
    return json(res, 200, { ok: true, config });
  }

  if (req.method === 'POST' && url.pathname === '/api/questions') {
    const b = await readBody(req);
    if (!Array.isArray(b.questions)) return json(res, 400, { error: 'Formato inválido' });
    const c = b.questions.map(cleanQ).filter(q => q.text && q.options.every(Boolean));
    if (!c.length) return json(res, 400, { error: 'Debe existir al menos una pregunta' });
    questions = c;
    state.currentQuestionIndex = Math.min(state.currentQuestionIndex, questions.length - 1);
    save(QFILE, questions);
    bump('questions');
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/export') {
    if (!authorized(req, url, true)) return json(res, 401, { error: 'Acceso incorrecto' });
    const d = JSON.stringify({ version: 2.1, config, questions }, null, 2);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="foco-show-pack-v21.json"'
    });
    return res.end(d);
  }

  if (req.method === 'POST' && url.pathname === '/api/import') {
    const b = await readBody(req);
    if (!Array.isArray(b.questions)) return json(res, 400, { error: 'Archivo inválido' });
    questions = b.questions.map(cleanQ).filter(q => q.text && q.options.every(Boolean));
    if (!questions.length) return json(res, 400, { error: 'No hay preguntas válidas' });
    if (b.config) {
      config = {
        ...config,
        ...b.config,
        mode: b.config.mode === 'duel' ? 'duel' : 'classic',
        activePlayer: b.config.activePlayer === 'B' ? 'B' : 'A',
        duelRule: b.config.duelRule === 'all' ? 'all' : 'fastest',
        timerSeconds: cleanTimer(b.config.timerSeconds ?? config.timerSeconds),
        prizeMap: PRIZES
      };
      save(CFILE, config);
    }
    save(QFILE, questions);
    state.currentQuestionIndex = 0;
    resetQuestionRuntime();
    state.phase = 'idle';
    bump('import');
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: 'No encontrado' });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

function staticFile(req, res, url) {
  let pn = decodeURIComponent(url.pathname);
  if (pn === '/') pn = '/index.html';
  if (pn === '/game' || pn === '/game.html') pn = '/broadcast.html';
  const file = path.normalize(path.join(PUBLIC, pn));
  if (!file.startsWith(PUBLIC)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.stat(file, (e, st) => {
    if (e || !st.isFile()) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': path.extname(file) === '.html' ? 'no-cache' : 'public, max-age=300'
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    return staticFile(req, res, url);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) return json(res, 500, { error: 'Error interno' });
    res.end();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`FOCO V2.1: http://localhost:${PORT}`);
  for (const es of Object.values(os.networkInterfaces())) {
    for (const n of es || []) {
      if (n.family === 'IPv4' && !n.internal) console.log(`Red: http://${n.address}:${PORT}`);
    }
  }
  console.log(`PIN host: ${HOST_PIN}`);
});
