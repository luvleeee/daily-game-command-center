/**
 * Haptics + tiny synthesized sounds (no audio files → works offline, ~0 KB).
 * Toggled from Settings via setFeedbackPrefs().
 */
let prefs = { haptics: true, sounds: false };
export const setFeedbackPrefs = (p) => {
  prefs = { ...prefs, ...p };
};

export function haptic(pattern = 10) {
  if (!prefs.haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported (iOS Safari) */
  }
}

let ctx;
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, { duration = 0.12, type = 'sine', gain = 0.08, delay = 0 } = {}) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

export const sound = {
  done() {
    if (!prefs.sounds) return;
    tone(660, { duration: 0.09 });
    tone(990, { duration: 0.14, delay: 0.07 });
  },
  tick() {
    if (!prefs.sounds) return;
    tone(1400, { duration: 0.025, type: 'square', gain: 0.025 });
  },
  win() {
    if (!prefs.sounds) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, { duration: 0.18, delay: i * 0.08, type: 'triangle' }));
  },
  undo() {
    if (!prefs.sounds) return;
    tone(440, { duration: 0.08, type: 'triangle' });
  },
};
