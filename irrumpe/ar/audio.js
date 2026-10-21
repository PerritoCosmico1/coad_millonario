/*
 * IRRUMPE AR — intensidad de la música (0..1) para las visuales.
 *
 * Con micrófono escucha lo que suena en el lugar (graves y medios) y ajusta la
 * ganancia sola. Sin micrófono simula un pulso a 118 BPM, para que el
 * prototipo se vea vivo en cualquier parte.
 */
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
    if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {});
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.6;
    this.ctx.createMediaStreamSource(this.stream).connect(this.analyser);
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
    return true;
  },

  disableMic() {
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.ctx) this.ctx.close().catch(() => {});
    this.stream = this.ctx = this.analyser = this.data = null;
  },

  // Llamar una vez por cuadro con el tiempo en ms.
  sample(t) {
    let raw;
    if (this.analyser) {
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
