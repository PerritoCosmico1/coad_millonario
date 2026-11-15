/*
 * IRRUMPE AR — el ritmo de la música en vivo, para las luces.
 *
 * Con el micrófono (ver audio.js) mide cada cuadro:
 *   energy  0..1  qué tan fuerte suena (se ajusta solo al volumen del lugar)
 *   bass, high    graves y agudos, 0..1
 *   beat          true en el cuadro de un golpe (bombo/bajo)
 *   strength      qué tan fuerte fue el último golpe, 0..1
 *   hype    0..1  intensidad del momento: sube en las partes fuertes y con
 *                 golpes seguidos, baja en las calmas (cambia en segundos)
 *   beats         golpes contados desde el inicio
 *
 * Sin micrófono simula una canción a 120 BPM que va de calma a fuerte, para
 * que el escenario se vea vivo igual.
 */
import { pulse } from './audio.js';

export function createRitmo() {
  let analyser = null;
  let ctxRef = null;
  let data = null;
  let binHz = 23.4;
  const HIST = 45;
  const hist = new Float32Array(HIST);
  let filled = 0;
  let pos = 0;
  let prevBass = 0;
  let peak = 0.12;
  let lastBeat = -1e9;
  let lastT = 0;
  let beatRate = 0;
  let energyAvg = 0.3;
  let simBeat = -1;

  const out = {
    energy: 0.3, bass: 0, high: 0, beat: false, strength: 0, hype: 0.3, beats: 0, mic: false, sinceBeat: 1,
  };

  // El analizador propio usa más resolución en graves que el de audio.js.
  function attach() {
    if (!pulse.analyser || !pulse.ctx || !pulse.stream) { analyser = null; ctxRef = null; return false; }
    if (ctxRef === pulse.ctx && analyser) return true;
    ctxRef = pulse.ctx;
    analyser = ctxRef.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.15;
    // Margen para salas fuertes: sin esto, con volumen alto todo queda al máximo.
    analyser.minDecibels = -90;
    analyser.maxDecibels = -8;
    ctxRef.createMediaStreamSource(pulse.stream).connect(analyser);
    data = new Uint8Array(analyser.frequencyBinCount);
    binHz = ctxRef.sampleRate / analyser.fftSize;
    filled = 0;
    return true;
  }

  const avg = (a, b) => {
    const i0 = Math.max(1, Math.round(a / binHz)), i1 = Math.max(i0 + 1, Math.round(b / binHz));
    let s = 0;
    for (let i = i0; i < i1; i++) s += data[i];
    return s / ((i1 - i0) * 255);
  };

  function fromMic(t) {
    analyser.getByteFrequencyData(data);
    const bass = avg(40, 150);
    const mid = avg(150, 2000);
    const high = avg(4000, 10000);
    const level = bass * 0.5 + mid * 0.35 + high * 0.15;
    peak = Math.max(peak * 0.9985, level, 0.12);
    const energy = Math.min(1, level / peak);

    // Golpe: los graves saltan sobre su promedio reciente.
    let mean = 0, sq = 0;
    const n = Math.max(1, filled);
    for (let i = 0; i < n; i++) { mean += hist[i]; sq += hist[i] * hist[i]; }
    mean /= n;
    const std = Math.sqrt(Math.max(0, sq / n - mean * mean));
    const beat = filled >= 20 && bass > mean + Math.max(0.035, 1.25 * std) && bass - prevBass > 0.015 && bass > 0.12 && t - lastBeat > 270;
    hist[pos] = bass;
    pos = (pos + 1) % HIST;
    filled = Math.min(HIST, filled + 1);
    prevBass = bass;
    return { energy, bass, high, beat, strength: beat ? Math.min(1, Math.max(0.35, (bass - mean) / 0.18)) : 0 };
  }

  // Canción de mentira: 16 tiempos tranquilos, 16 fuertes, en loop.
  function simulated(t) {
    const b = Math.floor(t / 500);
    const phase = (t % 500) / 500;
    const bar = b % 32;
    const loud = bar >= 16;
    const beat = b !== simBeat;
    simBeat = b;
    const hit = Math.pow(1 - phase, 3);
    const base = loud ? 0.78 : 0.34;
    return {
      energy: Math.min(1, base + hit * (loud ? 0.22 : 0.12)),
      bass: base * 0.8 + hit * 0.3,
      high: (loud ? 0.5 : 0.2) + 0.2 * Math.sin(t / 90),
      beat: beat && (loud || b % 2 === 0),
      strength: loud ? (bar === 16 ? 1 : 0.75) : 0.45,
    };
  }

  return {
    get mic() { return !!analyser; },
    update(t) {
      const dt = Math.min(0.1, Math.max(0.001, (t - (lastT || t - 16)) / 1000));
      lastT = t;
      const live = attach() && ctxRef.state === 'running';
      const r = live ? fromMic(t) : simulated(t);
      out.mic = live;
      out.energy += (r.energy - out.energy) * (r.energy > out.energy ? 0.6 : 0.15);
      out.bass = r.bass;
      out.high += (r.high - out.high) * 0.3;
      out.beat = r.beat;
      if (r.beat) {
        out.strength = r.strength;
        out.beats++;
        beatRate += (1 / Math.max(0.27, (t - lastBeat) / 1000) - beatRate) * 0.2;
        lastBeat = t;
      }
      out.sinceBeat = (t - lastBeat) / 1000;
      if (out.sinceBeat > 1.5) beatRate *= Math.pow(0.6, dt);
      // Intensidad del momento: sube en ~2 s y baja en ~5 s.
      energyAvg += (out.energy - energyAvg) * (1 - Math.exp(-dt / (out.energy > energyAvg ? 2 : 5)));
      const target = Math.min(1, Math.max(0, (energyAvg - 0.25) * 1.1 + Math.min(1, beatRate / 2.2) * 0.35));
      out.hype += (target - out.hype) * (1 - Math.exp(-dt / 1.2));
      return out;
    },
    state: out,
  };
}
