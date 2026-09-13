let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

function getCtx(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ac.currentTime + delay;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  move() {
    tone(180, 0.07, "sine", 0.05);
  },
  merge(value: number) {
    const step = Math.min(10, Math.log2(Math.max(value, 2)) - 1);
    tone(300 + step * 55, 0.12, "triangle", 0.07);
    tone(450 + step * 70, 0.1, "sine", 0.04, 0.04);
  },
  power() {
    tone(520, 0.08, "square", 0.04);
    tone(700, 0.08, "square", 0.035, 0.06);
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, "triangle", 0.07, i * 0.11));
  },
  lose() {
    [400, 330, 250].forEach((f, i) => tone(f, 0.26, "sine", 0.06, i * 0.12));
  },
  click() {
    tone(640, 0.05, "sine", 0.035);
  },
};
