/**
 * Tiny offline DSP kit for the soundtrack: oscillators, noise, RBJ
 * biquads, envelopes, a Freeverb, and stereo placement. Everything is
 * deterministic (seeded noise), so the same cue sheet always renders the
 * same file.
 */
export const SR = 48000;

export type Stereo = { L: Float32Array; R: Float32Array };

export const stereo = (seconds: number): Stereo => {
  const n = Math.ceil(seconds * SR);
  return { L: new Float32Array(n), R: new Float32Array(n) };
};

export const len = (seconds: number) => Math.max(1, Math.round(seconds * SR));

export const semis = (p: number) => Math.pow(2, p / 12);
export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export const db = (d: number) => Math.pow(10, d / 20);

/** mulberry32 */
export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const noise = (seconds: number, seed = 1) => {
  const r = rng(seed);
  const x = new Float32Array(len(seconds));
  for (let i = 0; i < x.length; i++) x[i] = r() * 2 - 1;
  return x;
};

type Hz = number | ((t: number) => number);
const at = (f: Hz, t: number) => (typeof f === 'number' ? f : f(t));

/** Sine with a (possibly time-varying) frequency, phase-continuous. */
export const sine = (seconds: number, freq: Hz, phase = 0) => {
  const x = new Float32Array(len(seconds));
  let ph = phase;
  for (let i = 0; i < x.length; i++) {
    x[i] = Math.sin(ph);
    ph += (2 * Math.PI * at(freq, i / SR)) / SR;
  }
  return x;
};

/** Band-limited saw from a precomputed wavetable (fast, alias-free enough for pads). */
const SAW_TABLE = (() => {
  const N = 4096;
  const t = new Float32Array(N + 1);
  for (let h = 1; h <= 28; h++) for (let i = 0; i <= N; i++) t[i] += ((h % 2 ? 1 : -1) * Math.sin((2 * Math.PI * h * i) / N)) / h;
  for (let i = 0; i <= N; i++) t[i] *= 0.55;
  return t;
})();
export const saw = (seconds: number, freq: Hz, phase = 0) => {
  const x = new Float32Array(len(seconds));
  const N = SAW_TABLE.length - 1;
  let ph = phase - Math.floor(phase);
  for (let i = 0; i < x.length; i++) {
    const p = ph * N;
    const k = Math.floor(p);
    const fr = p - k;
    x[i] = SAW_TABLE[k] + (SAW_TABLE[k + 1] - SAW_TABLE[k]) * fr;
    ph += at(freq, i / SR) / SR;
    ph -= Math.floor(ph);
  }
  return x;
};

/** RBJ biquad; a function cutoff is re-evaluated every 16 samples. */
export const biquad = (x: Float32Array, type: 'lp' | 'hp' | 'bp', freq: Hz, q = 0.707) => {
  const y = new Float32Array(x.length);
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    a1 = 0,
    a2 = 0;
  const coef = (f: number) => {
    const w = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR;
    const cs = Math.cos(w);
    const al = Math.sin(w) / (2 * q);
    const a0 = 1 + al;
    if (type === 'lp') {
      b0 = (1 - cs) / 2 / a0;
      b1 = (1 - cs) / a0;
      b2 = b0;
    } else if (type === 'hp') {
      b0 = (1 + cs) / 2 / a0;
      b1 = -(1 + cs) / a0;
      b2 = b0;
    } else {
      b0 = al / a0;
      b1 = 0;
      b2 = -al / a0;
    }
    a1 = (-2 * cs) / a0;
    a2 = (1 - al) / a0;
  };
  coef(at(freq, 0));
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < x.length; i++) {
    if (typeof freq !== 'number' && i % 16 === 0) coef(freq(i / SR));
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
};

/** Multiply by an envelope function of time (s). */
export const shape = (x: Float32Array, env: (t: number) => number) => {
  for (let i = 0; i < x.length; i++) x[i] *= env(i / SR);
  return x;
};

/** Attack/decay: linear attack, exponential decay with time constant tau. */
export const ad = (attack: number, tau: number) => (t: number) => (t < attack ? t / attack : Math.exp(-(t - attack) / tau));

/** Attack/sustain/release over a total length. */
export const asr = (attack: number, total: number, release: number) => (t: number) =>
  Math.min(1, t / Math.max(1e-4, attack)) * Math.min(1, Math.max(0, (total - t) / Math.max(1e-4, release)));

export const sum = (...xs: Float32Array[]) => {
  const n = Math.max(...xs.map((x) => x.length));
  const y = new Float32Array(n);
  xs.forEach((x) => {
    for (let i = 0; i < x.length; i++) y[i] += x[i];
  });
  return y;
};

export const gainOf = (x: Float32Array, g: number) => {
  for (let i = 0; i < x.length; i++) x[i] *= g;
  return x;
};

export const softclip = (x: Float32Array, drive = 1) => {
  for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * drive) / Math.tanh(drive);
  return x;
};

/** Short fades so nothing clicks. */
export const declick = (x: Float32Array, ms = 3) => {
  const n = Math.min(x.length >> 1, Math.round((ms / 1000) * SR));
  for (let i = 0; i < n; i++) {
    x[i] *= i / n;
    x[x.length - 1 - i] *= i / n;
  }
  return x;
};

/** Mix a mono signal into a stereo bus at time t (s), equal-power pan. */
export const place = (bus: Stereo, t: number, x: Float32Array, gain = 1, pan = 0) => {
  const start = Math.round(t * SR);
  const a = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  const gl = Math.cos(a) * gain * Math.SQRT2;
  const gr = Math.sin(a) * gain * Math.SQRT2;
  for (let i = 0; i < x.length; i++) {
    const j = start + i;
    if (j < 0) continue;
    if (j >= bus.L.length) break;
    bus.L[j] += x[i] * gl;
    bus.R[j] += x[i] * gr;
  }
};

/** Mix a stereo signal into a bus. */
export const placeStereo = (bus: Stereo, t: number, s: Stereo, gain = 1) => {
  const start = Math.round(t * SR);
  for (let i = 0; i < s.L.length; i++) {
    const j = start + i;
    if (j < 0) continue;
    if (j >= bus.L.length) break;
    bus.L[j] += s.L[i] * gain;
    bus.R[j] += s.R[i] * gain;
  }
};

/** Freeverb (Jezar): 8 parallel combs + 4 series allpasses per channel. */
export const freeverb = (input: Stereo, roomSize = 0.82, damp = 0.35, wet = 1) => {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => Math.round((d * SR) / 44100));
  const alls = [556, 441, 341, 225].map((d) => Math.round((d * SR) / 44100));
  const run = (x: Float32Array, spread: number) => {
    const out = new Float32Array(x.length);
    const cb = combs.map((d) => ({ buf: new Float32Array(d + spread), idx: 0, store: 0 }));
    const ab = alls.map((d) => ({ buf: new Float32Array(d + spread), idx: 0 }));
    const fb = roomSize * 0.28 + 0.7;
    for (let i = 0; i < x.length; i++) {
      const inp = x[i] * 0.015;
      let acc = 0;
      for (const c of cb) {
        const y = c.buf[c.idx];
        c.store = y * (1 - damp) + c.store * damp;
        c.buf[c.idx] = inp + c.store * fb;
        c.idx = (c.idx + 1) % c.buf.length;
        acc += y;
      }
      for (const a of ab) {
        const bo = a.buf[a.idx];
        a.buf[a.idx] = acc + bo * 0.5;
        acc = bo - acc;
        a.idx = (a.idx + 1) % a.buf.length;
      }
      out[i] = acc * wet;
    }
    return out;
  };
  return { L: run(input.L, 0), R: run(input.R, 23) };
};

/** Gentle peak limiter: smoothed gain riding, then a soft ceiling. */
export const limit = (s: Stereo, ceiling = 0.92) => {
  let g = 1;
  const rel = Math.exp(-1 / (0.12 * SR));
  for (let i = 0; i < s.L.length; i++) {
    const peak = Math.max(Math.abs(s.L[i]), Math.abs(s.R[i]));
    const want = peak * g > ceiling ? ceiling / peak : 1;
    g = want < g ? want : want + (g - want) * rel;
    s.L[i] = Math.tanh((s.L[i] * g) / ceiling) * ceiling;
    s.R[i] = Math.tanh((s.R[i] * g) / ceiling) * ceiling;
  }
  return s;
};

/** 32-bit float WAV (ffmpeg then normalises loudness and writes the 16-bit file). */
export const wavFloat = (s: Stereo) => {
  const n = s.L.length;
  const buf = Buffer.alloc(44 + n * 8);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 8, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(3, 20); // IEEE float
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 8, 28);
  buf.writeUInt16LE(8, 32);
  buf.writeUInt16LE(32, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 8, 40);
  for (let i = 0; i < n; i++) {
    buf.writeFloatLE(s.L[i], 44 + i * 8);
    buf.writeFloatLE(s.R[i], 48 + i * 8);
  }
  return buf;
};
