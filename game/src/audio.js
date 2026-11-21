// Nightshade: The Quiet Heist — sound, all synthesised in the browser.
// No audio files: every sound is an oscillator or filtered noise through
// the Web Audio API. Guard footsteps are panned left/right and faded
// with distance, so you can hear where a guard is without looking.

let ctx = null;
let master = null;
let muted = false;

function ensure() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  return ctx;
}

export function setMuted(value) {
  muted = value;
  if (master) master.gain.value = muted ? 0 : 0.5;
}

export function isMuted() {
  return muted;
}

// A short tone that slides from one frequency to another.
function tone(freqFrom, freqTo, seconds, type, volume, when = 0, pan = 0) {
  if (!ensure() || muted) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  osc.type = type;
  osc.frequency.setValueAtTime(freqFrom, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), t0 + seconds);
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
  osc.connect(gain);
  if (panner) {
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    gain.connect(panner);
    panner.connect(master);
  } else {
    gain.connect(master);
  }
  osc.start(t0);
  osc.stop(t0 + seconds + 0.02);
}

// A burst of filtered noise (footsteps, smoke, coins).
function noiseBurst(seconds, filterFreq, volume, when = 0, pan = 0) {
  if (!ensure() || muted) return;
  const t0 = ctx.currentTime + when;
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  src.connect(filter);
  filter.connect(gain);
  if (panner) {
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    gain.connect(panner);
    panner.connect(master);
  } else {
    gain.connect(master);
  }
  src.start(t0);
}

// The player's own step: a soft tap, quieter while sneaking.
export function playPlayerStep(sneak) {
  noiseBurst(0.06, sneak ? 300 : 700, sneak ? 0.08 : 0.16);
}

// A guard's step: volume and stereo pan follow its position relative
// to the player, so footsteps tell you where a guard is.
export function playGuardStep(gx, gy, px, py) {
  const dx = gx - px;
  const dy = gy - py;
  const dist = Math.hypot(dx, dy);
  if (dist > 11) return;
  const volume = 0.22 * Math.max(0, 1 - dist / 11);
  const pan = Math.max(-0.9, Math.min(0.9, dx / 6));
  noiseBurst(0.07, 500, volume, 0, pan);
}

export function playPickup() {
  tone(880, 1320, 0.12, 'sine', 0.2);
  tone(1320, 1760, 0.14, 'sine', 0.16, 0.08);
}

export function playGem() {
  tone(660, 990, 0.16, 'triangle', 0.22);
  tone(990, 1480, 0.18, 'triangle', 0.2, 0.1);
  tone(1480, 1980, 0.22, 'triangle', 0.18, 0.2);
}

export function playAlarm() {
  tone(220, 180, 0.28, 'sawtooth', 0.22);
  tone(220, 180, 0.28, 'sawtooth', 0.22, 0.3);
  tone(440, 330, 0.4, 'sawtooth', 0.16, 0.62);
}

export function playCaught() {
  tone(392, 98, 0.7, 'sawtooth', 0.24);
  tone(196, 49, 0.8, 'triangle', 0.2, 0.1);
}

export function playCoinThrow() {
  noiseBurst(0.08, 4000, 0.1);
}

export function playCoinLand() {
  tone(2400, 1800, 0.07, 'square', 0.1);
  tone(1800, 1200, 0.09, 'square', 0.08, 0.07);
}

export function playSmoke() {
  noiseBurst(0.35, 900, 0.2);
}

export function playWin() {
  tone(523, 523, 0.14, 'triangle', 0.2);
  tone(659, 659, 0.14, 'triangle', 0.2, 0.13);
  tone(784, 784, 0.14, 'triangle', 0.2, 0.26);
  tone(1047, 1047, 0.3, 'triangle', 0.22, 0.39);
}

export function playClick() {
  tone(1200, 900, 0.05, 'sine', 0.12);
}
