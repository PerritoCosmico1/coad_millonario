/*
 * IRRUMPE — en vivo, en tiempo real.
 *
 * Conecta a todos los que tienen la página o la AR abiertas a un mismo canal,
 * sin servidor propio ni cuentas: usa un broker MQTT público por WebSocket
 * (`vivo.brokers` en config.js; si uno no responde, prueba el siguiente).
 *
 * - Estado (quién toca ahora y avisos): lo publica solo el director
 *   (director.html), firmado con su llave privada. Cada página verifica la
 *   firma con la llave pública de config.js (`vivo.clave`) y descarta lo que
 *   no calce: nadie más puede cambiar quién toca ni mandar avisos. El broker
 *   lo guarda ("retenido"), así quien entra tarde lo recibe al conectarse.
 * - Reacciones: las de cada uno aparecen en el celular de todos.
 * - Presencia: cada página avisa cada 25 s que sigue abierta; con eso se
 *   cuenta (aprox.) cuántos hay conectados. No se envía ningún dato personal.
 *
 * Si no hay conexión, todo lo demás funciona igual.
 */
(function () {
  'use strict';
  const C = window.IRRUMPE_CONFIG || {};
  const CFG = C.vivo || {};
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const PREFIX = 'irrumpe/v1/' + (CFG.canal || 'sin-canal') + '/';
  const T = { estado: PREFIX + 'estado', reacciones: PREFIX + 'reacciones', presencia: PREFIX + 'presencia' };
  const REACTIONS = ['corazon', 'chispa', 'rayo'];
  const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('');

  // ---------------------------------------------------------------- MQTT 3.1.1 mínimo (QoS 0)

  function lenBytes(n) {
    const out = [];
    do {
      let b = n % 128;
      n = Math.floor(n / 128);
      if (n > 0) b |= 128;
      out.push(b);
    } while (n > 0);
    return out;
  }
  function packet(first, ...parts) {
    const body = parts.reduce((a, p) => a + p.length, 0);
    const head = [first, ...lenBytes(body)];
    const out = new Uint8Array(head.length + body);
    out.set(head);
    let o = head.length;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  function str(s) {
    const b = enc.encode(s);
    const out = new Uint8Array(b.length + 2);
    out[0] = b.length >> 8;
    out[1] = b.length & 255;
    out.set(b, 2);
    return out;
  }
  const u16 = (n) => new Uint8Array([n >> 8, n & 255]);
  const CONNECT = (id, keepalive) => packet(0x10, str('MQTT'), new Uint8Array([4, 0x02]), u16(keepalive), str(id));
  const SUBSCRIBE = (pid, topic) => packet(0x82, u16(pid), str(topic), new Uint8Array([0]));
  const PUBLISH = (topic, payload, retain) => packet(0x30 | (retain ? 1 : 0), str(topic), enc.encode(payload));
  const PINGREQ = new Uint8Array([0xc0, 0]);
  const DISCONNECT = new Uint8Array([0xe0, 0]);

  // Conexión con reintentos (1 s, 2 s, 4 s… hasta 30 s), rotando entre brokers.
  function Client(urls, onMessage, onStatus) {
    const id = 'irrumpe-' + randomId();
    const subs = new Set();
    let ws = null, idx = 0, attempts = 0, connected = false, closed = false;
    let buf = new Uint8Array(0), ping = 0, retry = 0, pid = 1;
    const queue = [];

    function send(p) {
      if (connected && ws && ws.readyState === 1) ws.send(p);
      else if (queue.length < 20) queue.push(p);
    }
    function schedule() {
      clearTimeout(retry);
      if (closed) return;
      const wait = Math.min(30000, 1000 * 2 ** attempts++) + Math.random() * 500;
      retry = setTimeout(open, wait);
    }
    function handle(type, flags, p) {
      if (type === 2) { // CONNACK
        if (p[1] !== 0) { ws.close(); return; }
        connected = true;
        attempts = 0;
        for (const t of subs) ws.send(SUBSCRIBE(pid++, t));
        while (queue.length) ws.send(queue.shift());
        clearInterval(ping);
        ping = setInterval(() => { if (ws && ws.readyState === 1) ws.send(PINGREQ); }, 25000);
        onStatus(true);
      } else if (type === 3) { // PUBLISH
        const tl = (p[0] << 8) | p[1];
        const topic = dec.decode(p.subarray(2, 2 + tl));
        const qos = (flags >> 1) & 3;
        const payload = dec.decode(p.subarray(2 + tl + (qos ? 2 : 0)));
        try { onMessage(topic, payload); } catch (e) { /* un mensaje raro no corta la conexión */ }
      }
    }
    function onData(data) {
      const add = new Uint8Array(data);
      const merged = new Uint8Array(buf.length + add.length);
      merged.set(buf);
      merged.set(add, buf.length);
      buf = merged;
      for (;;) {
        if (buf.length < 2) return;
        let len = 0, mult = 1, i = 1, b;
        do {
          if (i >= buf.length) return;
          b = buf[i++];
          len += (b & 127) * mult;
          mult *= 128;
        } while (b & 128);
        if (buf.length < i + len) return;
        handle(buf[0] >> 4, buf[0] & 15, buf.subarray(i, i + len));
        buf = buf.slice(i + len);
      }
    }
    function open() {
      if (closed) return;
      const url = urls[idx % urls.length];
      buf = new Uint8Array(0);
      try {
        ws = new WebSocket(url, ['mqtt']);
      } catch (e) {
        idx++;
        schedule();
        return;
      }
      ws.binaryType = 'arraybuffer';
      const giveUp = setTimeout(() => { if (!connected) ws.close(); }, 8000);
      ws.onopen = () => ws.send(CONNECT(id, 60));
      ws.onmessage = (e) => { if (typeof e.data !== 'string') onData(e.data); };
      ws.onclose = () => {
        clearTimeout(giveUp);
        clearInterval(ping);
        const was = connected;
        connected = false;
        if (was) onStatus(false);
        else idx++; // no llegó a conectar: probar el siguiente broker
        schedule();
      };
    }
    open();

    return {
      subscribe(topic) {
        subs.add(topic);
        if (connected) ws.send(SUBSCRIBE(pid++, topic));
      },
      publish(topic, payload, retain) { send(PUBLISH(topic, payload, retain)); },
      // Al volver a la página: reconectar ya, sin esperar el próximo reintento.
      wake() {
        if (closed || connected || (ws && ws.readyState === 0)) return;
        attempts = 0;
        clearTimeout(retry);
        open();
      },
      close() {
        closed = true;
        clearTimeout(retry);
        clearInterval(ping);
        try { if (connected) ws.send(DISCONNECT); ws.close(); } catch (e) { /* ya cerrado */ }
      },
      get connected() { return connected; },
    };
  }

  // ---------------------------------------------------------------- firmas (ECDSA P-256)

  const b64u = {
    enc(buf) {
      let s = '';
      for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
      return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    dec(str) {
      const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
      return Uint8Array.from(s, (c) => c.charCodeAt(0));
    },
  };
  const ALG = { name: 'ECDSA', namedCurve: 'P-256' };
  const SIG = { name: 'ECDSA', hash: 'SHA-256' };
  const publicOf = (jwk) => ({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y });

  let verifyKey = null;
  function getVerifyKey() {
    if (!CFG.clave || !window.crypto || !crypto.subtle) return Promise.resolve(null);
    if (!verifyKey) verifyKey = crypto.subtle.importKey('jwk', publicOf(CFG.clave), ALG, false, ['verify']).catch(() => null);
    return verifyKey;
  }
  async function verify(raw) {
    const key = await getVerifyKey();
    if (!key) return null;
    const msg = JSON.parse(raw);
    if (typeof msg.d !== 'string' || typeof msg.s !== 'string') return null;
    const ok = await crypto.subtle.verify(SIG, key, b64u.dec(msg.s), enc.encode(msg.d));
    return ok ? JSON.parse(msg.d) : null;
  }
  async function sign(privateJwk, data) {
    const key = await crypto.subtle.importKey('jwk', privateJwk, ALG, false, ['sign']);
    const d = JSON.stringify(data);
    const s = await crypto.subtle.sign(SIG, key, enc.encode(d));
    return JSON.stringify({ d, s: b64u.enc(s) });
  }
  async function generateKeys() {
    const pair = await crypto.subtle.generateKey(ALG, true, ['sign', 'verify']);
    const priv = await crypto.subtle.exportKey('jwk', pair.privateKey);
    return { privada: { kty: priv.kty, crv: priv.crv, x: priv.x, y: priv.y, d: priv.d }, publica: publicOf(priv) };
  }

  // ---------------------------------------------------------------- conexión del público

  const MAX_AGE = 24 * 3600e3; // un estado de hace más de un día ya no vale

  // handlers: onState(estado), onReaction({ r, p }), onPresence(n), onStatus(conectado)
  function connect(handlers) {
    const h = Object.assign({ onState() {}, onReaction() {}, onPresence() {}, onStatus() {} }, handlers);
    const brokers = CFG.brokers || [];
    if (!CFG.canal || !brokers.length || !window.WebSocket) return null;
    const me = randomId();
    const seen = new Map();
    let lastT = 0;
    let inbound = [];

    const client = Client(brokers, async (topic, payload) => {
      if (topic === T.estado) {
        if (!payload) return;
        const state = await verify(payload).catch(() => null);
        if (!state || typeof state.t !== 'number' || state.t <= lastT || Date.now() - state.t > MAX_AGE) return;
        lastT = state.t;
        h.onState(state);
      } else if (topic === T.reacciones) {
        const m = JSON.parse(payload);
        if (m.id === me || !REACTIONS.includes(m.r)) return;
        // A lo más 12 reacciones ajenas por segundo, para no saturar la pantalla.
        const now = Date.now();
        inbound = inbound.filter((t) => now - t < 1000);
        if (inbound.length >= 12) return;
        inbound.push(now);
        h.onReaction({ r: m.r, p: Number.isInteger(m.p) ? m.p : -1 });
      } else if (topic === T.presencia) {
        const m = JSON.parse(payload);
        if (typeof m.id === 'string' && m.id !== me) seen.set(m.id, Date.now());
      }
    }, (on) => {
      h.onStatus(on);
      if (on) beat();
    });
    client.subscribe(T.estado);
    client.subscribe(T.reacciones);
    client.subscribe(T.presencia);

    function beat() { client.publish(T.presencia, JSON.stringify({ id: me })); }
    function count() {
      const now = Date.now();
      for (const [id, t] of seen) if (now - t > 70000) seen.delete(id);
      h.onPresence(client.connected ? seen.size + 1 : 0);
    }
    const beatTimer = setInterval(beat, 25000);
    const countTimer = setInterval(count, 5000);
    const onVisible = () => { if (document.visibilityState === 'visible') { client.wake(); beat(); } };
    document.addEventListener('visibilitychange', onVisible);

    // Máximo ~2 reacciones por segundo de cada persona.
    let sent = [];
    return {
      react(r, p) {
        if (!REACTIONS.includes(r)) return;
        const now = Date.now();
        sent = sent.filter((t) => now - t < 3000);
        if (sent.length >= 6) return;
        sent.push(now);
        client.publish(T.reacciones, JSON.stringify({ id: me, r, p: Number.isInteger(p) ? p : -1 }));
      },
      // Solo para el director: el estado ya firmado, retenido en el broker.
      publishState(raw) { client.publish(T.estado, raw, true); },
      stop() {
        clearInterval(beatTimer);
        clearInterval(countTimer);
        document.removeEventListener('visibilitychange', onVisible);
        client.close();
      },
      get connected() { return client.connected; },
    };
  }

  // ---------------------------------------------------------------- director

  // Publica el estado firmado (y retenido): { vivo: id | '' | null, aviso: { texto, t } | null }.
  function director(privateJwk, handlers) {
    const conn = connect(handlers);
    if (!conn) return null;
    return {
      async publish(state) {
        const data = Object.assign({ v: 1 }, state, { t: Date.now() });
        conn.publishState(await sign(privateJwk, data));
        return data;
      },
      stop() { conn.stop(); },
      get connected() { return conn.connected; },
    };
  }

  window.IrrumpeVivo = {
    enabled: !!(CFG.canal && (CFG.brokers || []).length),
    signed: !!CFG.clave,
    connect,
    director,
    generateKeys,
    publicOf,
    // La llave privada calza con la pública de config.js.
    matches: (jwk) => !!(CFG.clave && jwk && jwk.x === CFG.clave.x && jwk.y === CFG.clave.y),
  };
})();
