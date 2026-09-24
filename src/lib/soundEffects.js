/**
 * Stadium & Auction Sound Synthesizer using Modern Web Audio API
 * Generates rich, latency-free, offline audio effects for bidding, sold, unsold, and spinner events.
 */

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * 1. BID SOUND
 * Wooden auction paddle strike + crisp rising harmonic chime
 */
export function playBidSound(enabled = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Impact Gavel Click (wooden strike)
  const oscThump = ctx.createOscillator();
  const gainThump = ctx.createGain();
  oscThump.type = 'triangle';
  oscThump.frequency.setValueAtTime(320, now);
  oscThump.frequency.exponentialRampToValueAtTime(80, now + 0.06);

  gainThump.gain.setValueAtTime(0.7, now);
  gainThump.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

  oscThump.connect(gainThump);
  gainThump.connect(ctx.destination);
  oscThump.start(now);
  oscThump.stop(now + 0.07);

  // Rising Crisp Chime (880Hz -> 1320Hz, A5 -> E6)
  const oscChime = ctx.createOscillator();
  const gainChime = ctx.createGain();
  oscChime.type = 'sine';
  oscChime.frequency.setValueAtTime(880, now);
  oscChime.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

  gainChime.gain.setValueAtTime(0.35, now);
  gainChime.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  oscChime.connect(gainChime);
  gainChime.connect(ctx.destination);
  oscChime.start(now);
  oscChime.stop(now + 0.25);
}

/**
 * 2. SOLD CELEBRATION SOUND
 * Double gavel hammer strike + triumphant stadium fanfare arpeggio
 */
export function playSoldSound(enabled = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Double Gavel Strike: Strike 1 at 0s, Strike 2 at 0.16s
  [0, 0.16].forEach((delay) => {
    const t = now + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(360, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.08);

    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.09);
  });

  // Triumphant Fanfare Arpeggio: C5 (523Hz), E5 (659Hz), G5 (784Hz), C6 (1046Hz)
  const notes = [
    { freq: 523.25, time: 0.30, dur: 0.25 },
    { freq: 659.25, time: 0.44, dur: 0.25 },
    { freq: 783.99, time: 0.58, dur: 0.25 },
    { freq: 1046.5, time: 0.72, dur: 0.65 },
  ];

  notes.forEach(({ freq, time, dur }) => {
    const t = now + time;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle'; // Brassy trumpet overtone
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);

    // Harmonizer octave
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(freq * 0.5, t);

    subGain.gain.setValueAtTime(0.15, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(t);
    subOsc.stop(t + dur);
  });
}

/**
 * 3. UNSOLD SOUND
 * Solemn wooden gavel knock + soft descending tone
 */
export function playUnsoldSound(enabled = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Hollow Wood Strike
  const oscKnock = ctx.createOscillator();
  const gainKnock = ctx.createGain();
  oscKnock.type = 'triangle';
  oscKnock.frequency.setValueAtTime(260, now);
  oscKnock.frequency.exponentialRampToValueAtTime(60, now + 0.1);

  gainKnock.gain.setValueAtTime(0.7, now);
  gainKnock.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  oscKnock.connect(gainKnock);
  gainKnock.connect(ctx.destination);
  oscKnock.start(now);
  oscKnock.stop(now + 0.12);

  // Descending Gentle Bell (440Hz -> 220Hz)
  const oscDesc = ctx.createOscillator();
  const gainDesc = ctx.createGain();
  oscDesc.type = 'sine';
  oscDesc.frequency.setValueAtTime(440, now + 0.05);
  oscDesc.frequency.exponentialRampToValueAtTime(220, now + 0.45);

  gainDesc.gain.setValueAtTime(0.3, now + 0.05);
  gainDesc.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  oscDesc.connect(gainDesc);
  gainDesc.connect(ctx.destination);
  oscDesc.start(now + 0.05);
  oscDesc.stop(now + 0.5);
}

/**
 * 4. DRAW PLAYER / WHEEL SPUN SOUND
 * Energetic entrance swoosh + bright chord reveal
 */
export function playDrawPlayerSound(enabled = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Upward entrance glide (240Hz -> 720Hz)
  const oscSweep = ctx.createOscillator();
  const gainSweep = ctx.createGain();
  oscSweep.type = 'sine';
  oscSweep.frequency.setValueAtTime(240, now);
  oscSweep.frequency.exponentialRampToValueAtTime(720, now + 0.18);

  gainSweep.gain.setValueAtTime(0.001, now);
  gainSweep.gain.linearRampToValueAtTime(0.35, now + 0.05);
  gainSweep.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  oscSweep.connect(gainSweep);
  gainSweep.connect(ctx.destination);
  oscSweep.start(now);
  oscSweep.stop(now + 0.25);

  // Bright Major Chord (G4, B4, D5)
  [392.0, 493.88, 587.33].forEach((f) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, now + 0.16);

    gain.gain.setValueAtTime(0.2, now + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + 0.16);
    osc.stop(now + 0.55);
  });
}

/**
 * 5. WHEEL CLICK / SPINNING TICK SOUND
 * Short percussive click used during spinner ticks
 */
export function playSpinTickSound(enabled = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.02);

  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.025);
}

/**
 * 6. TIMER WARNING BEEP (Final 3 seconds)
 */
export function playTimerWarningSound(enabled = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(950, now);

  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.08);
}
