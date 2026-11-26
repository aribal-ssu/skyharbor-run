// Skyharbor Run — synthesized sound, no audio files.
// A sawtooth through a lowpass filter stands in for the engine (pitch and
// growl follow throttle), and looped filtered noise is the wind (volume
// follows airspeed). Everything is a safe no-op without WebAudio.

export class EngineAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.started = false;
  }

  // Must be called from a user gesture at least once.
  start() {
    if (this.started) return;
    this.started = true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = new AC();
      this.ctx = ctx;

      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(ctx.destination);

      // Engine: sawtooth -> lowpass -> gain.
      this.engineOsc = ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 52;
      this.engineFilter = ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 320;
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();

      // Wind: white noise buffer -> bandpass -> gain.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.windSource = ctx.createBufferSource();
      this.windSource.buffer = buffer;
      this.windSource.loop = true;
      this.windFilter = ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 480;
      this.windFilter.Q.value = 0.6;
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      this.windSource.connect(this.windFilter).connect(this.windGain).connect(this.master);
      this.windSource.start();
    } catch {
      this.ctx = null;
    }
  }

  // One-shot cue: a soft two-tone chirp for a ring threaded. Routed
  // through the master gain, so mute still applies; no-op pre-start.
  blip() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(840, t);
    osc.frequency.exponentialRampToValueAtTime(1420, t + 0.09);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  // One-shot cue: a low, soft thud for rubber meeting runway.
  thump() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(74, t);
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.18);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
    }
  }

  // Called every frame with the plane state.
  update(state) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const running = state.status === 'flying';
    const throttle = running ? state.throttle : 0;
    this.engineOsc.frequency.setTargetAtTime(50 + throttle * 68 + state.speed * 0.22, t, 0.09);
    this.engineFilter.frequency.setTargetAtTime(260 + throttle * 620, t, 0.09);
    this.engineGain.gain.setTargetAtTime(running ? 0.028 + throttle * 0.075 : 0, t, 0.12);
    this.windGain.gain.setTargetAtTime(running ? Math.min(0.16, state.speed * 0.0022) : 0, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(320 + state.speed * 9, t, 0.2);
  }
}

// Named-export cue helpers: fire one-shot sounds through an EngineAudio
// instance without reaching into the class. Safe with null / unstarted
// instances — the methods themselves no-op without a context.
export function ringBlip(audio) {
  if (audio) audio.blip();
}

export function touchdownThump(audio) {
  if (audio) audio.thump();
}
