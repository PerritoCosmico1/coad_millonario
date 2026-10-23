/*
 * IRRUMPE AR — intensidad de la música (0..1) para las visuales.
 *
 * Con micrófono escucha lo que suena en el lugar (graves y medios) y ajusta la
 * ganancia sola. Sin micrófono simula un pulso a 118 BPM, para que el
 * prototipo se vea vivo en cualquier parte.
 */
function micGranted() {
  if (!navigator.permissions || !navigator.permissions.query) return Promise.resolve(false);
  return navigator.permissions.query({ name: 'microphone' })
    .then((st) => st.state === 'granted')
    .catch(() => false);
}

export const pulse = {
  stream: null,
  ctx: null,
  analyser: null,
  data: null,
  level: 0,
  peak: 0.05,

  get micOn() { return !!this.analyser; },

  async enableMic() {
    if (this.analyser) return true;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false,
    });
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    // Sin un toque reciente resume() puede quedar esperando: no se lo espera más de 300 ms.
    if (this.ctx.state === 'suspended') await Promise.race([this.ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 300))]);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.6;
    this.ctx.createMediaStreamSource(this.stream).connect(this.analyser);
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
    if (this.ctx.state !== 'running') {
      const wake = () => { if (this.ctx) this.ctx.resume().catch(() => {}); };
      document.addEventListener('pointerdown', wake, { once: true });
    }
    return true;
  },

  // Al ocultarse la página se suelta el micrófono. Al volver se reabre solo si
  // el permiso ya está dado (así nunca aparece un aviso de golpe); si no, queda
  // apagado hasta que se toque el botón.
  wasOn: false,
  busy: null,
  suspend() {
    if (!this.analyser) return;
    this.wasOn = true;
    this.disableMic();
  },
  resume() {
    if (!this.wasOn || this.analyser || this.busy) return this.busy || Promise.resolve();
    this.busy = micGranted()
      .then((ok) => (ok ? this.enableMic() : null))
      .catch(() => {})
      .finally(() => { this.wasOn = false; this.busy = null; });
    return this.busy;
  },

  disableMic(byUser) {
    if (byUser) this.wasOn = false;
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.ctx) this.ctx.close().catch(() => {});
    this.stream = this.ctx = this.analyser = this.data = null;
  },

  // Llamar una vez por cuadro con el tiempo en ms.
  sample(t) {
    let raw;
    // Sin un toque reciente algunos navegadores dejan el audio en pausa: mientras
    // tanto se usa el pulso de demostración.
    if (this.analyser && this.ctx.state === 'running') {
      this.analyser.getByteFrequencyData(this.data);
      // Bins ~40 Hz a ~2 kHz (con fftSize 512 y 48 kHz cada bin son ~94 Hz).
      let sum = 0;
      for (let i = 1; i < 22; i++) sum += this.data[i];
      raw = sum / (21 * 255);
      this.peak = Math.max(this.peak * 0.996, raw, 0.05);
      raw = Math.min(1, raw / this.peak);
    } else {
      const beat = ((t / 1000) * 118 / 60) % 1;
      raw = 0.2 + 0.6 * Math.pow(1 - beat, 3);
    }
    this.level += (raw - this.level) * (raw > this.level ? 0.5 : 0.12);
    return this.level;
  },
};
