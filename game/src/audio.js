// Sound, synthesized only: WebAudio oscillators and filtered noise — no audio
// files. Engine hum, two-tone sirens, gunshots, pickups, and a small ambient
// music loop (bassline + hats). Everything is guarded so the game plays fine
// with audio off (screenshot mode never initialises it).
export function createAudio() {
  const audio = {
    ctx: null, master: null, muted: false, musicOn: true,
    engineOsc: null, engineGain: null, sirenOsc: null, sirenGain: null,
    nextNote: 0, beat: 0,
  };

  function ensure() {
    if (audio.ctx) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function unlock() {
    if (ensure() && audio.ctx.state === 'suspended') audio.ctx.resume();
  }

  function tone(freq, dur, type, vol, when) {
    if (!audio.ctx || audio.muted) return;
    const t = when ?? audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!audio.ctx || audio.muted) return;
    const len = Math.floor(audio.ctx.sampleRate * dur);
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = audio.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = audio.ctx.createGain();
    gain.gain.value = vol || 0.3;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    source.start();
  }

  return {
    unlock,
    toggleMute() {
      audio.muted = !audio.muted;
      if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
      return audio.muted;
    },
    get muted() { return audio.muted; },
    gunshot() { noiseBurst(0.12, 0.35, 900); },
    enemyShot() { noiseBurst(0.1, 0.18, 700); },
    pickup() { tone(660, 0.12, 'sine', 0.2); tone(990, 0.18, 'sine', 0.2, audio.ctx ? audio.ctx.currentTime + 0.08 : undefined); },
    cash() { tone(880, 0.1, 'triangle', 0.2); tone(1320, 0.16, 'triangle', 0.2, audio.ctx ? audio.ctx.currentTime + 0.07 : undefined); },
    missionDone() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.2, audio.ctx ? audio.ctx.currentTime + i * 0.11 : undefined)); },
    busted() { tone(220, 0.5, 'sawtooth', 0.2); tone(165, 0.7, 'sawtooth', 0.2, audio.ctx ? audio.ctx.currentTime + 0.4 : undefined); },
    /** Engine hum that follows the car's speed; call every frame while driving. */
    engine(speed, driving) {
      if (!ensure() || audio.muted) return;
      if (!driving) {
        if (audio.engineGain) audio.engineGain.gain.value = 0;
        return;
      }
      if (!audio.engineOsc) {
        audio.engineOsc = audio.ctx.createOscillator();
        audio.engineOsc.type = 'sawtooth';
        audio.engineGain = audio.ctx.createGain();
        audio.engineGain.gain.value = 0;
        const filter = audio.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        audio.engineOsc.connect(filter);
        filter.connect(audio.engineGain);
        audio.engineGain.connect(audio.master);
        audio.engineOsc.start();
      }
      audio.engineOsc.frequency.value = 55 + Math.abs(speed) * 0.22;
      audio.engineGain.gain.value = 0.05;
    },
    /** Two-tone siren while any police car is near; call every frame. */
    siren(active, time) {
      if (!ensure() || audio.muted) return;
      if (!active) {
        if (audio.sirenGain) audio.sirenGain.gain.value = 0;
        return;
      }
      if (!audio.sirenOsc) {
        audio.sirenOsc = audio.ctx.createOscillator();
        audio.sirenOsc.type = 'triangle';
        audio.sirenGain = audio.ctx.createGain();
        audio.sirenGain.gain.value = 0;
        audio.sirenOsc.connect(audio.sirenGain);
        audio.sirenGain.connect(audio.master);
        audio.sirenOsc.start();
      }
      audio.sirenOsc.frequency.value = Math.floor(time * 1.6) % 2 === 0 ? 720 : 960;
      audio.sirenGain.gain.value = 0.045;
    },
    /** A laid-back sunset bassline + hats, one bar at a time. */
    music(time) {
      if (!ensure() || audio.muted || !audio.musicOn) return;
      if (audio.nextNote === 0) audio.nextNote = audio.ctx.currentTime + 0.1;
      const bass = [55, 0, 65.4, 0, 49, 0, 58.3, 73.4];
      while (audio.nextNote < audio.ctx.currentTime + 0.25) {
        const step = audio.beat % 8;
        const freq = bass[step];
        if (freq) tone(freq, 0.42, 'triangle', 0.12, audio.nextNote);
        if (step % 2 === 0) noiseBurst(0.03, 0.05, 6000);
        audio.nextNote += 0.24;
        audio.beat += 1;
      }
    },
  };
}
