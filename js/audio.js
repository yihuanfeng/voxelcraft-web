/* ================================================================
   音频 —— 微型 WebAudio 合成器
================================================================ */
let AC = null, master = null;
export function initAudio() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain();
      master.gain.value = 0.22;
      master.connect(AC.destination);
    } catch (e) { /* 无声环境 */ }
  }
  if (AC && AC.state === 'suspended') AC.resume();
}
function tone(f0, f1, dur, type = 'sine', vol = 1) {
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, AC.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), AC.currentTime + dur);
  g.gain.setValueAtTime(vol, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
  o.connect(g); g.connect(master);
  o.start(); o.stop(AC.currentTime + dur + 0.02);
}
function noiseBurst(dur, freq, vol = 1) {
  if (!AC) return;
  const len = Math.floor(AC.sampleRate * dur);
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = AC.createBufferSource(); src.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = AC.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master);
  src.start();
}
export const sfx = {
  break:  () => noiseBurst(0.18, 700, 0.9),
  place:  () => { noiseBurst(0.06, 1400, 0.7); tone(220, 180, 0.06, 'square', 0.25); },
  punch:  () => noiseBurst(0.08, 500, 0.8),
  hurt:   () => tone(160, 70, 0.25, 'sawtooth', 0.7),
  zhit:   () => { noiseBurst(0.1, 900, 0.7); tone(130, 90, 0.12, 'square', 0.4); },
  zdie:   () => tone(140, 40, 0.5, 'sawtooth', 0.6),
  groan:  (v) => tone(95, 55, 0.8, 'sawtooth', v),
  pickup: () => tone(520, 880, 0.12, 'sine', 0.6),
  splash: () => noiseBurst(0.25, 1200, 0.5),
  drop:   () => tone(300, 200, 0.1, 'sine', 0.4),
};
