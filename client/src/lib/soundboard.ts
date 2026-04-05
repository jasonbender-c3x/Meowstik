/**
 * Soundboard synthesizer — pure Web Audio API, no audio files needed.
 * Every sound is procedurally generated.
 */

let _ctx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!_ctx || _ctx.state === "closed") {
    _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

// ─── Utility helpers ─────────────────────────────────────────────────────────

function masterGain(ac: AudioContext, vol: number): GainNode {
  const g = ac.createGain();
  g.gain.value = Math.max(0, Math.min(1, vol));
  g.connect(ac.destination);
  return g;
}

function osc(
  ac: AudioContext,
  dest: AudioNode,
  type: OscillatorType,
  freq: number,
  start: number,
  end: number
): OscillatorNode {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.connect(dest);
  o.start(start);
  o.stop(end);
  return o;
}

function envelope(ac: AudioContext, dest: AudioNode, atk: number, rel: number, startTime: number, duration: number): GainNode {
  const g = ac.createGain();
  g.gain.setValueAtTime(0, startTime);
  g.gain.linearRampToValueAtTime(1, startTime + atk);
  g.gain.linearRampToValueAtTime(0, startTime + duration);
  g.connect(dest);
  return g;
}

function noise(ac: AudioContext, bufSize = ac.sampleRate * 2): AudioBufferSourceNode {
  const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  return src;
}

// ─── Individual synths ────────────────────────────────────────────────────────

function playWompWomp(vol = 0.8) {
  const ac = ctx(), mg = masterGain(ac, vol);
  const now = ac.currentTime;
  const g = ac.createGain();
  g.connect(mg);
  // Two descending sawtooth notes: "womp... womp"
  for (let i = 0; i < 2; i++) {
    const t = now + i * 0.55;
    const eg = ac.createGain();
    eg.gain.setValueAtTime(0.8, t);
    eg.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    eg.connect(g);
    const o = ac.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(300 - i * 40, t);
    o.frequency.exponentialRampToValueAtTime(80 - i * 20, t + 0.45);
    o.connect(eg);
    o.start(t); o.stop(t + 0.5);
  }
}

function playWompWompLong(vol = 0.8) {
  const ac = ctx(), mg = masterGain(ac, vol);
  const now = ac.currentTime;
  const g = ac.createGain();
  g.connect(mg);
  for (let i = 0; i < 4; i++) {
    const t = now + i * 0.5;
    const eg = ac.createGain();
    eg.gain.setValueAtTime(0.7, t);
    eg.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
    eg.connect(g);
    const o = ac.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(280 - i * 35, t);
    o.frequency.exponentialRampToValueAtTime(70 - i * 10, t + 0.45);
    o.connect(eg);
    o.start(t); o.stop(t + 0.5);
  }
}

function playRimshot(vol = 0.9) {
  const ac = ctx(), mg = masterGain(ac, vol);
  const now = ac.currentTime;

  // Snare (filtered noise burst)
  const sn = noise(ac);
  const snF = ac.createBiquadFilter();
  snF.type = "bandpass"; snF.frequency.value = 2500; snF.Q.value = 0.7;
  const snG = ac.createGain();
  snG.gain.setValueAtTime(1, now);
  snG.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  sn.connect(snF); snF.connect(snG); snG.connect(mg);
  sn.start(now); sn.stop(now + 0.15);

  // Bass kick
  const ko = ac.createOscillator();
  ko.type = "sine"; ko.frequency.setValueAtTime(160, now);
  ko.frequency.exponentialRampToValueAtTime(40, now + 0.1);
  const kg = ac.createGain();
  kg.gain.setValueAtTime(1, now);
  kg.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  ko.connect(kg); kg.connect(mg);
  ko.start(now); ko.stop(now + 0.12);

  // Hi-hat ping (after)
  const t2 = now + 0.22;
  const hat = noise(ac);
  const hatF = ac.createBiquadFilter();
  hatF.type = "highpass"; hatF.frequency.value = 8000;
  const hatG = ac.createGain();
  hatG.gain.setValueAtTime(0.7, t2);
  hatG.gain.exponentialRampToValueAtTime(0.001, t2 + 0.08);
  hat.connect(hatF); hatF.connect(hatG); hatG.connect(mg);
  hat.start(t2); hat.stop(t2 + 0.1);
}

function playAirhorn(vol = 0.85) {
  const ac = ctx(), mg = masterGain(ac, vol);
  const now = ac.currentTime;
  const dur = 1.2;

  const g = ac.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(1, now + 0.03);
  g.gain.setValueAtTime(1, now + dur - 0.1);
  g.gain.linearRampToValueAtTime(0, now + dur);
  g.connect(mg);

  // Fundamental + harmonics
  [[220, 1], [440, 0.6], [660, 0.4], [880, 0.25]].forEach(([freq, amp]) => {
    const o = ac.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = freq as number;
    const og = ac.createGain(); og.gain.value = amp as number;
    o.connect(og); og.connect(g);
    o.start(now); o.stop(now + dur);
  });
}

function playFart(vol = 0.8) {
  const ac = ctx(), mg = masterGain(ac, vol);
  const now = ac.currentTime;
  const dur = 0.4 + Math.random() * 0.3;

  // Modulated noise with descending low-pass filter — the classic technique
  const src = noise(ac);
  const filt = ac.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.setValueAtTime(600, now);
  filt.frequency.exponentialRampToValueAtTime(80, now + dur);
  filt.Q.value = 8;

  // Add a sub-bass rumble oscillator
  const rumble = ac.createOscillator();
  rumble.type = "square";
  rumble.frequency.setValueAtTime(90 + Math.random() * 40, now);
  rumble.frequency.exponentialRampToValueAtTime(40, now + dur);

  const eg = ac.createGain();
  eg.gain.setValueAtTime(0, now);
  eg.gain.linearRampToValueAtTime(1, now + 0.02);
  eg.gain.setValueAtTime(0.9, now + dur * 0.3);
  eg.gain.exponentialRampToValueAtTime(0.001, now + dur);

  // Slight pitch wobble for realism
  const wobble = ac.createOscillator();
  wobble.type = "sine";
  wobble.frequency.value = 8 + Math.random() * 5;
  const wobbleG = ac.createGain();
  wobbleG.gain.value = 30;
  wobble.connect(wobbleG);
  wobbleG.connect(filt.frequency);
  wobble.start(now); wobble.stop(now + dur);

  src.connect(filt);
  rumble.connect(filt);
  filt.connect(eg);
  eg.connect(mg);

  src.start(now); src.stop(now + dur);
  rumble.start(now); rumble.stop(now + dur);
}

function playFartLong(vol = 0.8) {
  const ac = ctx(), mg = masterGain(ac, vol);
  const now = ac.currentTime;
  const dur = 1.8;

  const src = noise(ac);
  const filt = ac.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.setValueAtTime(700, now);
  // Warble in the middle, then trail off
  filt.frequency.linearRampToValueAtTime(900, now + 0.6);
  filt.frequency.exponentialRampToValueAtTime(60, now + dur);
  filt.Q.value = 6;

  const rumble = ac.createOscillator();
  rumble.type = "square";
  rumble.frequency.setValueAtTime(100, now);
  rumble.frequency.linearRampToValueAtTime(120, now + 0.7);
  rumble.frequency.exponentialRampToValueAtTime(35, now + dur);

  const eg = ac.createGain();
  eg.gain.setValueAtTime(0, now);
  eg.gain.linearRampToValueAtTime(0.95, now + 0.03);
  eg.gain.setValueAtTime(0.9, now + dur - 0.3);
  eg.gain.exponentialRampToValueAtTime(0.001, now + dur);

  // More intense wobble for the long version
  const wobble = ac.createOscillator();
  wobble.type = "sine"; wobble.frequency.value = 6;
  const wobbleG = ac.createGain(); wobbleG.gain.value = 50;
  wobble.connect(wobbleG); wobbleG.connect(filt.frequency);
  wobble.start(now); wobble.stop(now + dur);

  src.connect(filt); rumble.connect(filt); filt.connect(eg); eg.connect(mg);
  src.start(now); src.stop(now + dur);
  rumble.start(now); rumble.stop(now + dur);
}

function playCrickets(vol = 0.5) {
  const ac = ctx(), mg = masterGain(ac, vol);
  const now = ac.currentTime;
  const dur = 3.5;

  // Amplitude-modulated narrow-band noise at cricket chirp frequency (~4kHz)
  const src = noise(ac);
  const filt = ac.createBiquadFilter();
  filt.type = "bandpass"; filt.frequency.value = 4200; filt.Q.value = 10;

  // Chirp rhythm: ~3 chirps/second
  const lfo = ac.createOscillator();
  lfo.type = "square"; lfo.frequency.value = 3;
  const lfoG = ac.createGain(); lfoG.gain.value = 0.5;
  const lfoOffset = ac.createGain(); lfoOffset.gain.value = 0.5;

  // Manually create AM: multiply signal by (0.5 + 0.5*lfo)
  const am = ac.createGain();
  am.gain.value = 0;
  lfo.connect(lfoG); lfoG.connect(am.gain);

  const eg = ac.createGain();
  eg.gain.setValueAtTime(0, now);
  eg.gain.linearRampToValueAtTime(0.8, now + 0.3);
  eg.gain.setValueAtTime(0.8, now + dur - 0.5);
  eg.gain.linearRampToValueAtTime(0, now + dur);

  src.connect(filt); filt.connect(am); am.connect(eg); eg.connect(mg);
  lfo.start(now); lfo.stop(now + dur);
  src.start(now); src.stop(now + dur);
}

function playPriceIsWrong(vol = 0.8) {
  const ac = ctx(), mg = masterGain(ac, vol);
  const now = ac.currentTime;
  // Descending "wrong answer" melody
  const notes = [523, 494, 440, 392, 349, 294];
  notes.forEach((freq, i) => {
    const t = now + i * 0.12;
    const o = ac.createOscillator();
    o.type = "square"; o.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g); g.connect(mg);
    o.start(t); o.stop(t + 0.15);
  });
}

function playLaughTrack(vol = 0.6) {
  const ac = ctx(), mg = masterGain(ac, vol);
  const now = ac.currentTime;
  // Multiple noise bursts at vocal frequencies to simulate crowd laughter
  for (let i = 0; i < 12; i++) {
    const t = now + i * 0.07 + Math.random() * 0.04;
    const src = noise(ac);
    const f = ac.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 400 + Math.random() * 800;
    f.Q.value = 3 + Math.random() * 5;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.15 + Math.random() * 0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12 + Math.random() * 0.1);
    src.connect(f); f.connect(g); g.connect(mg);
    src.start(t); src.stop(t + 0.25);
  }
}

function playJingle(vol = 0.7) {
  const ac = ctx(), mg = masterGain(ac, vol);
  const now = ac.currentTime;
  // "Da-da-da-DAAAA!" ascending fanfare
  const melody = [
    [0, 523, 0.15], [0.18, 659, 0.15], [0.36, 784, 0.15], [0.54, 1047, 0.45]
  ] as [number, number, number][];
  melody.forEach(([dt, freq, dur]) => {
    const t = now + dt;
    const o = ac.createOscillator();
    o.type = "triangle"; o.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(mg);
    o.start(t); o.stop(t + dur);
  });
}

function playNewsIntro(vol = 0.8) {
  const ac = ctx(), mg = masterGain(ac, vol);
  const now = ac.currentTime;
  // Dramatic news sting: low rumble + high stab
  const stabs = [[0, 880], [0.15, 1100], [0.3, 660]];
  stabs.forEach(([dt, freq]) => {
    const t = now + dt;
    const o = ac.createOscillator();
    o.type = "square"; o.frequency.value = freq as number;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g); g.connect(mg);
    o.start(t); o.stop(t + 0.2);
  });
  // Bass rumble
  const rb = noise(ac);
  const rbF = ac.createBiquadFilter(); rbF.type = "lowpass"; rbF.frequency.value = 150;
  const rbG = ac.createGain();
  rbG.gain.setValueAtTime(0.6, now);
  rbG.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  rb.connect(rbF); rbF.connect(rbG); rbG.connect(mg);
  rb.start(now); rb.stop(now + 0.7);
}

function playAlarmClock(vol = 0.75) {
  const ac = ctx(), mg = masterGain(ac, vol);
  const now = ac.currentTime;
  for (let i = 0; i < 8; i++) {
    const t = now + i * 0.3;
    const o = ac.createOscillator();
    o.type = "square"; o.frequency.value = 880;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.6, t);
    g.gain.setValueAtTime(0.6, t + 0.14);
    g.gain.setValueAtTime(0, t + 0.15);
    o.connect(g); g.connect(mg);
    o.start(t); o.stop(t + 0.2);
  }
}

function playGentleWake(vol = 0.65) {
  const ac = ctx(), mg = masterGain(ac, vol);
  const now = ac.currentTime;
  // Rising sine sweep
  const o = ac.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(200, now);
  o.frequency.exponentialRampToValueAtTime(800, now + 2);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.6, now + 0.3);
  g.gain.setValueAtTime(0.6, now + 1.7);
  g.gain.linearRampToValueAtTime(0, now + 2);
  o.connect(g); g.connect(mg);
  o.start(now); o.stop(now + 2.1);
}

function playPillReminder(vol = 0.7) {
  const ac = ctx(), mg = masterGain(ac, vol);
  const now = ac.currentTime;
  // Friendly two-tone chime, repeated twice
  const pairs = [[0, 0.5], [0.8, 0.5]];
  pairs.forEach(([dt]) => {
    const t = now + dt;
    [523, 659].forEach((freq, j) => {
      const st = t + j * 0.18;
      const o = ac.createOscillator();
      o.type = "sine"; o.frequency.value = freq;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.6, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.3);
      o.connect(g); g.connect(mg);
      o.start(st); o.stop(st + 0.35);
    });
  });
}

function playUrgentAlarm(vol = 0.85) {
  const ac = ctx(), mg = masterGain(ac, vol);
  const now = ac.currentTime;
  for (let i = 0; i < 12; i++) {
    const t = now + i * 0.12;
    const freq = i % 2 === 0 ? 1200 : 800;
    const o = ac.createOscillator();
    o.type = "square"; o.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g); g.connect(mg);
    o.start(t); o.stop(t + 0.12);
  }
}

function playDing(vol = 0.7) {
  const ac = ctx(), mg = masterGain(ac, vol);
  const now = ac.currentTime;
  const o = ac.createOscillator();
  o.type = "sine"; o.frequency.value = 1047; // high C
  const g = ac.createGain();
  g.gain.setValueAtTime(0.8, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
  o.connect(g); g.connect(mg);
  o.start(now); o.stop(now + 1.3);
}

function playSuccess(vol = 0.75) {
  const ac = ctx(), mg = masterGain(ac, vol);
  const now = ac.currentTime;
  const notes = [523, 659, 784, 1047]; // C E G C ascending
  notes.forEach((freq, i) => {
    const t = now + i * 0.12;
    const o = ac.createOscillator();
    o.type = "triangle"; o.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g); g.connect(mg);
    o.start(t); o.stop(t + 0.4);
  });
}

function playErrorBuzz(vol = 0.7) {
  const ac = ctx(), mg = masterGain(ac, vol);
  const now = ac.currentTime;
  const o = ac.createOscillator();
  o.type = "sawtooth"; o.frequency.value = 180;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.8, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  o.connect(g); g.connect(mg);
  o.start(now); o.stop(now + 0.35);
}

function playLevelUp(vol = 0.75) {
  const ac = ctx(), mg = masterGain(ac, vol);
  const now = ac.currentTime;
  const notes = [392, 523, 659, 784, 1047]; // G C E G C
  notes.forEach((freq, i) => {
    const t = now + i * 0.1;
    const o = ac.createOscillator();
    o.type = "square"; o.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g); g.connect(mg);
    o.start(t); o.stop(t + 0.28);
  });
}

function playIncoming(vol = 0.65) {
  const ac = ctx(), mg = masterGain(ac, vol);
  const now = ac.currentTime;
  // Three-ring phone pattern
  for (let r = 0; r < 2; r++) {
    const base = now + r * 1.2;
    for (let b = 0; b < 2; b++) {
      const t = base + b * 0.4;
      const o = ac.createOscillator();
      o.type = "sine"; o.frequency.value = 480;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.setValueAtTime(0.5, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g); g.connect(mg);
      o.start(t); o.stop(t + 0.38);
    }
  }
}

function playTrafficAlert(vol = 0.65) {
  const ac = ctx(), mg = masterGain(ac, vol);
  const now = ac.currentTime;
  [0, 0.2, 0.4].forEach(dt => {
    const t = now + dt;
    const o = ac.createOscillator();
    o.type = "square"; o.frequency.value = 700;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g); g.connect(mg);
    o.start(t); o.stop(t + 0.18);
  });
}

function playWeatherBeep(vol = 0.6) {
  const ac = ctx(), mg = masterGain(ac, vol);
  const now = ac.currentTime;
  [0, 0.25].forEach(dt => {
    const t = now + dt;
    const o = ac.createOscillator();
    o.type = "sine"; o.frequency.value = 1200;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g); g.connect(mg);
    o.start(t); o.stop(t + 0.2);
  });
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

const SYNTHS: Record<string, (vol?: number) => void> = {
  womp_womp:      playWompWomp,
  womp_womp_long: playWompWompLong,
  rimshot:        playRimshot,
  airhorn:        playAirhorn,
  fart:           playFart,
  fart_long:      playFartLong,
  crickets:       playCrickets,
  price_is_wrong: playPriceIsWrong,
  laugh_track:    playLaughTrack,
  jingle:         playJingle,
  news_intro:     playNewsIntro,
  traffic_alert:  playTrafficAlert,
  weather_beep:   playWeatherBeep,
  alarm_clock:    playAlarmClock,
  gentle_wake:    playGentleWake,
  pill_reminder:  playPillReminder,
  urgent_alarm:   playUrgentAlarm,
  ding:           playDing,
  success:        playSuccess,
  error_buzz:     playErrorBuzz,
  level_up:       playLevelUp,
  incoming:       playIncoming,
};

export function playSound(soundId: string, volume = 0.8): boolean {
  const fn = SYNTHS[soundId];
  if (!fn) {
    console.warn(`[soundboard] Unknown sound: ${soundId}`);
    return false;
  }
  try {
    fn(volume);
    return true;
  } catch (e) {
    console.error(`[soundboard] Error playing ${soundId}:`, e);
    return false;
  }
}

export function getSoundIds(): string[] {
  return Object.keys(SYNTHS);
}
